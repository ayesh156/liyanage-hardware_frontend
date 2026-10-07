import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '../lib/api';
import { SupplierSettlement, GRN, Supplier } from '../types';

export interface CreateSettlementPayload {
  supplierId: string;
  amount: number;
  paymentMethod: 'CASH' | 'CHEQUE' | 'BANK_TRANSFER' | string;
  note?: string;
  grnId?: string;
  createdAt?: string;
}

export interface UpdateSettlementPayload {
  settlementId: string;
  amount?: number;
  paymentMethod?: string;
  note?: string;
  createdAt?: string;
  grnId?: string;
}

export interface DeleteSettlementPayload {
  settlementId: string;
  grnId?: string;
}

export interface SettlementMutationResult {
  settlement: SupplierSettlement;
  grn?: GRN | null;
  supplier?: Supplier | null;
}

/**
 * Aggressively invalidates all query caches and dispatches multi-window cross-boundary
 * DOM events to synchronize nested modals, parent views, and supplier ledgers.
 *
 * Invalidation Cascade:
 * 1. `['grn-settlements', grnId]` & `['grn-settlements']` - Refreshes settlement history logs
 * 2. `['grns']` - Synchronizes GRN tables, paid/due balances, and status badges
 * 3. `['suppliers']` - Updates supplier listings, starting/current debt balances
 * 4. `['supplier-ledger']` - Refreshes supplier ledger timeline and running balance
 * 5. `['pending-grns']` - Recomputes pending unpaid invoices and quick-pay summaries
 * 6. Dispatches 'balance-updated', 'supplier-updated', 'grn-updated' custom events for legacy and nested listeners.
 */
export async function invalidateSettlementCaches(
  queryClient: ReturnType<typeof useQueryClient>,
  grnId?: string | null
) {
  const tasks: Promise<unknown>[] = [
    queryClient.invalidateQueries({ queryKey: ['grn-settlements'] }),
    queryClient.invalidateQueries({ queryKey: ['grns'] }),
    queryClient.invalidateQueries({ queryKey: ['suppliers'] }),
    queryClient.invalidateQueries({ queryKey: ['supplier-ledger'] }),
    queryClient.invalidateQueries({ queryKey: ['pending-grns'] }),
  ];

  if (grnId) {
    tasks.push(queryClient.invalidateQueries({ queryKey: ['grn-settlements', grnId] }));
    tasks.push(queryClient.invalidateQueries({ queryKey: ['grn', grnId] }));
  }

  await Promise.all(tasks);

  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('balance-updated'));
    window.dispatchEvent(new CustomEvent('supplier-updated'));
    window.dispatchEvent(new CustomEvent('grn-updated'));
  }
}

/**
 * React Query hook to fetch settlement logs for a specific GRN.
 *
 * @param grnId - Goods Received Note identifier
 */
export function useGRNSettlements(grnId: string | undefined | null) {
  return useQuery<SupplierSettlement[]>({
    queryKey: ['grn-settlements', grnId],
    queryFn: async () => {
      if (!grnId) return [];
      const res = await api.get<any>(`/grns/${grnId}/settlements`);
      return Array.isArray(res) ? res : res?.data || [];
    },
    enabled: Boolean(grnId),
    staleTime: 0,
    refetchOnWindowFocus: true,
  });
}

/**
 * React Query mutation hook for creating a new settlement payment.
 *
 * Automatically cascades cache invalidations across GRN settlement logs,
 * GRN listings, supplier profiles, ledgers, and pending bills.
 */
export function useCreateSettlement() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (payload: CreateSettlementPayload) => {
      const { supplierId, ...body } = payload;
      const res = await api.post<any>(`/suppliers/${supplierId}/settle`, body);
      return (res?.data || res) as SettlementMutationResult;
    },
    onSuccess: async (data, variables) => {
      const targetGrnId = variables.grnId || data?.grn?.id;
      await invalidateSettlementCaches(queryClient, targetGrnId);
    },
  });
}

/**
 * React Query mutation hook for updating an existing settlement payment.
 *
 * Re-evaluates debt offsets, recalculates GRN status (PAID/PARTIAL/DUE),
 * and triggers aggressive cache invalidation across all nested dialog boundaries.
 */
export function useUpdateSettlement() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (payload: UpdateSettlementPayload) => {
      const { settlementId, grnId: _g, ...body } = payload;
      const res = await api.put<any>(`/grns/settlements/${settlementId}`, body);
      return (res?.data || res) as SettlementMutationResult;
    },
    onSuccess: async (data, variables) => {
      const targetGrnId = variables.grnId || data?.grn?.id || (data?.settlement as any)?.grnId;
      await invalidateSettlementCaches(queryClient, targetGrnId);
    },
  });
}

/**
 * React Query mutation hook for deleting a settlement payment.
 *
 * Restores debt balance to the parent GRN and supplier current balance,
 * executing full cache invalidation to instantly reflect changes on open screens.
 */
export function useDeleteSettlement() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (payload: DeleteSettlementPayload) => {
      const res = await api.delete<any>(`/grns/settlements/${payload.settlementId}`);
      return (res?.data || res) as { success: boolean; grn: GRN | null };
    },
    onSuccess: async (data, variables) => {
      const targetGrnId = variables.grnId || data?.grn?.id;
      await invalidateSettlementCaches(queryClient, targetGrnId);
    },
  });
}
