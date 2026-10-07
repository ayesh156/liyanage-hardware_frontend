import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { useTheme } from '../../contexts/ThemeContext';
import { Supplier, GRN, SupplierSettlement } from '../../types';
import api from '../../lib/api';
import { toast } from 'react-toastify';
import { 
  BookOpen, Building2, Calendar, Clock, DollarSign, 
  ArrowUpRight, ArrowDownLeft, Banknote, ShieldAlert, 
  CheckCircle2, Plus, Loader2, Filter, Layers, CreditCard,
  FileText, RefreshCw, Smartphone, Phone, MapPin, X
} from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { cn } from '../../lib/utils';

export interface SupplierLedgerModalProps {
  /** Controls modal visibility */
  isOpen: boolean;
  /** Targeted supplier unique identifier */
  supplierId: string | null;
  /** Modal close callback handler */
  onClose: () => void;
  /** Optional callback to trigger settlement payment modal */
  onOpenSettle?: (supplier: Supplier) => void;
  /** Optional callback to create new GRN for this supplier */
  onOpenAddGrn?: (supplierId: string) => void;
  /** Optional callback to view specific GRN settlement history */
  onViewGrnHistory?: (grn: GRN) => void;
}

interface CombinedLedgerItem {
  id: string;
  type: 'GRN' | 'SETTLEMENT';
  date: string;
  reference: string;
  description: string;
  method?: string;
  debit: number; // Stock received (Debt increase)
  credit: number; // Payment settled (Debt decrease)
  status?: string;
  rawItem: GRN | SupplierSettlement;
}

/**
 * Comprehensive Supplier Ledger Audit & Settlement Timeline Modal.
 * 
 * Features:
 * - Wide container (`max-w-6xl w-full`) guaranteeing zero horizontal line wrapping.
 * - Exact column proportion alignment:
 *   - Date/Time: 180px shrink-0 whitespace-nowrap
 *   - Type/Reference: 170px shrink-0 whitespace-nowrap
 *   - Details/Notes: max-w-[190px] truncate
 *   - Debit (Stock In): 120px shrink-0 text-right whitespace-nowrap
 *   - Credit (Settled): 120px shrink-0 text-right whitespace-nowrap
 *   - Status/Method: 100px shrink-0 text-center whitespace-nowrap
 * - Starting Balance & live running balance metrics.
 * - Dynamic live event syncing for instant zero-refresh balance updates.
 * - Grouped inline Refresh and Close buttons in clean header flex wrapper.
 * - Comprehensive bilingual localization with `useTranslation()`.
 */
