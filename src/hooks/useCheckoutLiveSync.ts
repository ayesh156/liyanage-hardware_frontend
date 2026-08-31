import { useEffect, useRef, useState, useCallback } from "react";

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
  onRemoteCartState: (payload: CartStatePayload) => void;
  onInvoiceFinalized: (payload: InvoiceSavedPayload) => void;
  debounceMs?: number;
}

export interface UseCheckoutLiveSyncResult {
  isConnected: boolean;
  peerCount: number;
  isApplyingRemoteState: () => boolean;
  broadcastCartState: (
    state: Omit<CartStatePayload, "version" | "originClientId" | "updatedAt">,
  ) => void;
  broadcastInvoiceSaved: (
    payload: Omit<InvoiceSavedPayload, "originClientId" | "updatedAt">,
  ) => void;
}

function resolveWsUrl(): string {
  const apiBase = (import.meta as any).env?.VITE_API_URL || "https://api.liyanage.ecosystemlk.app/api";
  try {
    const url = new URL(apiBase);
    const wsProto = url.protocol === "https:" ? "wss:" : "ws:";
    return `${wsProto}//${url.host}/checkout-sync`;
  } catch {
    return "wss://api.liyanage.ecosystemlk.app/checkout-sync";
  }
}

function makeClientId(): string {
  return `c_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

export function useCheckoutLiveSync(options: UseCheckoutLiveSyncOptions): UseCheckoutLiveSyncResult {
  const { enabled, tenantId, terminalId, userRole, onRemoteCartState, onInvoiceFinalized, debounceMs = 150 } = options;

  const [isConnected, setIsConnected] = useState(false);
  const [peerCount, setPeerCount] = useState(0);

  const wsRef = useRef<WebSocket | null>(null);
  const clientIdRef = useRef<string>(makeClientId());
  const versionRef = useRef<number>(0);
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const applyingRemoteRef = useRef<boolean>(false);

  const onRemoteCartStateRef = useRef(onRemoteCartState);
  const onInvoiceFinalizedRef = useRef(onInvoiceFinalized);
  useEffect(() => { onRemoteCartStateRef.current = onRemoteCartState; }, [onRemoteCartState]);
  useEffect(() => { onInvoiceFinalizedRef.current = onInvoiceFinalized; }, [onInvoiceFinalized]);

  useEffect(() => {
    if (!enabled || !tenantId || !terminalId) {
      if (wsRef.current) {
        wsRef.current.close();
        wsRef.current = null;
      }
      setIsConnected(false);
      setPeerCount(0);
      return;
    }

    const ws = new WebSocket(resolveWsUrl());
    wsRef.current = ws;

    ws.onopen = () => {
      setIsConnected(true);
      ws.send(JSON.stringify({
        event: "join_checkout_session",
        payload: { tenantId, terminalId, userRole },
      }));
    };

    ws.onclose = () => {
      setIsConnected(false);
    };

    ws.onmessage = (e) => {
      try {
        const { event, payload } = JSON.parse(e.data);
        if (event === "session_peers") {
          setPeerCount(payload?.count || 0);
        } else if (event === "sync_cart_state") {
          if (payload.originClientId === clientIdRef.current) return;
          applyingRemoteRef.current = true;
          try {
            onRemoteCartStateRef.current(payload);
          } finally {
            setTimeout(() => { applyingRemoteRef.current = false; }, 0);
          }
        } else if (event === "invoice_finalized") {
          if (payload.originClientId === clientIdRef.current) return;
          onInvoiceFinalizedRef.current(payload);
        }
      } catch (err) {
        console.error(err);
      }
    };

    return () => {
      if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
      ws.close();
      wsRef.current = null;
      setIsConnected(false);
      setPeerCount(0);
    };
  }, [enabled, tenantId, terminalId, userRole]);

  const broadcastCartState = useCallback(
    (state: Omit<CartStatePayload, "version" | "originClientId" | "updatedAt">) => {
      if (!enabled || applyingRemoteRef.current) return;

      if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
      debounceTimerRef.current = setTimeout(() => {
        const ws = wsRef.current;
        if (!ws || ws.readyState !== WebSocket.OPEN) return;
        versionRef.current += 1;
        const payload: CartStatePayload = {
          ...state,
          version: versionRef.current,
          originClientId: clientIdRef.current,
          updatedAt: new Date().toISOString(),
        };
        ws.send(JSON.stringify({ event: "broadcast_cart_state", payload }));
      }, debounceMs);
    },
    [enabled, debounceMs],
  );

  const broadcastInvoiceSaved = useCallback(
    (payload: Omit<InvoiceSavedPayload, "originClientId" | "updatedAt">) => {
      const ws = wsRef.current;
      if (!enabled || !ws || ws.readyState !== WebSocket.OPEN) return;
      ws.send(JSON.stringify({
        event: "broadcast_invoice_saved",
        payload: {
          ...payload,
          originClientId: clientIdRef.current,
          updatedAt: new Date().toISOString(),
        },
      }));
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