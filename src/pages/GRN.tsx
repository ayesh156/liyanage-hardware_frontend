import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { useTheme } from '../contexts/ThemeContext';
import { useIsMobile } from '../hooks/use-mobile';
import { useLoading } from '../contexts/LoadingContext';
import { Supplier, GRN, GRNImageItem } from '../types';
import api from '../lib/api';
import { normalizeImageUrl, isPdfUrl } from '../utils/imageUtils';
import { 
  Layers, PackagePlus, Search, RefreshCw, Edit2, 
  Trash2, Banknote, Calendar, ShieldAlert, CheckCircle2,
  FileText, Building2, DollarSign, CreditCard, Sparkles,
  History, Eye
} from 'lucide-react';
import { GRNFormModal } from '../components/modals/GRNFormModal';
import { GRNSettlementHistoryModal } from '../components/modals/GRNSettlementHistoryModal';
import { SettlementModal } from '../components/modals/SettlementModal';
import { DeleteConfirmationModal } from '../components/modals/DeleteConfirmationModal';
import { SearchableSelect, SearchableSelectOption } from '../components/ui/searchable-select';
import { GRNRowActionMenu } from '../components/suppliers/GRNRowActionMenu';
import { LightboxModal } from '../components/ui/LightboxModal';
import { toast } from 'react-toastify';
import { cn } from '../lib/utils';

/**
 * Goods Received Notes (GRN) Management Page.
 * 
 * Features:
 * - Dedicated decoupled route strictly for GRN listings, arrival tracking, bill management, and debt settlements.
 * - Direct row-click & action-menu editing via comprehensive GRNFormModal.
 * - Row-level settlement history modal with full inline edit and delete capabilities.
 * - Full SearchableSelect integration across all status and supplier filters.
 * - Fullscreen manual-zoom Lightbox with direct programmatic blob download.
 */