export const SupplierLedgerModal: React.FC<SupplierLedgerModalProps> = ({
  isOpen,
  supplierId,
  onClose,
  onOpenSettle,
  onOpenAddGrn,
  onViewGrnHistory,
}) => {
  const { t } = useTranslation();
  const { theme } = useTheme();
  const isDark = theme === 'dark';

  const [supplier, setSupplier] = useState<Supplier | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [activeTab, setActiveTab] = useState<'all' | 'grns' | 'settlements'>('all');
  const [searchFilter, setSearchFilter] = useState<string>('');

  const fetchSupplierLedger = useCallback(async () => {
    if (!supplierId) return;
    setIsLoading(true);
    try {
      const res = await api.get<{ data: Supplier } | Supplier>(`/suppliers/${supplierId}`);
      const data = (res as any)?.data || res;
      setSupplier(data);
    } catch (err: any) {
      console.error('Failed to fetch supplier ledger:', err);
      toast.error('Failed to load supplier ledger data');
    } finally {
      setIsLoading(false);
    }
  }, [supplierId]);

  useEffect(() => {
    if (isOpen && supplierId) {
      fetchSupplierLedger();
      setActiveTab('all');
      setSearchFilter('');
    } else {
      setSupplier(null);
    }
  }, [isOpen, supplierId, fetchSupplierLedger]);

  // Dynamic live event syncing
  useEffect(() => {
    if (!isOpen || !supplierId) return;
    const handleSync = () => {
      fetchSupplierLedger();
    };
    window.addEventListener('balance-updated', handleSync);
    window.addEventListener('supplier-updated', handleSync);
    window.addEventListener('grn-updated', handleSync);
    return () => {
      window.removeEventListener('balance-updated', handleSync);
      window.removeEventListener('supplier-updated', handleSync);
      window.removeEventListener('grn-updated', handleSync);
    };
  }, [isOpen, supplierId, fetchSupplierLedger]);

  // Combined and sorted chronological ledger items
  const combinedLedger: CombinedLedgerItem[] = useMemo(() => {
    if (!supplier) return [];

    const items: CombinedLedgerItem[] = [];

    // Add GRNs
    if (supplier.grns) {
      supplier.grns.forEach((g) => {
        items.push({
          id: `grn-${g.id}`,
          type: 'GRN',
          date: g.createdAt,
          reference: `#${g.grnNumber}`,
          description: g.notes || `Stock intake (${g.items?.length || 0} items)`,
          debit: Number(g.totalAmount || 0),
          credit: 0,
          status: g.status,
          rawItem: g,
        });
      });
    }

    // Add Settlements
    if (supplier.settlements) {
      supplier.settlements.forEach((s) => {
        items.push({
          id: `settle-${s.id}`,
          type: 'SETTLEMENT',
          date: s.createdAt,
          reference: s.grn?.grnNumber ? `GRN #${s.grn.grnNumber}` : 'Settlement',
          description: s.note || `Payment via ${s.paymentMethod}`,
          method: s.paymentMethod,
          debit: 0,
          credit: Number(s.amount || 0),
          rawItem: s,
        });
      });
    }

    // Sort descending by date
    items.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

    return items;
  }, [supplier]);

  // Filtered ledger entries
  const filteredLedger = useMemo(() => {
    return combinedLedger.filter((item) => {
      if (activeTab === 'grns' && item.type !== 'GRN') return false;
      if (activeTab === 'settlements' && item.type !== 'SETTLEMENT') return false;
      if (searchFilter.trim()) {
        const q = searchFilter.toLowerCase();
        return (
          item.reference.toLowerCase().includes(q) ||
          item.description.toLowerCase().includes(q) ||
          (item.method && item.method.toLowerCase().includes(q))
        );
      }
      return true;
    });
  }, [combinedLedger, activeTab, searchFilter]);

  // Calculated ledger metrics
  const startingBalance = Number(supplier?.startingBalance || 0);
  const currentBalance = Number(supplier?.currentBalance || 0);
  const totalGrnVal = (supplier?.grns || []).reduce((acc, g) => acc + Number(g.totalAmount || 0), 0);
  const totalSettledVal = (supplier?.settlements || []).reduce((acc, s) => acc + Number(s.amount || 0), 0);

  if (!isOpen) return null;

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent
        className={cn(
          'max-w-6xl w-full max-h-[92vh] overflow-y-auto p-0 gap-0 rounded-2xl border shadow-2xl z-[9990] [&>button:last-child]:hidden',
          isDark ? 'bg-slate-900 border-slate-800 text-white' : 'bg-white border-slate-200 text-slate-900'
        )}
      >
        {/* ── Modal Header ── */}
        <DialogHeader
          className={cn(
            'px-6 py-4 border-b flex flex-row items-center justify-between shrink-0',
            isDark ? 'border-slate-800 bg-slate-900/80' : 'border-slate-200 bg-slate-50/50'
          )}
        >
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-2xl bg-gradient-to-br from-cyan-500 to-blue-600 text-white shadow-lg shadow-cyan-500/25 shrink-0">
              <BookOpen className="w-5 h-5" />
            </div>
            <div>
              <DialogTitle className="text-base font-bold tracking-tight flex items-center gap-2">
                <span>{t('supplierLedger.title', 'Supplier Ledger')}</span>
                {supplier?.name && (
                  <span className="text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-cyan-500/10 text-cyan-400 border border-cyan-500/20">
                    {supplier.name}
                  </span>
                )}
              </DialogTitle>
              <DialogDescription className="text-[11px] text-slate-400 mt-0.5 flex items-center gap-2 flex-wrap">
                {supplier?.companyName && (
                  <span className="font-semibold text-slate-300">{supplier.companyName}</span>
                )}
                {supplier?.mobileNumber && (
                  <span className="font-mono text-slate-400">• Mobile: {supplier.mobileNumber}</span>
                )}
                {supplier?.telephoneNumber && (
                  <span className="font-mono text-slate-400">• Tel: {supplier.telephoneNumber}</span>
                )}
              </DialogDescription>
            </div>
          </div>

          {/* Grouped Top-Right Header Actions (Refresh & Close Buttons) */}
          <div className="flex items-center gap-2.5 relative z-20">
            <button
              type="button"
              onClick={fetchSupplierLedger}
              className={cn(
                'p-2 rounded-xl border transition-colors',
                isDark ? 'border-slate-700 bg-slate-800/80 text-slate-300 hover:text-white' : 'border-slate-300 bg-white text-slate-700 hover:bg-slate-100'
              )}
              title={t('supplierLedger.refreshLedger', 'Refresh ledger')}
            >
              <RefreshCw className={cn('w-4 h-4', isLoading && 'animate-spin text-cyan-400')} />
            </button>

            <button
              type="button"
              onClick={onClose}
              className={cn(
                'p-2 rounded-xl border transition-colors',
                isDark
                  ? 'border-slate-700 bg-slate-800/80 text-slate-300 hover:text-rose-400 hover:border-rose-500/30 hover:bg-rose-500/10'
                  : 'border-slate-300 bg-white text-slate-700 hover:text-rose-600 hover:border-rose-200 hover:bg-rose-50'
              )}
              title={t('common.close', 'Close')}
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </DialogHeader>

        <div className="p-6 space-y-5 overflow-y-auto">
          {/* ── Financial Ledger Overview Cards ── */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {/* Starting Balance */}
            <div
              className={cn(
                'p-3.5 rounded-2xl border',
                isDark ? 'bg-slate-950/60 border-slate-800' : 'bg-slate-50 border-slate-200'
              )}
            >
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-0.5">
                {t('supplierLedger.startingBalance', 'Starting Balance')}
              </span>
              <div className="text-base font-black font-mono text-slate-200">
                Rs. {startingBalance.toLocaleString('en-LK', { minimumFractionDigits: 2 })}
              </div>
              <p className="text-[10px] text-slate-500 mt-0.5">{t('supplierLedger.openingBalance', 'Opening balance')}</p>
            </div>

            {/* Total Stock Invoiced */}
            <div
              className={cn(
                'p-3.5 rounded-2xl border',
                isDark ? 'bg-slate-950/60 border-slate-800' : 'bg-slate-50 border-slate-200'
              )}
            >
              <span className="text-[10px] font-bold uppercase tracking-wider text-cyan-400 block mb-0.5">
                {t('supplierLedger.totalGrnValue', 'Total GRN Value')}
              </span>
              <div className="text-base font-black font-mono text-cyan-400">
                Rs. {totalGrnVal.toLocaleString('en-LK', { minimumFractionDigits: 2 })}
              </div>
              <p className="text-[10px] text-slate-500 mt-0.5">{supplier?.grns?.length || 0} stock deliveries</p>
            </div>

            {/* Total Settled / Paid */}
            <div
              className={cn(
                'p-3.5 rounded-2xl border',
                isDark ? 'bg-slate-950/60 border-slate-800' : 'bg-slate-50 border-slate-200'
              )}
            >
              <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-400 block mb-0.5">
                {t('supplierLedger.totalSettled', 'Total Settled')}
              </span>
              <div className="text-base font-black font-mono text-emerald-400">
                Rs. {totalSettledVal.toLocaleString('en-LK', { minimumFractionDigits: 2 })}
              </div>
              <p className="text-[10px] text-slate-500 mt-0.5">{supplier?.settlements?.length || 0} payment logs</p>
            </div>

            {/* Live Due Debt */}
            <div
              className={cn(
                'p-3.5 rounded-2xl border',
                isDark ? 'bg-slate-950/60 border-slate-800' : 'bg-slate-50 border-slate-200'
              )}
            >
              <span className="text-[10px] font-bold uppercase tracking-wider text-rose-400 block mb-0.5">
                {t('supplierLedger.currentDue', 'Current Due')}
              </span>
              <div
                className={cn(
                  'text-base font-black font-mono',
                  currentBalance > 0 ? 'text-rose-400' : 'text-emerald-400'
                )}
              >
                Rs. {currentBalance.toLocaleString('en-LK', { minimumFractionDigits: 2 })}
              </div>
              <p className="text-[10px] text-slate-500 mt-0.5">Live outstanding debt</p>
            </div>
          </div>

          {/* ── Toolbar: Quick Actions, Filter Tabs & Search ── */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-1">
            {/* Filter Tabs */}
            <div className="flex items-center gap-1.5 p-1 rounded-xl bg-slate-950/60 border border-slate-800 w-full sm:w-auto">
              <button
                type="button"
                onClick={() => setActiveTab('all')}
                className={cn(
                  'px-3 py-1 rounded-lg text-xs font-bold transition-all',
                  activeTab === 'all'
                    ? 'bg-orange-500 text-white shadow-sm'
                    : 'text-slate-400 hover:text-slate-200'
                )}
              >
                {t('supplierLedger.allRecords', 'All Records')} ({combinedLedger.length})
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('grns')}
                className={cn(
                  'px-3 py-1 rounded-lg text-xs font-bold transition-all',
                  activeTab === 'grns'
                    ? 'bg-cyan-600 text-white shadow-sm'
                    : 'text-slate-400 hover:text-slate-200'
                )}
              >
                GRNs ({supplier?.grns?.length || 0})
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('settlements')}
                className={cn(
                  'px-3 py-1 rounded-lg text-xs font-bold transition-all',
                  activeTab === 'settlements'
                    ? 'bg-emerald-600 text-white shadow-sm'
                    : 'text-slate-400 hover:text-slate-200'
                )}
              >
                {t('grn.paymentHistory', 'Payments')} ({supplier?.settlements?.length || 0})
              </button>
            </div>

            {/* Quick Action Buttons */}
            <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
              {onOpenAddGrn && supplier && (
                <button
                  type="button"
                  onClick={() => onOpenAddGrn(supplier.id)}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold bg-cyan-500/10 border border-cyan-500/30 text-cyan-400 hover:bg-cyan-500/20 transition-all"
                >
                  <Plus className="w-3.5 h-3.5" />
                  {t('supplierLedger.newGrn', 'New GRN')}
                </button>
              )}

              {onOpenSettle && supplier && currentBalance > 0 && (
                <button
                  type="button"
                  onClick={() => onOpenSettle(supplier)}
                  className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-bold bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 text-white shadow-md shadow-emerald-500/20 transition-all"
                >
                  <Banknote className="w-3.5 h-3.5" />
                  {t('supplierLedger.settleDebt', 'Settle Debt')}
                </button>
              )}
            </div>
          </div>

          {/* ── Chronological Ledger Table (Strict Proportion Alignment) ── */}
          <div
            className={cn(
              'rounded-2xl border overflow-hidden',
              isDark ? 'bg-slate-950/40 border-slate-800' : 'bg-white border-slate-200 shadow-sm'
            )}
          >
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs table-fixed">
                <thead>
                  <tr
                    className={cn(
                      'border-b text-[10px] font-bold uppercase tracking-wider',
                      isDark ? 'bg-slate-950/80 border-slate-800 text-slate-400' : 'bg-slate-50 border-slate-200 text-slate-600'
                    )}
                  >
                    <th className="p-3.5 w-[180px] shrink-0 whitespace-nowrap">
                      {t('supplierLedger.dateTime', 'Date & Exact Time')}
                    </th>
                    <th className="p-3.5 w-[170px] shrink-0 whitespace-nowrap">
                      {t('supplierLedger.typeRef', 'Type & Reference')}
                    </th>
                    <th className="p-3.5 max-w-[190px] truncate">
                      {t('supplierLedger.detailsNotes', 'Details / Notes')}
                    </th>
                    <th className="p-3.5 w-[120px] shrink-0 text-right whitespace-nowrap">
                      {t('supplierLedger.debitStockIn', 'Debit (Stock In)')}
                    </th>
                    <th className="p-3.5 w-[120px] shrink-0 text-right whitespace-nowrap">
                      {t('supplierLedger.creditSettled', 'Credit (Settled)')}
                    </th>
                    <th className="p-3.5 w-[100px] shrink-0 text-center whitespace-nowrap">
                      {t('supplierLedger.statusMethod', 'Status / Method')}
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/40">
                  {filteredLedger.length > 0 ? (
                    filteredLedger.map((row) => {
                      const isGrn = row.type === 'GRN';
                      const dateObj = new Date(row.date);

                      return (
                        <tr
                          key={row.id}
                          className={cn(
                            'transition-colors',
                            isDark ? 'hover:bg-slate-800/30' : 'hover:bg-slate-50'
                          )}
                        >
                          {/* 1. Date & Exact Time (180px shrink-0 whitespace-nowrap) */}
                          <td className="p-3.5 w-[180px] shrink-0 whitespace-nowrap">
                            <div className="font-mono font-bold text-slate-200 flex items-center gap-1.5">
                              <Calendar className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                              <span>{dateObj.toLocaleDateString()}</span>
                            </div>
                            <div className="text-[10px] text-slate-500 font-mono mt-0.5 flex items-center gap-1">
                              <Clock className="w-3 h-3 text-slate-600 shrink-0" />
                              <span>{dateObj.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}</span>
                            </div>
                          </td>

                          {/* 2. Type & Reference (170px shrink-0 whitespace-nowrap) */}
                          <td className="p-3.5 w-[170px] shrink-0 whitespace-nowrap">
                            <div className="flex items-center gap-1.5">
                              <span
                                className={cn(
                                  'px-2 py-0.5 rounded-full text-[9px] font-mono font-bold uppercase border shrink-0',
                                  isGrn
                                    ? 'bg-cyan-500/10 text-cyan-400 border-cyan-500/20'
                                    : 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                                )}
                              >
                                {isGrn ? t('grn.stockIn', 'STOCK IN') : t('grn.settled', 'PAYMENT')}
                              </span>
                              <span className="font-mono font-bold text-slate-100 truncate max-w-[100px]" title={row.reference}>
                                {row.reference}
                              </span>
                            </div>
                          </td>

                          {/* 3. Details / Notes (max-w-[190px] truncate with tooltip) */}
                          <td className="p-3.5 text-slate-400 max-w-[190px] truncate" title={row.description}>
                            {row.description}
                          </td>

                          {/* 4. Debit (Stock In) (120px shrink-0 text-right whitespace-nowrap) */}
                          <td className="p-3.5 w-[120px] shrink-0 text-right font-mono font-bold whitespace-nowrap">
                            {row.debit > 0 ? (
                              <span className="text-cyan-400">
                                Rs. {row.debit.toLocaleString('en-LK', { minimumFractionDigits: 2 })}
                              </span>
                            ) : (
                              <span className="text-slate-600">-</span>
                            )}
                          </td>

                          {/* 5. Credit (Settled) (120px shrink-0 text-right whitespace-nowrap) */}
                          <td className="p-3.5 w-[120px] shrink-0 text-right font-mono font-bold whitespace-nowrap">
                            {row.credit > 0 ? (
                              <span className="text-emerald-400">
                                Rs. {row.credit.toLocaleString('en-LK', { minimumFractionDigits: 2 })}
                              </span>
                            ) : (
                              <span className="text-slate-600">-</span>
                            )}
                          </td>

                          {/* 6. Status / Method (100px shrink-0 text-center whitespace-nowrap) */}
                          <td className="p-3.5 w-[100px] shrink-0 text-center whitespace-nowrap">
                            {isGrn ? (
                              <span
                                className={cn(
                                  'px-2 py-0.5 rounded-full text-[9px] font-bold uppercase font-mono border inline-block',
                                  row.status === 'PAID'
                                    ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                                    : row.status === 'PARTIAL'
                                    ? 'bg-amber-500/10 text-amber-400 border-amber-500/20'
                                    : 'bg-rose-500/10 text-rose-400 border-rose-500/20'
                                )}
                              >
                                {row.status}
                              </span>
                            ) : (
                              <span
                                className={cn(
                                  'px-2 py-0.5 rounded-full text-[9px] font-bold uppercase font-mono border inline-block',
                                  row.method === 'CHEQUE'
                                    ? 'bg-purple-500/10 text-purple-400 border-purple-500/20'
                                    : row.method === 'BANK_TRANSFER'
                                    ? 'bg-blue-500/10 text-blue-400 border-blue-500/20'
                                    : 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                                )}
                              >
                                {row.method || 'CASH'}
                              </span>
                            )}
                          </td>
                        </tr>
                      );
                    })
                  ) : (
                    <tr>
                      <td colSpan={6} className="p-8 text-center text-slate-400 text-xs">
                        {isLoading ? (
                          <div className="flex items-center justify-center gap-2">
                            <Loader2 className="w-4 h-4 animate-spin text-cyan-400" />
                            {t('supplierLedger.loadingLedger', 'Loading supplier ledger activity...')}
                          </div>
                        ) : (
                          t('supplierLedger.noActivity', 'No ledger activity recorded for this supplier.')
                        )}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* ── Modal Footer ── */}
        <div
          className={cn(
            'px-6 py-3.5 border-t flex items-center justify-between shrink-0',
            isDark ? 'border-slate-800 bg-slate-900/80' : 'border-slate-200 bg-slate-50/50'
          )}
        >
          <span className="text-xs text-slate-400 font-medium">
            {t('supplierLedger.totalTransactions', 'Total transactions')}: <span className="font-bold text-slate-200 font-mono">{filteredLedger.length}</span>
          </span>

          <button
            type="button"
            onClick={onClose}
            className={cn(
              'px-4 py-2 rounded-xl text-xs font-bold border transition-colors',
              isDark ? 'border-slate-700 text-slate-300 hover:bg-slate-800' : 'border-slate-300 text-slate-700 hover:bg-slate-100'
            )}
          >
            {t('common.close', 'Close')}
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default SupplierLedgerModal;
