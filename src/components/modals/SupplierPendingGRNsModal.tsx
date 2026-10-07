// frontend/src/components/modals/SupplierPendingGRNsModal.tsx
import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Supplier, GRN, GRNItem } from '../../types';
import { useTheme } from '../../contexts/ThemeContext';
import { useTranslation } from 'react-i18next';
import { useQueryClient } from '@tanstack/react-query';
import api from '../../lib/api';
import { toast } from 'react-toastify';
import { 
  X, Banknote, Calendar, DollarSign, FileText, 
  ChevronDown, ChevronUp, Layers, ArrowUpRight, 
  CheckCircle2, Sparkles, Building2, Smartphone, 
  Phone, ShieldAlert, Package, Calculator, Search, RefreshCw,
  History
} from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { SettlementModal } from './SettlementModal';
import { GRNSettlementHistoryModal } from './GRNSettlementHistoryModal';
import { invalidateSettlementCaches } from '../../hooks/useSettlements';
import { cn } from '../../lib/utils';

export interface SupplierPendingGRNsModalProps {
  /** Controls modal visibility */
  isOpen: boolean;
  /** Modal close callback handler */
  onClose: () => void;
  /** Targeted supplier profile */
  supplier: Supplier | null;
  /** Triggered when all settlements or individual payments finish */
  onSuccess?: () => void;
}

/**
 * Reliance "Pending GRNs" Ledger Modal for Suppliers.
 * 
 * Displays all unsettled / outstanding Goods Received Notes belonging to a targeted supplier:
 * - Header shows Supplier Name, Company details, and Total Outstanding Due balance.
 * - Quick "Pay Full" button opens settlement for the entire supplier debt.
 * - Each GRN row presents: GRN Number, Arrival Date, Status Badge, Due Balance,
 *   expandable item line previews, individual `History` inspection button, and `Pay Bill (බිල ගෙවීම)` button.
 * - Clicking `History` opens GRNSettlementHistoryModal pre-populated with that specific GRN's payment logs.
 * - Clicking `Pay Bill` on a specific GRN opens SettlementModal pre-populated with that
 *   specific GRN ID and its exact outstanding due amount.
 * - React Query query invalidation on mutation success for real-time table sync.
 * - Dynamic bilingual localization using `useTranslation()`.
 */