export default function GRNPage() {
  const { t } = useTranslation();
  const { theme } = useTheme();
  const { startLoading, finishLoading } = useLoading();
  const isDark = theme === 'dark';
  const isMobile = useIsMobile();

  // State
  const [grns, setGrns] = useState<GRN[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [isLoadingGrns, setIsLoadingGrns] = useState<boolean>(true);
  const [isLoadingSuppliers, setIsLoadingSuppliers] = useState<boolean>(false);

  // Filters
  const [grnSearch, setGrnSearch] = useState<string>('');
  const [grnStatusFilter, setGrnStatusFilter] = useState<string>('all');
  const [grnSupplierFilter, setGrnSupplierFilter] = useState<string>('all');
  const [grnSummary, setGrnSummary] = useState<{ totalGrnValue: number; totalPaidValue: number; totalDueValue: number }>({
    totalGrnValue: 0,
    totalPaidValue: 0,
    totalDueValue: 0,
  });

  // Modals
  const [isGrnFormModalOpen, setIsGrnFormModalOpen] = useState<boolean>(false);
  const [selectedGrnForEdit, setSelectedGrnForEdit] = useState<GRN | null>(null);

  const [isSettlementHistoryModalOpen, setIsSettlementHistoryModalOpen] = useState<boolean>(false);
  const [selectedGrnForSettlementHistory, setSelectedGrnForSettlementHistory] = useState<GRN | null>(null);

  const [isQuickSettleModalOpen, setIsQuickSettleModalOpen] = useState<boolean>(false);
  const [settleTargetSupplier, setSettleTargetSupplier] = useState<Supplier | null>(null);
  const [settleTargetGrn, setSettleTargetGrn] = useState<GRN | null>(null);

  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState<boolean>(false);
  const [grnToDelete, setGrnToDelete] = useState<GRN | null>(null);

  // Lightbox Viewer
  const [lightboxItems, setLightboxItems] = useState<(GRNImageItem | string)[] | null>(null);
  const [lightboxIndex, setLightboxIndex] = useState<number>(0);

  // Fetch Suppliers for filter dropdown
  const fetchSuppliers = useCallback(async () => {
    setIsLoadingSuppliers(true);
    try {
      const res = await api.get<{ data: Supplier[] }>('/suppliers', { perPage: 200 }, true);
      if (res && res.data) {
        setSuppliers(res.data);
      }
    } catch (err: any) {
      console.error('Failed to fetch suppliers:', err);
    } finally {
      setIsLoadingSuppliers(false);
    }
  }, []);

  // Fetch GRNs
  const fetchGrns = useCallback(async () => {
    setIsLoadingGrns(true);
    try {
      const res = await api.get<{
        data: GRN[];
        meta: any;
        summary: { totalGrnValue: number; totalPaidValue: number; totalDueValue: number };
      }>(
        '/grns',
        {
          search: grnSearch || undefined,
          status: grnStatusFilter !== 'all' ? grnStatusFilter : undefined,
          supplierId: grnSupplierFilter !== 'all' ? grnSupplierFilter : undefined,
        },
        true
      );

      if (res && res.data) {
        setGrns(res.data);
        if (res.summary) {
          setGrnSummary(res.summary);
        }
      }
    } catch (err: any) {
      console.error('Failed to fetch GRNs:', err);
      toast.error(err?.message || 'Failed to load GRNs from server');
    } finally {
      setIsLoadingGrns(false);
    }
  }, [grnSearch, grnStatusFilter, grnSupplierFilter]);

  // Initial Route Load Synchronization
  useEffect(() => {
    let mounted = true;
    const loadInitialData = async () => {
      startLoading('Loading GRN records & supplier ledgers...');
      setIsLoadingGrns(true);
      setIsLoadingSuppliers(true);
      try {
        const [grnRes, supRes] = await Promise.all([
          api.get<{
            data: GRN[];
            meta: any;
            summary: { totalGrnValue: number; totalPaidValue: number; totalDueValue: number };
          }>('/grns', undefined, true),
          api.get<{ data: Supplier[] }>('/suppliers', { perPage: 200 }, true),
        ]);

        if (mounted) {
          if (grnRes && grnRes.data) {
            setGrns(grnRes.data);
            if (grnRes.summary) {
              setGrnSummary(grnRes.summary);
            }
          }
          if (supRes && supRes.data) {
            setSuppliers(supRes.data);
          }
        }
      } catch (err: any) {
        console.error('Failed to fetch initial GRN data:', err);
      } finally {
        if (mounted) {
          setIsLoadingGrns(false);
          setIsLoadingSuppliers(false);
          finishLoading();
        }
      }
    };

    loadInitialData();

    return () => {
      mounted = false;
    };
  }, [startLoading, finishLoading]);

  // Subsequent Filter Updates (Non-blocking)
  useEffect(() => {
    fetchGrns();
  }, [fetchGrns]);

  // ── Live Optimistic State Refresh on Settlement / Updates ──
  useEffect(() => {
    const handleSync = () => {
      fetchGrns();
      fetchSuppliers();
    };
    window.addEventListener('balance-updated', handleSync);
    window.addEventListener('supplier-updated', handleSync);
    window.addEventListener('grn-updated', handleSync);
    return () => {
      window.removeEventListener('balance-updated', handleSync);
      window.removeEventListener('supplier-updated', handleSync);
      window.removeEventListener('grn-updated', handleSync);
    };
  }, [fetchGrns, fetchSuppliers]);

  // Open Create GRN modal
  const handleOpenAddGrn = () => {
    setSelectedGrnForEdit(null);
    setIsGrnFormModalOpen(true);
  };

  // Open Edit GRN modal
  const handleOpenEditGrn = (grn: GRN) => {
    setSelectedGrnForEdit(grn);
    setIsGrnFormModalOpen(true);
  };

  // Open Settlement History Modal
  const handleOpenSettlementHistory = (grn: GRN) => {
    setSelectedGrnForSettlementHistory(grn);
    setIsSettlementHistoryModalOpen(true);
  };

  // Open Quick Settle Modal
  const handleOpenQuickSettle = (grn: GRN) => {
    const supp = suppliers.find((s) => s.id === grn.supplierId) || (grn.supplier as Supplier);
    setSettleTargetSupplier(supp || null);
    setSettleTargetGrn(grn);
    setIsQuickSettleModalOpen(true);
  };

  // Handle Delete Confirmation
  const handlePromptDelete = (grn: GRN) => {
    setGrnToDelete(grn);
    setIsDeleteModalOpen(true);
  };

  const handleConfirmDelete = async () => {
    if (!grnToDelete) return;
    try {
      await api.delete(`/grns/${grnToDelete.id}`);
      toast.success(`GRN #${grnToDelete.grnNumber} deleted successfully`);
      fetchGrns();
    } catch (err: any) {
      toast.error(err?.message || 'Failed to delete GRN');
    } finally {
      setIsDeleteModalOpen(false);
      setGrnToDelete(null);
    }
  };

  // Lightbox trigger from table thumbnail
  const handleOpenLightbox = (images: (GRNImageItem | string)[], index: number, e: React.MouseEvent) => {
    e.stopPropagation();
    setLightboxItems(images);
    setLightboxIndex(index);
  };

  // Callback after editing/updating a GRN
  const handleGRNUpdated = (updatedGrn: GRN) => {
    setGrns((prev) => prev.map((g) => (g.id === updatedGrn.id ? { ...g, ...updatedGrn } : g)));
    if (selectedGrnForSettlementHistory?.id === updatedGrn.id) {
      setSelectedGrnForSettlementHistory((prev) => (prev ? { ...prev, ...updatedGrn } : null));
    }
    fetchGrns();
    fetchSuppliers();
  };

  // Options for Status SearchableSelect
  const statusSelectOptions: SearchableSelectOption[] = [
    { value: 'all', label: t('grn.allStatuses', 'All Statuses') },
    { value: 'DUE', label: t('grn.dueBalance', 'Due Balance'), icon: <ShieldAlert className="w-3.5 h-3.5 text-rose-500 shrink-0" /> },
    { value: 'PARTIAL', label: t('grn.partiallyPaid', 'Partially Paid'), icon: <CreditCard className="w-3.5 h-3.5 text-amber-500 shrink-0" /> },
    { value: 'PAID', label: t('grn.fullyPaid', 'Fully Paid'), icon: <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 shrink-0" /> },
  ];

  // Options for Supplier SearchableSelect
  const supplierSelectOptions: SearchableSelectOption[] = useMemo(() => {
    return [
      { value: 'all', label: t('grn.allSuppliersFilter', 'All Suppliers') },
      ...suppliers.map((s) => ({
        value: s.id,
        label: s.companyName ? `${s.name} (${s.companyName})` : s.name,
        icon: <Building2 className="w-3.5 h-3.5 text-orange-500 shrink-0" />,
      })),
    ];
  }, [suppliers, t]);

  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-6 max-w-[1600px] mx-auto min-h-screen">
      {/* ── Top Header Bar ── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className={cn('text-xl sm:text-2xl font-black tracking-tight flex items-center gap-2.5', isDark ? 'text-slate-100' : 'text-slate-900')}>
            <div className="p-2.5 rounded-2xl bg-gradient-to-br from-cyan-500 to-blue-600 text-white shadow-lg shadow-cyan-500/25">
              <Layers className="w-6 h-6" />
            </div>
            <span>{t('grn.title', 'Goods Received Notes (GRN)')}</span>
          </h1>
          <p className={cn('text-xs sm:text-sm mt-1', isDark ? 'text-slate-400' : 'text-slate-500')}>
            {t('grn.subtitle', 'Manage incoming stock arrivals, item breakdowns, bill attachments, and settlement payments')}
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            onClick={() => fetchGrns()}
            className={cn(
              'p-2.5 rounded-xl border transition-all duration-200 focus:outline-none',
              isDark
                ? 'border-slate-800 bg-slate-900/80 hover:bg-slate-800 text-slate-300'
                : 'border-slate-200 bg-white hover:bg-slate-100 text-slate-700 shadow-sm'
            )}
            title="Refresh Live Data"
          >
            <RefreshCw className={cn('w-4 h-4', isLoadingGrns && 'animate-spin text-cyan-400')} />
          </button>

          <button
            onClick={handleOpenAddGrn}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs sm:text-sm font-bold bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-600 hover:to-blue-700 text-white shadow-lg shadow-cyan-500/25 transition-all"
          >
            <PackagePlus className="w-4 h-4" />
            {t('grn.newGrn', 'New GRN')}
          </button>
        </div>
      </div>

      {/* ── Key Metrics Overview Cards ── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        {/* Total Stock Received */}
        <div
          className={cn(
            'p-4 rounded-2xl border relative overflow-hidden transition-all',
            isDark ? 'bg-slate-900/90 border-slate-800/80 shadow-lg' : 'bg-white border-slate-200 shadow-sm'
          )}
        >
          <div className="flex items-center justify-between mb-2">
            <span className={cn('text-[11px] font-bold uppercase tracking-wider', isDark ? 'text-cyan-400' : 'text-cyan-600')}>
              {t('grn.totalStockReceived', 'Total Stock Received')}
            </span>
            <div className="w-8 h-8 rounded-xl bg-cyan-500/10 text-cyan-400 flex items-center justify-center border border-cyan-500/20">
              <Layers className="w-4 h-4" />
            </div>
          </div>
          <div className={cn('text-xl sm:text-2xl font-black tracking-tight font-mono', isDark ? 'text-cyan-400' : 'text-cyan-600')}>
            Rs. {grnSummary.totalGrnValue.toLocaleString('en-LK', { minimumFractionDigits: 2 })}
          </div>
          <p className={cn('text-[10px] mt-1', isDark ? 'text-slate-400' : 'text-slate-500')}>{grns.length} records</p>
        </div>

        {/* Total Paid Out */}
        <div
          className={cn(
            'p-4 rounded-2xl border relative overflow-hidden transition-all',
            isDark ? 'bg-slate-900/90 border-slate-800/80 shadow-lg' : 'bg-white border-slate-200 shadow-sm'
          )}
        >
          <div className="flex items-center justify-between mb-2">
            <span className={cn('text-[11px] font-bold uppercase tracking-wider', isDark ? 'text-emerald-400' : 'text-emerald-600')}>
              {t('grn.totalPaymentsMade', 'Total Payments Made')}
            </span>
            <div className="w-8 h-8 rounded-xl bg-emerald-500/10 text-emerald-400 flex items-center justify-center border border-emerald-500/20">
              <CheckCircle2 className="w-4 h-4" />
            </div>
          </div>
          <div className={cn('text-xl sm:text-2xl font-black tracking-tight font-mono', isDark ? 'text-emerald-400' : 'text-emerald-600')}>
            Rs. {grnSummary.totalPaidValue.toLocaleString('en-LK', { minimumFractionDigits: 2 })}
          </div>
          <p className={cn('text-[10px] mt-1', isDark ? 'text-slate-400' : 'text-slate-500')}>{t('grn.settled', 'Settled payments to vendors')}</p>
        </div>

        {/* Outstanding Due Debt */}
        <div
          className={cn(
            'p-4 rounded-2xl border relative overflow-hidden transition-all',
            isDark ? 'bg-slate-900/90 border-slate-800/80 shadow-lg' : 'bg-white border-slate-200 shadow-sm'
          )}
        >
          <div className="flex items-center justify-between mb-2">
            <span className={cn('text-[11px] font-bold uppercase tracking-wider', isDark ? 'text-rose-400' : 'text-rose-600')}>
              {t('grn.totalDueBalance', 'Total Due Balance')}
            </span>
            <div className="w-8 h-8 rounded-xl bg-rose-500/10 text-rose-400 flex items-center justify-center border border-rose-500/20">
              <ShieldAlert className="w-4 h-4" />
            </div>
          </div>
          <div className={cn('text-xl sm:text-2xl font-black tracking-tight font-mono', isDark ? 'text-rose-500' : 'text-rose-600')}>
            Rs. {grnSummary.totalDueValue.toLocaleString('en-LK', { minimumFractionDigits: 2 })}
          </div>
          <p className={cn('text-[10px] mt-1', isDark ? 'text-slate-400' : 'text-slate-500')}>{t('grn.dueBalance', 'Pending debt across all GRNs')}</p>
        </div>

        {/* Total Receipts */}
        <div
          className={cn(
            'p-4 rounded-2xl border relative overflow-hidden transition-all',
            isDark ? 'bg-slate-900/90 border-slate-800/80 shadow-lg' : 'bg-white border-slate-200 shadow-sm'
          )}
        >
          <div className="flex items-center justify-between mb-2">
            <span className={cn('text-[11px] font-bold uppercase tracking-wider', isDark ? 'text-slate-400' : 'text-slate-500')}>
              {t('grn.totalGrnEntries', 'Total GRN Entries')}
            </span>
            <div className="w-8 h-8 rounded-xl bg-orange-500/10 text-orange-400 flex items-center justify-center border border-orange-500/20">
              <FileText className="w-4 h-4" />
            </div>
          </div>
          <div className={cn('text-xl sm:text-2xl font-black tracking-tight font-mono', isDark ? 'text-slate-100' : 'text-slate-900')}>
            {grns.length}
          </div>
          <p className={cn('text-[10px] mt-1', isDark ? 'text-slate-400' : 'text-slate-500')}>{t('grn.stockIn', 'Active inventory intake records')}</p>
        </div>
      </div>

      {/* ── Filter and Search Controls ── */}
      <div className="flex flex-col sm:flex-row items-center gap-3">
        {/* Search Input */}
        <div
          className={cn(
            'flex-1 p-2.5 px-3 rounded-2xl border flex items-center gap-2.5 w-full',
            isDark ? 'bg-slate-900/80 border-slate-800' : 'bg-white border-slate-200 shadow-sm'
          )}
        >
          <Search className={cn('w-4 h-4 shrink-0', isDark ? 'text-slate-400' : 'text-slate-500')} />
          <input
            type="text"
            placeholder={t('grn.searchTablePlaceholder', 'Search by GRN Number, supplier name, notes, or bill reference...')}
            value={grnSearch}
            onChange={(e) => setGrnSearch(e.target.value)}
            className={cn(
              'w-full bg-transparent border-none text-xs sm:text-sm focus:outline-none',
              isDark ? 'text-white placeholder-slate-500' : 'text-slate-900 placeholder-slate-400'
            )}
          />
        </div>

        {/* Status Filter SearchableSelect */}
        <div className="w-full sm:w-56">
          <SearchableSelect
            options={statusSelectOptions}
            value={grnStatusFilter}
            onValueChange={setGrnStatusFilter}
            placeholder={t('grn.allStatuses', 'All Statuses')}
            searchPlaceholder="Search status..."
            theme={isDark ? 'dark' : 'light'}
            triggerClassName="h-10 text-xs rounded-xl"
          />
        </div>

        {/* Supplier Filter SearchableSelect */}
        <div className="w-full sm:w-64">
          <SearchableSelect
            options={supplierSelectOptions}
            value={grnSupplierFilter}
            onValueChange={setGrnSupplierFilter}
            placeholder={t('grn.filterBySupplier', 'Filter by supplier...')}
            searchPlaceholder="Search supplier name..."
            theme={isDark ? 'dark' : 'light'}
            triggerClassName="h-10 text-xs rounded-xl"
          />
        </div>
      </div>

      {/* ── GRN Main Table ── */}
      <div
        className={cn(
          'rounded-2xl border overflow-hidden',
          isDark ? 'bg-slate-900/90 border-slate-800' : 'bg-white border-slate-200 shadow-sm'
        )}
      >
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr
                className={cn(
                  'border-b text-[11px] font-bold uppercase tracking-wider',
                  isDark ? 'bg-slate-950/70 border-slate-800 text-slate-400' : 'bg-slate-50 border-slate-200 text-slate-600'
                )}
              >
                <th className="p-4">{t('grn.grnAndDate', 'GRN # / Date')}</th>
                <th className="p-4">{t('grn.supplier', 'Supplier')}</th>
                <th className="p-4 text-right">{t('grn.totalAmount', 'Total Amount')}</th>
                <th className="p-4 text-right">{t('grn.paidAmount', 'Paid')}</th>
                <th className="p-4 text-right">{t('grn.dueBalance', 'Due Balance')}</th>
                <th className="p-4 text-center">{t('common.status', 'Status')}</th>
                <th className="p-4 text-center">{t('grn.receiptBills', 'Receipt Bills')}</th>
                <th className="p-4 text-right">{t('common.actions', 'Actions')}</th>
              </tr>
            </thead>
            <tbody className={cn('divide-y', isDark ? 'divide-slate-800/50' : 'divide-slate-200')}>
              {grns.length > 0 ? (
                grns.map((g) => {
                  const due = Number(g.dueAmount || 0);
                  const imagesList: (GRNImageItem | string)[] = Array.isArray(g.images) ? (g.images as any[]) : [];
                  const itemsCount = g.items?.length || 0;

                  return (
                    <tr
                      key={g.id}
                      onClick={() => handleOpenEditGrn(g)}
                      className={cn(
                        'cursor-pointer transition-colors group',
                        isDark ? 'hover:bg-slate-800/40' : 'hover:bg-slate-50'
                      )}
                    >
                      {/* GRN & Date */}
                      <td className="p-4">
                        <div className={cn('font-mono font-bold text-sm group-hover:underline flex items-center gap-1.5', isDark ? 'text-cyan-400' : 'text-cyan-600')}>
                          #{g.grnNumber}
                          <Edit2 className="w-3 h-3 opacity-0 group-hover:opacity-100 text-slate-400 transition-opacity" />
                        </div>
                        <div className={cn('text-[11px] flex items-center gap-1 mt-0.5', isDark ? 'text-slate-400' : 'text-slate-500')}>
                          <Calendar className={cn('w-3 h-3 shrink-0', isDark ? 'text-slate-500' : 'text-slate-400')} />
                          <span>{new Date(g.createdAt).toLocaleDateString()}</span>
                          {itemsCount > 0 && (
                            <span className={cn('ml-1 text-[10px] px-1.5 py-0.2 rounded font-mono', isDark ? 'bg-slate-800 text-slate-400' : 'bg-slate-100 text-slate-600 border border-slate-200')}>
                              {t('grn.itemsCount', '{{count}} items', { count: itemsCount })}
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Supplier */}
                      <td className="p-4">
                        <div className={cn('font-bold', isDark ? 'text-slate-200' : 'text-slate-800')}>{g.supplier?.name}</div>
                        {g.supplier?.companyName && (
                          <div className={cn('text-[11px]', isDark ? 'text-slate-400' : 'text-slate-500')}>{g.supplier.companyName}</div>
                        )}
                      </td>

                      {/* Total */}
                      <td className={cn('p-4 text-right font-mono font-bold', isDark ? 'text-slate-100' : 'text-slate-900')}>
                        Rs. {Number(g.totalAmount).toLocaleString('en-LK', { minimumFractionDigits: 2 })}
                      </td>

                      {/* Paid */}
                      <td className={cn('p-4 text-right font-mono font-semibold', isDark ? 'text-emerald-400' : 'text-emerald-600')}>
                        Rs. {Number(g.paidAmount || 0).toLocaleString('en-LK', { minimumFractionDigits: 2 })}
                      </td>

                      {/* Due */}
                      <td className="p-4 text-right">
                        <span
                          className={cn(
                            'font-mono font-bold text-sm',
                            due > 0
                              ? isDark ? 'text-rose-400' : 'text-rose-600'
                              : isDark ? 'text-emerald-400' : 'text-emerald-600'
                          )}
                        >
                          Rs. {due.toLocaleString('en-LK', { minimumFractionDigits: 2 })}
                        </span>
                      </td>

                      {/* Status Badge */}
                      <td className="p-4 text-center">
                        <span
                          className={cn(
                            'px-2.5 py-1 rounded-full text-[10px] font-bold uppercase font-mono border',
                            g.status === 'PAID'
                              ? isDark ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' : 'bg-emerald-50 text-emerald-700 border-emerald-200'
                              : g.status === 'PARTIAL'
                              ? isDark ? 'bg-amber-500/10 text-amber-400 border-amber-500/20' : 'bg-amber-50 text-amber-700 border-amber-200'
                              : isDark ? 'bg-rose-500/10 text-rose-400 border-rose-500/20' : 'bg-rose-50 text-rose-700 border-rose-200'
                          )}
                        >
                          {g.status}
                        </span>
                      </td>

                      {/* Receipt Bill Thumbnails with Lightbox Trigger */}
                      <td className="p-4 text-center" onClick={(e) => e.stopPropagation()}>
                        {imagesList.length > 0 ? (
                          <div className="flex items-center justify-center gap-1">
                            {imagesList.slice(0, 2).map((img, idx) => {
                              const url = normalizeImageUrl(typeof img === 'string' ? img : img.url);
                              const isDocPdf = typeof img === 'object' ? img.fileType === 'pdf' || isPdfUrl(url) : isPdfUrl(url);

                              return (
                                <button
                                  key={idx}
                                  type="button"
                                  onClick={(e) => handleOpenLightbox(imagesList, idx, e)}
                                  className={cn(
                                    'relative w-8 h-8 rounded-lg overflow-hidden border transition-all hover:scale-110 shadow group/thumb',
                                    isDark ? 'border-slate-700 hover:border-cyan-400' : 'border-slate-200 hover:border-cyan-500'
                                  )}
                                  title={t('grn.clickToViewBill', 'Click to view high-resolution bill')}
                                >
                                  {isDocPdf ? (
                                    <div className={cn('w-full h-full flex items-center justify-center', isDark ? 'bg-slate-950 text-rose-400' : 'bg-rose-50 text-rose-600')}>
                                      <FileText className="w-4 h-4" />
                                    </div>
                                  ) : (
                                    <img
                                      src={url}
                                      alt="Bill thumbnail"
                                      referrerPolicy="no-referrer"
                                      className="w-full h-full object-cover"
                                    />
                                  )}
                                </button>
                              );
                            })}
                            {imagesList.length > 2 && (
                              <button
                                type="button"
                                onClick={(e) => handleOpenLightbox(imagesList, 2, e)}
                                className={cn(
                                  'w-8 h-8 rounded-lg border flex items-center justify-center text-[10px] font-bold font-mono transition-colors',
                                  isDark ? 'bg-slate-800 text-slate-300 border-slate-700 hover:bg-slate-700' : 'bg-slate-100 text-slate-700 border-slate-200 hover:bg-slate-200'
                                )}
                                title={t('grn.viewAllAttachments', 'View all attachments')}
                              >
                                +{imagesList.length - 2}
                              </button>
                            )}
                          </div>
                        ) : (
                          <span className={cn('text-[11px]', isDark ? 'text-slate-600' : 'text-slate-400')}>-</span>
                        )}
                      </td>

                      {/* Actions Menu */}
                      <td className="p-4 text-right" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center justify-end gap-1.5">
                          {/* Settle Quick Button */}
                          {due > 0 && (
                            <button
                              type="button"
                              onClick={() => handleOpenQuickSettle(g)}
                              className={cn(
                                'px-2.5 py-1 rounded-lg text-xs font-bold border transition-all flex items-center gap-1',
                                isDark
                                  ? 'bg-amber-500/10 text-amber-400 border-amber-500/30 hover:bg-amber-500/20'
                                  : 'bg-amber-50 text-amber-700 border-amber-200 hover:bg-amber-100'
                              )}
                              title={t('suppliers.settle', 'Settle')}
                            >
                              <Banknote className="w-3.5 h-3.5" />
                              {t('suppliers.settle', 'Settle')}
                            </button>
                          )}

                          {/* 3-Dots Portal Action Menu */}
                          <GRNRowActionMenu
                            grn={g}
                            onEdit={(grnObj) => handleOpenEditGrn(grnObj)}
                            onViewSettlements={(grnObj) => handleOpenSettlementHistory(grnObj)}
                            onSettle={(grnObj) => handleOpenQuickSettle(grnObj)}
                            onDelete={(grnObj) => handlePromptDelete(grnObj)}
                          />
                        </div>
                      </td>
                    </tr>
                  );
                })
              ) : isLoadingGrns ? (
                <>
                  {Array.from({ length: 8 }).map((_, rIdx) => (
                    <tr key={rIdx} className={cn('animate-pulse', isDark ? 'bg-slate-900/40' : 'bg-slate-50')}>
                      <td className="p-3"><div className={cn('h-4 rounded-full w-24', isDark ? 'bg-slate-800' : 'bg-slate-200')} /></td>
                      <td className="p-3"><div className={cn('h-4 rounded-full w-36', isDark ? 'bg-slate-800' : 'bg-slate-200')} /></td>
                      <td className="p-3"><div className={cn('h-4 rounded-full w-24', isDark ? 'bg-slate-800' : 'bg-slate-200')} /></td>
                      <td className="p-3"><div className={cn('h-4 rounded-full w-24', isDark ? 'bg-slate-800' : 'bg-slate-200')} /></td>
                      <td className="p-3"><div className={cn('h-4 rounded-full w-24', isDark ? 'bg-slate-800' : 'bg-slate-200')} /></td>
                      <td className="p-3"><div className={cn('h-4 rounded-full w-24', isDark ? 'bg-slate-800' : 'bg-slate-200')} /></td>
                      <td className="p-3"><div className={cn('h-6 rounded-full w-20', isDark ? 'bg-slate-800' : 'bg-slate-200')} /></td>
                      <td className="p-3"><div className={cn('h-6 rounded-lg w-28 ml-auto', isDark ? 'bg-slate-800' : 'bg-slate-200')} /></td>
                    </tr>
                  ))}
                </>
              ) : (
                <tr>
                  <td colSpan={8} className={cn('p-8 text-center text-xs', isDark ? 'text-slate-400' : 'text-slate-500')}>
                    {t('grn.noGrnsFound', 'No Goods Received Notes found matching your filters.')}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── Comprehensive GRN Form Modal (Create & Edit) ── */}
      <GRNFormModal
        isOpen={isGrnFormModalOpen}
        suppliers={suppliers}
        initialData={selectedGrnForEdit}
        onClose={() => {
          setIsGrnFormModalOpen(false);
          setSelectedGrnForEdit(null);
        }}
        onSuccess={() => {
          fetchGrns();
        }}
      />

      {/* ── Row-Level GRN Settlement History Modal ── */}
      <GRNSettlementHistoryModal
        isOpen={isSettlementHistoryModalOpen}
        grn={selectedGrnForSettlementHistory}
        onClose={() => {
          setIsSettlementHistoryModalOpen(false);
          setSelectedGrnForSettlementHistory(null);
        }}
        onGRNUpdated={handleGRNUpdated}
        onOpenSettlementModal={handleOpenQuickSettle}
      />

      {/* ── Quick Settlement Modal ── */}
      <SettlementModal
        isOpen={isQuickSettleModalOpen}
        supplier={settleTargetSupplier}
        targetGrn={settleTargetGrn}
        onClose={() => {
          setIsQuickSettleModalOpen(false);
          setSettleTargetSupplier(null);
          setSettleTargetGrn(null);
        }}
        onSettlementSuccess={() => {
          fetchGrns();
          fetchSuppliers();
        }}
        onSuccess={(resultData) => {
          fetchGrns();
          fetchSuppliers();
          if (resultData?.grn) {
            handleGRNUpdated(resultData.grn);
          } else if (settleTargetGrn?.id) {
            api.get<any>(`/grns/${settleTargetGrn.id}`).then((res) => {
              const fresh = res?.data || res;
              if (fresh?.id) {
                handleGRNUpdated(fresh);
              }
            }).catch(console.error);
          }
        }}
      />

      {/* ── Delete Confirmation Modal ── */}
      <DeleteConfirmationModal
        isOpen={isDeleteModalOpen}
        title={t('grn.deleteConfirmTitle', 'Delete Goods Received Note')}
        message={t('grn.deleteConfirmMessage', 'Are you sure you want to delete GRN #{{number}}? The outstanding due balance of Rs. {{amount}} will be reversed from the supplier\'s balance.', { number: grnToDelete?.grnNumber, amount: Number(grnToDelete?.dueAmount || 0).toFixed(2) })}
        onConfirm={handleConfirmDelete}
        onCancel={() => {
          setIsDeleteModalOpen(false);
          setGrnToDelete(null);
        }}
      />

      {/* ── Fullscreen Manual-Zoom Lightbox Modal ── */}
      {lightboxItems && (
        <LightboxModal
          items={lightboxItems}
          initialIndex={lightboxIndex}
          onClose={() => setLightboxItems(null)}
        />
      )}
    </div>
  );
}
