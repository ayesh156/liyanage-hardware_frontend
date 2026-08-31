import { useEffect, useMemo, useRef, useState, useCallback } from "react";
import { io, Socket } from "socket.io-client";

/**
 * ═══════════════════════════════════════════════════════════════════════════
 * useCheckoutLiveSync
 * ═══════════════════════════════════════════════════════════════════════════
 * Manages the lifecycle of a single Socket.IO connection to the
 * `/checkout-sync` namespace and the room subscription for one POS
 * "checkout session" (an Admin terminal + a Cashier terminal sharing the
 * same `terminalId`).
 *
 * Design notes:
 *  - The socket connects lazily and only once `enabled` is true, so toggling
 *    the 🟢 LIVE SYNC button in the toolbar fully tears down the connection
 *    rather than just muting events (saves a server-side room slot).
 *  - Outbound cart broadcasts are debounced (default 150ms) and tagged with
 *    a monotonically increasing `version` + a stable `clientId`, so a
 *    receiver can always discard an out-of-order or self-originated frame
 *    even if it arrives via network jitter.
 *  - A `lockRef` guard prevents state we just RECEIVED from immediately
 *    being re-broadcast back out (which would otherwise cause a feedback
 *    loop with the peer terminal).
 * ═══════════════════════════════════════════════════════════════════════════
 */

export interface CartStatePayload {
  items: unknown[];
  discount: number;
  selectedCustomerId: string;
  receivedAmount: number;
  paymentMethod: "cash" | "credit";
  version: number;
  originClientId: string;
  updatedAt: string;
}

export interface InvoiceSavedPayload {
  invoiceNumber: string;
  invoiceId?: string;
  total: number;
  finalizedBy: string;
  originClientId: string;
  updatedAt: string;
}

export interface UseCheckoutLiveSyncOptions {
  enabled: boolean;
  tenantId: string;
  terminalId: string;
  userRole: string;
  /** Called whenever a peer terminal's cart state should be mirrored locally. */
  onRemoteCartState: (payload: CartStatePayload) => void;
  /** Called when ANY terminal in the room finalizes a sale. */
  onInvoiceFinalized: (payload: InvoiceSavedPayload) => void;
  /** Debounce window for outbound broadcasts, ms. Default 150. */
  debounceMs?: number;
}

export interface UseCheckoutLiveSyncResult {
  isConnected: boolean;
  peerCount: number;
  /** true while we're actively applying a state frame we just received — use this to skip re-broadcasting the resulting state change. */
  isApplyingRemoteState: () => boolean;
  broadcastCartState: (
    state: Omit<CartStatePayload, "version" | "originClientId" | "updatedAt">,
  ) => void;
  broadcastInvoiceSaved: (
    payload: Omit<InvoiceSavedPayload, "originClientId" | "updatedAt">,
  ) => void;
}

function resolveSocketOrigin(): string {
  const apiBase =
    (import.meta as any).env?.VITE_API_URL || "http://localhost:3000/api";
  // Strip a trailing /api (or any trailing path) to get the bare origin the
  // socket.io server is attached to (it shares the HTTP server/port).
  try {
    const url = new URL(apiBase);
    return `${url.protocol}//${url.host}`;
  } catch {
    return apiBase.replace(/\/api\/?$/, "");
  }
}