export const SupplierPendingGRNsModal: React.FC<SupplierPendingGRNsModalProps> = ({
  isOpen,
  onClose,
  supplier,
  onSuccess,
}) => {
  const { theme } = useTheme();
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const isDark = theme === 'dark';

  const [pendingGrns, setPendingGrns] = useState<GRN[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [sortBy, setSortBy] = useState<'date' | 'due' | 'number'>('date');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [expandedGrnIds, setExpandedGrnIds] = useState<Set<string>>(new Set());

  // Settlement modal chaining state
  const [isSettlementModalOpen, setIsSettlementModalOpen] = useState<boolean>(false);
  const [settleTargetGrn, setSettleTargetGrn] = useState<GRN | null>(null);

  // Settlement history modal chaining state
  const [isHistoryModalOpen, setIsHistoryModalOpen] = useState<boolean>(false);
  const [historyTargetGrn, setHistoryTargetGrn] = useState<GRN | null>(null);

  // Fetch pending GRNs for this supplier
  const fetchPendingGrns = useCallback(async () => {
    if (!supplier?.id) return;
    setIsLoading(true);
    try {
      const res = await api.get<{ data: GRN[] }>('/grns', {
        supplierId: supplier.id,
        perPage: 100,
      }, true);

      const list: GRN[] = Array.isArray(res) ? res : res?.data || [];
      // Filter strictly for GRNs that have an outstanding balance or are DUE/PARTIAL
      const filtered = list.filter((g) => {
        const due = Number(g.dueAmount);
        return due > 0 || g.status === 'DUE' || g.status === 'PARTIAL';
      });

      setPendingGrns(filtered);
    } catch (err: any) {
      console.error('Failed to load supplier pending GRNs:', err);
      toast.error('Failed to load pending GRNs for this supplier');
    } finally {
      setIsLoading(false);
    }
  }, [supplier?.id]);

  useEffect(() => {
    if (isOpen && supplier?.id) {
      fetchPendingGrns();
      setSearchQuery('');
      setExpandedGrnIds(new Set());
    } else {
      setPendingGrns([]);
    }
  }, [isOpen, supplier?.id, fetchPendingGrns]);

  // Live optimistic state sync on balance / supplier / grn updates
  useEffect(() => {
    if (!isOpen || !supplier?.id) return;
    const handleSync = () => {
      fetchPendingGrns();
    };
    window.addEventListener('balance-updated', handleSync);
    window.addEventListener('supplier-updated', handleSync);
    window.addEventListener('grn-updated', handleSync);
    return () => {
      window.removeEventListener('balance-updated', handleSync);
      window.removeEventListener('supplier-updated', handleSync);
      window.removeEventListener('grn-updated', handleSync);
    };
  }, [isOpen, supplier?.id, fetchPendingGrns]);

  // Expand / collapse single GRN items preview
  const toggleExpand = (grnId: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setExpandedGrnIds((prev) => {
      const next = new Set(prev);
      if (next.has(grnId)) {
        next.delete(grnId);
      } else {
        next.add(grnId);
      }
      return next;
    });
  };

  // Filtered & Sorted GRNs
  const processedGrns = useMemo(() => {
    let result = [...pendingGrns];

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter((g) => 
        g.grnNumber.toLowerCase().includes(q) ||
        (g.notes && g.notes.toLowerCase().includes(q)) ||
        (g.items && g.items.some((item) => item.name.toLowerCase().includes(q)))
      );
    }

    result.sort((a, b) => {
      if (sortBy === 'due') {
        const dueA = Number(a.dueAmount || 0);
        const dueB = Number(b.dueAmount || 0);
        return sortOrder === 'asc' ? dueA - dueB : dueB - dueA;
      }
      if (sortBy === 'number') {
        return sortOrder === 'asc'
          ? a.grnNumber.localeCompare(b.grnNumber)
          : b.grnNumber.localeCompare(a.grnNumber);
      }
      const dateA = new Date(a.createdAt).getTime();
      const dateB = new Date(b.createdAt).getTime();
      return sortOrder === 'asc' ? dateA - dateB : dateB - dateA;
    });

    return result;
  }, [pendingGrns, searchQuery, sortBy, sortOrder]);

  /**
   * Computes the Total Outstanding Due directly from the active pending GRNs list.
   * This guarantees that manual ledger overpayments or advance credits that make
   * `supplier.currentBalance` negative (e.g. Rs. -17,500.00) will never produce
   * a negative or distorted outstanding due figure for the pending bills.
   */
  const totalPendingDue = useMemo(() => {
    return (pendingGrns || []).reduce((sum, grn) => sum + (Number(grn.dueAmount) || 0), 0);
  }, [pendingGrns]);

  // Open SettlementModal for a specific GRN
  const handleOpenPayBill = (grn: GRN) => {
    setSettleTargetGrn(grn);
    setIsSettlementModalOpen(true);
  };

  // Open SettlementModal to pay total full balance for supplier
  const handleOpenPayFull = () => {
    setSettleTargetGrn(null);
    setIsSettlementModalOpen(true);
  };

  // Open GRNSettlementHistoryModal for a specific GRN
  const handleOpenHistory = (grn: GRN) => {
    setHistoryTargetGrn(grn);
    setIsHistoryModalOpen(true);
  };

  // Handle successful payment from chained SettlementModal
  const handleSettlementSuccess = async () => {
    fetchPendingGrns();

    const targetGrnId = settleTargetGrn?.id;
    await invalidateSettlementCaches(queryClient, targetGrnId);

    if (onSuccess) {
      onSuccess();
    }
  };

  if (!isOpen || !supplier) return null;

  const supplierBalance = Number(supplier.currentBalance || 0);
  const hasAdvanceCredit = supplierBalance < 0;
  const advanceCreditAmount = Math.abs(supplierBalance);

  return (
    <>
      <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
        <DialogContent
          className={cn(
            'max-w-5xl w-full max-h-[92vh] overflow-hidden p-0 gap-0 rounded-2xl border shadow-2xl flex flex-col z-[9990]',
            isDark ? 'bg-slate-900 border-slate-800 text-white' : 'bg-white border-slate-200 text-slate-900'
          )}
        >
          {/* ── Modal Header ── */}
          <DialogHeader
            className={cn(
              'px-5 py-4 border-b flex flex-row items-center justify-between shrink-0',
              isDark ? 'border-slate-800 bg-slate-900/90' : 'border-slate-200 bg-slate-50/80'
            )}
          >
            <div className="flex items-center gap-3 text-left">
              <div className="p-2.5 rounded-2xl bg-gradient-to-br from-amber-500 to-orange-600 text-white shadow-lg shadow-orange-500/20 shrink-0">
                <Layers className="w-5 h-5" />
              </div>
              <div>
                <DialogTitle className="text-base sm:text-lg font-black tracking-tight flex items-center gap-2">
                  <span>{t('grn.pendingGrns', 'Pending GRNs')}</span>
                </DialogTitle>
                <DialogDescription className="text-xs text-slate-400 mt-0.5 flex items-center gap-2 flex-wrap">
                  <span className="font-bold text-slate-200">{supplier.name}</span>
                  {supplier.companyName && <span>• {supplier.companyName}</span>}
                  {(supplier.mobileNumber || supplier.telephoneNumber) && (
                    <span className="font-mono text-[11px]">
                      • {supplier.mobileNumber || supplier.telephoneNumber}
                    </span>
                  )}
                </DialogDescription>
              </div>
            </div>

            {/* Header Right Total Balance, Advance Credit Badge & Full Pay CTA */}
            <div className="flex items-center gap-2.5 sm:gap-3 flex-wrap sm:flex-nowrap justify-end">
              {hasAdvanceCredit && (
                <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold bg-amber-500/10 text-amber-500 border border-amber-500/25 shadow-sm">
                  <Sparkles className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                  <span>
                    {t('grn.advanceCreditAvailable', 'Advance Credit Available')}:{' '}
                    <strong className="font-mono font-bold">
                      Rs. {advanceCreditAmount.toLocaleString('en-LK', { minimumFractionDigits: 2 })}
                    </strong>
                  </span>
                </div>
              )}

              <div className="text-right hidden sm:block">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
                  {t('grn.totalOutstanding', 'Total Outstanding')}
                </span>
                <span className="text-sm font-black font-mono text-rose-400">
                  Rs. {totalPendingDue.toLocaleString('en-LK', { minimumFractionDigits: 2 })}
                </span>
              </div>

              {totalPendingDue > 0 && (
                <button
                  type="button"
                  onClick={handleOpenPayFull}
                  className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 text-white shadow-md shadow-emerald-500/20 transition-all shrink-0"
                >
                  <Banknote className="w-4 h-4" />
                  <span>{t('grn.payFull', 'Pay Full')}</span>
                </button>
              )}
            </div>
          </DialogHeader>

          {/* ── Toolbar: Search & Sort Filters ── */}
          <div
            className={cn(
              'px-5 py-2.5 border-b flex flex-wrap items-center justify-between gap-2 text-xs shrink-0',
              isDark ? 'bg-slate-950/60 border-slate-800' : 'bg-slate-100/70 border-slate-200'
            )}
          >
            {/* Search Input */}
            <div
              className={cn(
                'flex items-center gap-2 px-3 py-1.5 rounded-xl border flex-1 max-w-xs',
                isDark ? 'bg-slate-900 border-slate-700/80 text-white' : 'bg-white border-slate-300 text-slate-900'
              )}
            >
              <Search className="w-3.5 h-3.5 text-slate-400 shrink-0" />
              <input
                type="text"
                placeholder={t('common.search', 'Search GRN # or items...')}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-transparent border-none text-xs focus:outline-none placeholder-slate-500"
              />
              {searchQuery && (
                <button onClick={() => setSearchQuery('')} className="text-slate-400 hover:text-white">
                  <X className="w-3 h-3" />
                </button>
              )}
            </div>

            {/* Sorting Controls */}
            <div className="flex items-center gap-1.5">
              <span className="text-[10px] text-slate-400 font-bold uppercase mr-1">{t('common.sort', 'Sort')}:</span>
              <button
                type="button"
                onClick={() => {
                  if (sortBy === 'date') setSortOrder((o) => (o === 'asc' ? 'desc' : 'asc'));
                  else { setSortBy('date'); setSortOrder('desc'); }
                }}
                className={cn(
                  'px-2.5 py-1 rounded-lg text-[11px] font-semibold border flex items-center gap-1 transition-all',
                  sortBy === 'date'
                    ? 'bg-orange-500 text-white border-orange-500 shadow-sm'
                    : isDark
                    ? 'bg-slate-800 border-slate-700 text-slate-300 hover:bg-slate-700'
                    : 'bg-white border-slate-300 text-slate-700 hover:bg-slate-50'
                )}
              >
                <Calendar className="w-3 h-3" /> {t('common.date', 'Date')} {sortBy === 'date' && (sortOrder === 'asc' ? '↑' : '↓')}
              </button>

              <button
                type="button"
                onClick={() => {
                  if (sortBy === 'due') setSortOrder((o) => (o === 'asc' ? 'desc' : 'asc'));
                  else { setSortBy('due'); setSortOrder('desc'); }
                }}
                className={cn(
                  'px-2.5 py-1 rounded-lg text-[11px] font-semibold border flex items-center gap-1 transition-all',
                  sortBy === 'due'
                    ? 'bg-orange-500 text-white border-orange-500 shadow-sm'
                    : isDark
                    ? 'bg-slate-800 border-slate-700 text-slate-300 hover:bg-slate-700'
                    : 'bg-white border-slate-300 text-slate-700 hover:bg-slate-50'
                )}
              >
                <DollarSign className="w-3 h-3" /> {t('grn.dueBalance', 'Due')} {sortBy === 'due' && (sortOrder === 'asc' ? '↑' : '↓')}
              </button>

              <button
                type="button"
                onClick={() => {
                  if (sortBy === 'number') setSortOrder((o) => (o === 'asc' ? 'desc' : 'asc'));
                  else { setSortBy('number'); setSortOrder('asc'); }
                }}
                className={cn(
                  'px-2.5 py-1 rounded-lg text-[11px] font-semibold border flex items-center gap-1 transition-all',
                  sortBy === 'number'
                    ? 'bg-orange-500 text-white border-orange-500 shadow-sm'
                    : isDark
                    ? 'bg-slate-800 border-slate-700 text-slate-300 hover:bg-slate-700'
                    : 'bg-white border-slate-300 text-slate-700 hover:bg-slate-50'
                )}
              >
                <FileText className="w-3 h-3" /> {t('grn.grnNumber', 'GRN #')} {sortBy === 'number' && (sortOrder === 'asc' ? '↑' : '↓')}
              </button>
            </div>

            <button
              type="button"
              onClick={fetchPendingGrns}
              className={cn(
                'p-1.5 rounded-lg border transition-colors',
                isDark ? 'border-slate-700 bg-slate-800 text-slate-300 hover:text-white' : 'border-slate-300 bg-white text-slate-700 hover:bg-slate-50'
              )}
              title="Refresh List"
            >
              <RefreshCw className={cn('w-3.5 h-3.5', isLoading && 'animate-spin text-orange-400')} />
            </button>
          </div>

          {/* ── Pending GRNs List Container ── */}
          <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-2.5 custom-scrollbar">
            {isLoading ? (
              <div className="py-16 text-center space-y-3">
                <RefreshCw className="w-7 h-7 text-orange-400 animate-spin mx-auto" />
                <p className="text-xs text-slate-400">Loading pending GRNs for {supplier.name}...</p>
              </div>
            ) : processedGrns.length === 0 ? (
              <div
                className={cn(
                  'py-14 text-center rounded-2xl border p-6 space-y-3',
                  isDark ? 'bg-slate-950/40 border-slate-800' : 'bg-slate-50 border-slate-200'
                )}
              >
                <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 text-emerald-400 flex items-center justify-center mx-auto border border-emerald-500/20">
                  <CheckCircle2 className="w-6 h-6" />
                </div>
                <div>
                  <h4 className="text-sm font-bold text-slate-200">{t('grn.allSettled', 'All Settled & Clear!')}</h4>
                  <p className="text-xs text-slate-400 mt-1 max-w-sm mx-auto">
                    {searchQuery
                      ? 'No pending GRNs matched your search criteria.'
                      : t('grn.noPendingGrns', `There are currently no unpaid or pending GRNs for ${supplier.name}.`)}
                  </p>
                </div>
              </div>
            ) : (
              processedGrns.map((grn) => {
                const isExpanded = expandedGrnIds.has(grn.id);
                const itemsCount = grn.items?.length || 0;
                const totalAmt = Number(grn.totalAmount || 0);
                const paidAmt = Number(grn.paidAmount || 0);
                const dueAmt = Number(grn.dueAmount || 0);

                return (
                  <div
                    key={grn.id}
                    className={cn(
                      'rounded-2xl border transition-all duration-200 overflow-hidden',
                      isDark
                        ? 'bg-slate-900/90 border-slate-800 hover:border-slate-700'
                        : 'bg-white border-slate-200 hover:border-slate-300 shadow-sm'
                    )}
                  >
                    {/* Main GRN Card Single-Row Header with Structured Flex Columns */}
                    <div
                      className={cn(
                        'flex items-center justify-between p-3.5 sm:p-4 rounded-xl border transition-all gap-4 flex-wrap sm:flex-nowrap',
                        isDark
                          ? 'bg-slate-900/60 border-slate-800/80 hover:border-slate-700/80'
                          : 'bg-white border-slate-200 hover:border-slate-300'
                      )}
                    >
                      {/* Left Column: GRN Identification & Date */}
                      <div className="flex items-center gap-3 min-w-[190px] shrink-0">
                        <span className="px-2.5 py-1 rounded-lg font-mono text-xs font-bold bg-orange-500/10 text-orange-400 border border-orange-500/20">
                          #{grn.grnNumber}
                        </span>
                        <div className="flex flex-col">
                          <span className="text-xs text-slate-300 font-medium whitespace-nowrap">
                            {new Date(grn.createdAt).toLocaleDateString('en-CA')}
                          </span>
                          <span className="text-[10px] text-slate-500 font-mono">
                            {new Date(grn.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </span>
                        </div>
                      </div>

                      {/* Middle Column: Financial Metrics (Total / Paid / Due) with generous flex spacing */}
                      <div className="flex items-center gap-6 sm:gap-8 text-xs shrink-0 mx-auto sm:mx-0">
                        <div className="flex flex-col">
                          <span className="text-[10px] text-slate-400 uppercase font-semibold">
                            {t('common.total', 'Total')}
                          </span>
                          <span className={cn('font-semibold font-mono text-xs sm:text-sm', isDark ? 'text-slate-200' : 'text-slate-800')}>
                            Rs. {totalAmt.toLocaleString('en-LK', { minimumFractionDigits: 2 })}
                          </span>
                        </div>
                        <div className="flex flex-col">
                          <span className="text-[10px] text-emerald-400 uppercase font-semibold">
                            {t('grn.paidAmount', 'Paid')}
                          </span>
                          <span className="font-semibold font-mono text-xs sm:text-sm text-emerald-400">
                            Rs. {paidAmt.toLocaleString('en-LK', { minimumFractionDigits: 2 })}
                          </span>
                        </div>
                        <div className="flex flex-col">
                          <span className="text-[10px] text-rose-400 uppercase font-bold">
                            {t('grn.dueBalance', 'Due')}
                          </span>
                          <span className="text-sm sm:text-base font-black font-mono text-rose-400">
                            Rs. {dueAmt.toLocaleString('en-LK', { minimumFractionDigits: 2 })}
                          </span>
                        </div>
                      </div>

                      {/* Right Column: Actions (Items popover, History modal trigger, Pay Bill button) */}
                      <div className="flex items-center gap-2.5 shrink-0 ml-auto sm:ml-0">
                        {/* Items breakdown icon button */}
                        {itemsCount > 0 && (
                          <button
                            type="button"
                            onClick={(e) => toggleExpand(grn.id, e)}
                            className={cn(
                              'h-8 px-2.5 rounded-lg border text-xs font-medium flex items-center gap-1 transition-colors',
                              isDark
                                ? 'bg-slate-800 border-slate-700/60 text-slate-300 hover:text-white hover:bg-slate-700'
                                : 'bg-slate-100 border-slate-200 text-slate-700 hover:text-slate-900 hover:bg-slate-200'
                            )}
                            title={t('grn.viewItems', 'View Items')}
                          >
                            <Package className="w-3.5 h-3.5 text-cyan-400" />
                            <span className="font-mono font-bold">{itemsCount}</span>
                            {isExpanded ? <ChevronUp className="w-3 h-3 ml-0.5" /> : <ChevronDown className="w-3 h-3 ml-0.5" />}
                          </button>
                        )}

                        {/* History button */}
                        <button
                          type="button"
                          onClick={() => handleOpenHistory(grn)}
                          className={cn(
                            'h-8 px-2.5 rounded-lg border flex items-center gap-1.5 transition-colors text-xs font-medium',
                            isDark
                              ? 'bg-slate-800 border-slate-700/60 text-slate-300 hover:text-cyan-400 hover:bg-slate-700'
                              : 'bg-slate-100 border-slate-200 text-slate-700 hover:text-cyan-600 hover:bg-slate-200'
                          )}
                          title={t('grn.settlementHistory', 'Settlement History')}
                        >
                          <History className="w-3.5 h-3.5 text-cyan-400" />
                          <span className="hidden sm:inline">{t('grn.history', 'History')}</span>
                        </button>

                        {/* Pay Bill Primary Button */}
                        <button
                          type="button"
                          onClick={() => handleOpenPayBill(grn)}
                          className="h-8 px-3.5 rounded-lg bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white text-xs font-bold flex items-center gap-1.5 shadow-sm transition-all"
                        >
                          <Banknote className="w-3.5 h-3.5" />
                          <span>{t('grn.payBill', 'Pay Bill')}</span>
                        </button>
                      </div>
                    </div>

                    {/* Expandable Line Items Preview Section */}
                    {isExpanded && itemsCount > 0 && (
                      <div
                        className={cn(
                          'px-4 py-3 border-t text-xs animate-in slide-in-from-top-2 duration-150',
                          isDark ? 'bg-slate-950/70 border-slate-800/80' : 'bg-slate-50 border-slate-200'
                        )}
                      >
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                            <Package className="w-3 h-3 text-cyan-400" />
                            {t('grn.itemsBreakdown', 'Line Items Breakdown')} ({itemsCount})
                          </span>
                        </div>

                        <div className="overflow-x-auto">
                          <table className="w-full text-left text-xs">
                            <thead>
                              <tr
                                className={cn(
                                  'border-b text-[10px] font-bold uppercase tracking-wider',
                                  isDark ? 'border-slate-800 text-slate-400' : 'border-slate-200 text-slate-600'
                                )}
                              >
                                <th className="pb-1.5">{t('common.name', 'Item Name')}</th>
                                <th className="pb-1.5 text-right">{t('suppliers.unitPrice', 'Unit Price')}</th>
                                <th className="pb-1.5 text-center">{t('suppliers.quantity', 'Qty')}</th>
                                <th className="pb-1.5 text-right">{t('common.total', 'Subtotal')}</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-800/40">
                              {grn.items!.map((it, idx) => (
                                <tr key={it.id || idx} className="text-[11px]">
                                  <td className="py-1.5 font-medium text-slate-200 truncate max-w-xs">
                                    {it.name}
                                  </td>
                                  <td className="py-1.5 text-right font-mono text-slate-400">
                                    Rs. {Number(it.unitPrice || 0).toLocaleString('en-LK', { minimumFractionDigits: 2 })}
                                  </td>
                                  <td className="py-1.5 text-center font-mono font-bold text-slate-300">
                                    {Number(it.qty || 0)}
                                  </td>
                                  <td className="py-1.5 text-right font-mono font-bold text-slate-200">
                                    Rs. {Number(it.subtotal || 0).toLocaleString('en-LK', { minimumFractionDigits: 2 })}
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>

          {/* ── Modal Footer ── */}
          <div
            className={cn(
              'px-5 py-3.5 border-t flex flex-row items-center justify-between shrink-0',
              isDark ? 'border-slate-800 bg-slate-900/90' : 'border-slate-200 bg-slate-50'
            )}
          >
            <div className="text-xs text-slate-400">
              <span>{t('grn.showingPending', 'Showing pending GRNs')}: <strong className="text-slate-200 font-mono font-bold">{processedGrns.length}</strong></span>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onClose}
                className={cn(
                  'px-4 py-2 rounded-xl text-xs font-semibold transition-colors',
                  isDark
                    ? 'bg-slate-800 hover:bg-slate-700 text-slate-300'
                    : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
                )}
              >
                {t('common.close', 'Close')}
              </button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* ── Dedicated Chained SettlementModal ── */}
      {isSettlementModalOpen && (
        <SettlementModal
          isOpen={isSettlementModalOpen}
          supplier={supplier}
          targetGrn={settleTargetGrn}
          onClose={() => {
            setIsSettlementModalOpen(false);
            setSettleTargetGrn(null);
          }}
          onSettlementSuccess={handleSettlementSuccess}
          onSuccess={handleSettlementSuccess}
        />
      )}

      {/* ── Chained GRN Settlement History Modal ── */}
      {isHistoryModalOpen && (
        <GRNSettlementHistoryModal
          isOpen={isHistoryModalOpen}
          grn={historyTargetGrn}
          onClose={() => {
            setIsHistoryModalOpen(false);
            setHistoryTargetGrn(null);
          }}
          onGRNUpdated={() => {
            fetchPendingGrns();
            window.dispatchEvent(new CustomEvent('balance-updated'));
            window.dispatchEvent(new CustomEvent('supplier-updated'));
            window.dispatchEvent(new CustomEvent('grn-updated'));
            if (onSuccess) {
              onSuccess();
            }
          }}
          onOpenSettlementModal={(target) => {
            setIsHistoryModalOpen(false);
            handleOpenPayBill(target);
          }}
        />
      )}
    </>
  );
};

export default SupplierPendingGRNsModal;