// Stable per-browser-tab identity so peers (and our own stale echoes) can be
// told apart. Regenerated per mount — a refresh is a "new" terminal client.
function makeClientId(): string {
  return `c_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

export function useCheckoutLiveSync(
  options: UseCheckoutLiveSyncOptions,
): UseCheckoutLiveSyncResult {
  const {
    enabled,
    tenantId,
    terminalId,
    userRole,
    onRemoteCartState,
    onInvoiceFinalized,
    debounceMs = 150,
  } = options;

  const [isConnected, setIsConnected] = useState(false);
  const [peerCount, setPeerCount] = useState(0);

  const socketRef = useRef<Socket | null>(null);
  const clientIdRef = useRef<string>(makeClientId());
  const versionRef = useRef<number>(0);
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const applyingRemoteRef = useRef<boolean>(false);

  // Keep the latest callbacks in refs so the socket effect below doesn't
  // need to tear down/reconnect every time a parent re-renders with a new
  // inline function reference.
  const onRemoteCartStateRef = useRef(onRemoteCartState);
  const onInvoiceFinalizedRef = useRef(onInvoiceFinalized);
  useEffect(() => {
    onRemoteCartStateRef.current = onRemoteCartState;
  }, [onRemoteCartState]);
  useEffect(() => {
    onInvoiceFinalizedRef.current = onInvoiceFinalized;
  }, [onInvoiceFinalized]);

  useEffect(() => {
    if (!enabled || !tenantId || !terminalId) {
      // Toggled off (or missing session identity) — ensure any existing
      // connection is fully torn down rather than left dangling.
      if (socketRef.current) {
        socketRef.current.disconnect();
        socketRef.current = null;
      }
      setIsConnected(false);
      setPeerCount(0);
      return;
    }

    const socket = io(`${resolveSocketOrigin()}/checkout-sync`, {
      path: "/socket.io",
      withCredentials: true,
      transports: ["websocket"], // 🌟 Direct pure WebSocket පමණක් භාවිතා කරයි
      reconnection: true,
      reconnectionAttempts: Infinity,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 8000,
    });
    socketRef.current = socket;

    const join = () => {
      socket.emit("join_checkout_session", { tenantId, terminalId, userRole });
    };

    socket.on("connect", () => {
      setIsConnected(true);
      join();
    });

    socket.on("disconnect", () => {
      setIsConnected(false);
    });

    socket.on("session_peers", (data: { count: number }) => {
      setPeerCount(typeof data?.count === "number" ? data.count : 0);
    });

    socket.on("sync_cart_state", (payload: CartStatePayload) => {
      // Discard our own echo (shouldn't normally arrive, since the gateway
      // excludes the sender, but this is a cheap belt-and-braces check).
      if (payload.originClientId === clientIdRef.current) return;

      applyingRemoteRef.current = true;
      try {
        onRemoteCartStateRef.current(payload);
      } finally {
        // Release the lock on the next tick, after React has had a chance
        // to process the resulting setState calls this frame triggers.
        setTimeout(() => {
          applyingRemoteRef.current = false;
        }, 0);
      }
    });

    socket.on("invoice_finalized", (payload: InvoiceSavedPayload) => {
      if (payload.originClientId === clientIdRef.current) return;
      onInvoiceFinalizedRef.current(payload);
    });

    socket.on("session_error", (err: { message: string }) => {
      console.warn("[useCheckoutLiveSync] session_error:", err?.message);
    });

    socket.on("connect_error", (err: Error) => {
      console.warn("[useCheckoutLiveSync] connect_error:", err.message);
    });

    return () => {
      if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
      socket.emit("leave_checkout_session");
      socket.disconnect();
      socketRef.current = null;
      setIsConnected(false);
      setPeerCount(0);
    };
    // Reconnect whenever the session identity or the enabled toggle changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, tenantId, terminalId, userRole]);

  const broadcastCartState = useCallback(
    (
      state: Omit<CartStatePayload, "version" | "originClientId" | "updatedAt">,
    ) => {
      if (!enabled) return;
      // Don't re-broadcast state that we're currently mirroring FROM a peer
      // — that would immediately bounce it straight back to them.
      if (applyingRemoteRef.current) return;

      if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
      debounceTimerRef.current = setTimeout(() => {
        const socket = socketRef.current;
        if (!socket || !socket.connected) return;
        versionRef.current += 1;
        const payload: CartStatePayload = {
          ...state,
          version: versionRef.current,
          originClientId: clientIdRef.current,
          updatedAt: new Date().toISOString(),
        };
        socket.emit("broadcast_cart_state", payload);
      }, debounceMs);
    },
    [enabled, debounceMs],
  );

  const broadcastInvoiceSaved = useCallback(
    (payload: Omit<InvoiceSavedPayload, "originClientId" | "updatedAt">) => {
      const socket = socketRef.current;
      if (!enabled || !socket || !socket.connected) return;
      socket.emit("broadcast_invoice_saved", {
        ...payload,
        originClientId: clientIdRef.current,
        updatedAt: new Date().toISOString(),
      });
    },
    [enabled],
  );

  return {
    isConnected,
    peerCount,
    isApplyingRemoteState: () => applyingRemoteRef.current,
    broadcastCartState,
    broadcastInvoiceSaved,
  };
}
