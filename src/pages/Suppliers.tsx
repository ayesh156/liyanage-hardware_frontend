import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { useTheme } from '../contexts/ThemeContext';
import { useIsMobile } from '../hooks/use-mobile';
import { useLoading } from '../contexts/LoadingContext';
import { Supplier } from '../types';
import api from '../lib/api';
import { 
  Truck, Plus, Search, RefreshCw, Edit2, Trash2, 
  Banknote, Phone, Smartphone, MapPin, Building2, 
  ShieldAlert, Sparkles, Layers, ArrowUpRight
} from 'lucide-react';
import { SupplierFormModal } from '../components/modals/SupplierFormModal';
import { GRNFormModal } from '../components/modals/GRNFormModal';
import { SupplierPendingGRNsModal } from '../components/modals/SupplierPendingGRNsModal';
import { SupplierLedgerModal } from '../components/modals/SupplierLedgerModal';
import { DeleteConfirmationModal } from '../components/modals/DeleteConfirmationModal';
import { SupplierRowActionMenu } from '../components/suppliers/SupplierRowActionMenu';
import { toast } from 'react-toastify';
import { cn } from '../lib/utils';

/**
 * Dedicated Supplier Management Directory Page.
 * 
 * Features:
 * - Dedicated strictly to Supplier profiles, company details, contact numbers, and starting balances.
 * - Live ledger balance tracking with debt alerts.
 * - Floating portal 3-dots action menu with Add GRN, Settle Balance, Edit, and Delete actions.
 * - Reliance pattern SupplierPendingGRNsModal for settling outstanding GRNs.
 * - Clean navigation integration with Goods Received Notes (`/grn`).
 */
export default function SuppliersPage() {
  const { t } = useTranslation();
  const { theme } = useTheme();
  const { startLoading, finishLoading } = useLoading();
  const navigate = useNavigate();
  const isDark = theme === 'dark';
  const isMobile = useIsMobile();

  // Suppliers State
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [isLoadingSuppliers, setIsLoadingSuppliers] = useState<boolean>(true);
  const [supplierSearch, setSupplierSearch] = useState<string>('');
  const [supplierSummary, setSupplierSummary] = useState<{ totalOutstanding: number; totalStartingBalance: number }>({
    totalOutstanding: 0,
    totalStartingBalance: 0,
  });

  // Modal States
  const [isSupplierModalOpen, setIsSupplierModalOpen] = useState<boolean>(false);
  const [selectedSupplierForEdit, setSelectedSupplierForEdit] = useState<Supplier | undefined>(undefined);

  const [isGrnModalOpen, setIsGrnModalOpen] = useState<boolean>(false);
  const [preselectedSupplierIdForGrn, setPreselectedSupplierIdForGrn] = useState<string | undefined>(undefined);

  const [isPendingGrnsModalOpen, setIsPendingGrnsModalOpen] = useState<boolean>(false);
  const [selectedSupplierForPendingGrns, setSelectedSupplierForPendingGrns] = useState<Supplier | null>(null);

  const [isLedgerModalOpen, setIsLedgerModalOpen] = useState<boolean>(false);
  const [selectedSupplierForLedger, setSelectedSupplierForLedger] = useState<Supplier | null>(null);

  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState<boolean>(false);
  const [supplierToDelete, setSupplierToDelete] = useState<Supplier | null>(null);

  // ── Fetch Suppliers from Live Backend ──
  const fetchSuppliers = useCallback(async (isInitial = false) => {
    if (isInitial) {
      startLoading('Loading supplier directory & ledgers...');
    }
    setIsLoadingSuppliers(true);
    try {
      const res = await api.get<{
        data: Supplier[];
        meta: any;
        summary: { totalOutstanding: number; totalStartingBalance: number };
      }>('/suppliers', { search: supplierSearch || undefined }, true);

      if (res && res.data) {
        setSuppliers(res.data);
        if (res.summary) {
          setSupplierSummary(res.summary);
        }
      }
    } catch (err: any) {
      console.error('Failed to fetch suppliers:', err);
      toast.error(err?.message || 'Failed to load suppliers from server');
    } finally {
      setIsLoadingSuppliers(false);
      if (isInitial) {
        finishLoading();
      }
    }
  }, [supplierSearch, startLoading, finishLoading]);

  // Initial Route Load synchronization
  useEffect(() => {
    let mounted = true;
    const loadInitialData = async () => {
      startLoading('Loading supplier directory & ledgers...');
      setIsLoadingSuppliers(true);
      try {
        const res = await api.get<{
          data: Supplier[];
          meta: any;
          summary: { totalOutstanding: number; totalStartingBalance: number };
        }>('/suppliers', undefined, true);

        if (mounted && res && res.data) {
          setSuppliers(res.data);
          if (res.summary) {
            setSupplierSummary(res.summary);
          }
        }
      } catch (err: any) {
        console.error('Failed to fetch initial suppliers:', err);
      } finally {
        if (mounted) {
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

  // Debounced search effect for non-initial searches
  useEffect(() => {
    const timer = setTimeout(() => {
      fetchSuppliers(false);
    }, 250);
    return () => clearTimeout(timer);
  }, [supplierSearch]);

  // ── Live Optimistic State Refresh on Settlement / Updates ──
  useEffect(() => {
    const handleSync = () => {
      fetchSuppliers(false);
    };
    window.addEventListener('balance-updated', handleSync);
    window.addEventListener('supplier-updated', handleSync);
    window.addEventListener('grn-updated', handleSync);
    return () => {
      window.removeEventListener('balance-updated', handleSync);
      window.removeEventListener('supplier-updated', handleSync);
      window.removeEventListener('grn-updated', handleSync);
    };
  }, [fetchSuppliers]);

  // ── Handlers ──
  const handleOpenAddSupplier = () => {
    setSelectedSupplierForEdit(undefined);
    setIsSupplierModalOpen(true);
  };

  const handleOpenEditSupplier = (supplier: Supplier) => {
    setSelectedSupplierForEdit(supplier);
    setIsSupplierModalOpen(true);
  };

  const handleOpenAddGrn = (preselectSupplierId?: string) => {
    setPreselectedSupplierIdForGrn(preselectSupplierId);
    setIsGrnModalOpen(true);
  };

  const handleOpenSettleSupplier = (supplier: Supplier) => {
    setSelectedSupplierForPendingGrns(supplier);
    setIsPendingGrnsModalOpen(true);
  };

  const handleOpenLedger = (supplier: Supplier) => {
    setSelectedSupplierForLedger(supplier);
    setIsLedgerModalOpen(true);
  };

  const handlePromptDeleteSupplier = (supplier: Supplier) => {
    setSupplierToDelete(supplier);
    setIsDeleteModalOpen(true);
  };

  const handleConfirmDelete = async () => {
    if (!supplierToDelete) return;
    try {
      await api.delete(`/suppliers/${supplierToDelete.id}`);
      toast.success(`Supplier "${supplierToDelete.name}" deleted successfully`);
      fetchSuppliers();
    } catch (err: any) {
      toast.error(err?.message || 'Failed to delete supplier');
    } finally {
      setIsDeleteModalOpen(false);
      setSupplierToDelete(null);
    }
  };

  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-6 max-w-[1600px] mx-auto min-h-screen">
      {/* ── Top Header Bar ── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-black tracking-tight flex items-center gap-2.5 text-slate-100">
            <div className="p-2.5 rounded-2xl bg-gradient-to-br from-amber-500 to-orange-600 text-white shadow-lg shadow-orange-500/25">
              <Truck className="w-6 h-6" />
            </div>
            <span>{t('suppliers.title', 'Suppliers Directory')}</span>
          </h1>
          <p className="text-xs sm:text-sm text-slate-400 mt-1">
            {t('suppliers.subtitle', 'Supplier directory, company details, contact numbers, and starting balances')}
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            onClick={() => fetchSuppliers()}
            className={cn(
              'p-2.5 rounded-xl border transition-all duration-200 focus:outline-none',
              isDark
                ? 'border-slate-800 bg-slate-900/80 hover:bg-slate-800 text-slate-300'
                : 'border-slate-200 bg-white hover:bg-slate-100 text-slate-700 shadow-sm'
            )}
            title="Refresh Live Data"
          >
            <RefreshCw className={cn('w-4 h-4', isLoadingSuppliers && 'animate-spin text-orange-400')} />
          </button>

          <button
            onClick={() => navigate('/grn')}
            className="flex items-center gap-2 px-3.5 py-2.5 rounded-xl text-xs sm:text-sm font-bold border border-cyan-500/30 bg-cyan-500/10 hover:bg-cyan-500/20 text-cyan-400 transition-all"
          >
            <Layers className="w-4 h-4" />
            {t('suppliers.viewGrns', 'View GRNs')}
          </button>

          <button
            onClick={handleOpenAddSupplier}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs sm:text-sm font-bold bg-gradient-to-r from-orange-500 to-rose-600 hover:from-orange-600 hover:to-rose-700 text-white shadow-lg shadow-orange-500/25 transition-all"
          >
            <Plus className="w-4 h-4" />
            {t('suppliers.addSupplier', 'Add Supplier')}
          </button>
        </div>
      </div>

      {/* ── Key Metrics Overview Cards ── */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4">
        {/* Total Suppliers */}
        <div
          className={cn(
            'p-4 rounded-2xl border relative overflow-hidden transition-all',
            isDark ? 'bg-slate-900/90 border-slate-800/80 shadow-lg' : 'bg-white border-slate-200 shadow-sm'
          )}
        >
          <div className="flex items-center justify-between mb-2">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
              {t('suppliers.totalSuppliers', 'Total Suppliers')}
            </span>
            <div className="w-8 h-8 rounded-xl bg-orange-500/10 text-orange-400 flex items-center justify-center border border-orange-500/20">
              <Building2 className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-black tracking-tight text-slate-100 font-mono">
            {suppliers.length}
          </div>
          <p className="text-[10px] text-slate-400 mt-1">{t('suppliers.activeVendors', 'Active hardware distributors & vendors')}</p>
        </div>

        {/* Total Starting Balance */}
        <div
          className={cn(
            'p-4 rounded-2xl border relative overflow-hidden transition-all',
            isDark ? 'bg-slate-900/90 border-slate-800/80 shadow-lg' : 'bg-white border-slate-200 shadow-sm'
          )}
        >
          <div className="flex items-center justify-between mb-2">
            <span className="text-[11px] font-bold uppercase tracking-wider text-amber-400">
              {t('suppliers.startingBalance', 'Initial Starting Balance')}
            </span>
            <div className="w-8 h-8 rounded-xl bg-amber-500/10 text-amber-400 flex items-center justify-center border border-amber-500/20">
              <Banknote className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-black tracking-tight text-amber-400 font-mono">
            Rs. {supplierSummary.totalStartingBalance.toLocaleString('en-LK', { minimumFractionDigits: 2 })}
          </div>
          <p className="text-[10px] text-slate-400 mt-1">{t('suppliers.openingAccountsTotal', 'Opening accounts balance total')}</p>
        </div>

        {/* Outstanding Supplier Debt */}
        <div
          className={cn(
            'p-4 rounded-2xl border relative overflow-hidden transition-all',
            isDark ? 'bg-slate-900/90 border-slate-800/80 shadow-lg' : 'bg-white border-slate-200 shadow-sm'
          )}
        >
          <div className="flex items-center justify-between mb-2">
            <span className="text-[11px] font-bold uppercase tracking-wider text-rose-400">
              {t('suppliers.totalOutstanding', 'Total Outstanding Due')}
            </span>
            <div className="w-8 h-8 rounded-xl bg-rose-500/10 text-rose-400 flex items-center justify-center border border-rose-500/20">
              <ShieldAlert className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-black tracking-tight text-rose-500 font-mono">
            Rs. {supplierSummary.totalOutstanding.toLocaleString('en-LK', { minimumFractionDigits: 2 })}
          </div>
          <p className="text-[10px] text-slate-400 mt-1">{t('suppliers.liveUnpaidDebt', 'Live unpaid debt to settle across suppliers')}</p>
        </div>
      </div>

      {/* ── Filter and Search Controls ── */}
      <div className="flex items-center gap-3">
        <div
          className={cn(
            'flex-1 p-2.5 px-3 rounded-2xl border flex items-center gap-2.5 w-full',
            isDark ? 'bg-slate-900/80 border-slate-800' : 'bg-white border-slate-200 shadow-sm'
          )}
        >
          <Search className="w-4 h-4 text-slate-400 shrink-0" />
          <input
            type="text"
            placeholder={t('suppliers.searchTablePlaceholder', 'Search suppliers by name, company, phone number, or address...')}
            value={supplierSearch}
            onChange={(e) => setSupplierSearch(e.target.value)}
            className={cn(
              'w-full bg-transparent border-none text-xs sm:text-sm focus:outline-none',
              isDark ? 'text-white placeholder-slate-500' : 'text-slate-900 placeholder-slate-400'
            )}
          />
        </div>
      </div>

      {/* ── Suppliers Table ── */}
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
                <th className="p-4">{t('suppliers.supplierName', 'Supplier Name')}</th>
                <th className="p-4">{t('suppliers.companyName', 'Company Name')}</th>
                <th className="p-4">{t('suppliers.contacts', 'Contact Numbers')}</th>
                <th className="p-4">{t('suppliers.address', 'Address')}</th>
                <th className="p-4 text-right">{t('suppliers.startingBalance', 'Starting Balance')}</th>
                <th className="p-4 text-right">{t('suppliers.currentBalance', 'Current Due Balance')}</th>
                <th className="p-4 text-center">{t('suppliers.grnsCount', 'GRNs')}</th>
                <th className="p-4 text-right">{t('common.actions', 'Actions')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/50">
              {suppliers.length > 0 ? (
                suppliers.map((s) => {
                  const curBalance = Number(s.currentBalance || 0);
                  const hasDue = curBalance > 0;

                  return (
                    <tr
                      key={s.id}
                      className={cn(
                        'transition-colors',
                        isDark ? 'hover:bg-slate-800/40' : 'hover:bg-slate-50'
                      )}
                    >
                      {/* Name */}
                      <td className="p-4 font-bold text-slate-100 flex items-center gap-2">
                        <div className="w-7 h-7 rounded-lg bg-orange-500/10 text-orange-400 flex items-center justify-center font-bold text-xs shrink-0">
                          {s.name.charAt(0).toUpperCase()}
                        </div>
                        <span className="truncate">{s.name}</span>
                      </td>

                      {/* Company Name */}
                      <td className="p-4 font-medium text-slate-300">
                        {s.companyName || <span className="text-slate-500 italic">{t('suppliers.individual', 'Individual')}</span>}
                      </td>

                      {/* Contact Numbers */}
                      <td className="p-4">
                        <div className="space-y-0.5">
                          {s.mobileNumber && (
                            <div className="flex items-center gap-1.5 font-mono text-[11px] text-slate-300">
                              <Smartphone className="w-3 h-3 text-orange-400 shrink-0" />
                              <span>{s.mobileNumber}</span>
                            </div>
                          )}
                          {s.telephoneNumber && (
                            <div className="flex items-center gap-1.5 font-mono text-[11px] text-slate-400">
                              <Phone className="w-3 h-3 text-slate-500 shrink-0" />
                              <span>{s.telephoneNumber}</span>
                            </div>
                          )}
                          {!s.mobileNumber && !s.telephoneNumber && (
                            <span className="text-slate-500 text-[11px]">-</span>
                          )}
                        </div>
                      </td>

                      {/* Address */}
                      <td className="p-4 max-w-xs truncate text-slate-400">
                        {s.address ? (
                          <div className="flex items-center gap-1.5 text-[11px] truncate">
                            <MapPin className="w-3 h-3 text-slate-500 shrink-0" />
                            <span className="truncate">{s.address}</span>
                          </div>
                        ) : (
                          <span className="text-slate-500">-</span>
                        )}
                      </td>

                      {/* Starting Balance */}
                      <td className="p-4 text-right font-mono text-slate-400 font-medium">
                        Rs. {Number(s.startingBalance || 0).toLocaleString('en-LK', { minimumFractionDigits: 2 })}
                      </td>

                      {/* Current Balance */}
                      <td className="p-4 text-right">
                        <span
                          className={cn(
                            'font-mono font-bold text-sm',
                            hasDue ? 'text-rose-400' : 'text-emerald-400'
                          )}
                        >
                          Rs. {curBalance.toLocaleString('en-LK', { minimumFractionDigits: 2 })}
                        </span>
                        {hasDue && (
                          <span className="block text-[10px] text-rose-500 font-medium">
                            {t('suppliers.outstandingDue', 'Outstanding Due')}
                          </span>
                        )}
                      </td>

                      {/* GRNs Count button */}
                      <td className="p-4 text-center">
                        <button
                          type="button"
                          onClick={() => navigate('/grn')}
                          className="px-2.5 py-1 rounded-full text-[11px] font-bold bg-slate-800 hover:bg-slate-700 text-cyan-400 border border-slate-700 transition-colors inline-flex items-center gap-1"
                          title={t('suppliers.viewGrns', 'View GRNs')}
                        >
                          <span>{s.grnsCount || 0} {t('suppliers.grnsCount', 'GRNs')}</span>
                          <ArrowUpRight className="w-3 h-3" />
                        </button>
                      </td>

                      {/* Actions Menu */}
                      <td className="p-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          {hasDue && (
                            <button
                              type="button"
                              onClick={() => handleOpenSettleSupplier(s)}
                              className="px-2.5 py-1 rounded-lg text-xs font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 hover:bg-emerald-500/20 transition-all flex items-center gap-1"
                              title={t('suppliers.settle', 'Settle')}
                            >
                              <Banknote className="w-3.5 h-3.5" />
                              {t('suppliers.settle', 'Settle')}
                            </button>
                          )}

                          <SupplierRowActionMenu
                            supplier={s}
                            onViewLedger={(supp) => handleOpenLedger(supp)}
                            onAddGrn={(suppId) => handleOpenAddGrn(suppId)}
                            onSettle={(supp) => handleOpenSettleSupplier(supp)}
                            onEdit={(supp) => handleOpenEditSupplier(supp)}
                            onDelete={(supp) => handlePromptDeleteSupplier(supp)}
                          />
                        </div>
                      </td>
                    </tr>
                  );
                })
              ) : isLoadingSuppliers ? (
                <>
                  {Array.from({ length: 8 }).map((_, rIdx) => (
                    <tr key={rIdx} className="animate-pulse bg-slate-900/40">
                      <td className="p-3"><div className="h-4 rounded-full w-28 bg-slate-800" /></td>
                      <td className="p-3"><div className="h-4 rounded-full w-36 bg-slate-800" /></td>
                      <td className="p-3"><div className="h-4 rounded-full w-28 bg-slate-800" /></td>
                      <td className="p-3"><div className="h-4 rounded-full w-32 bg-slate-800" /></td>
                      <td className="p-3"><div className="h-4 rounded-full w-24 bg-slate-800" /></td>
                      <td className="p-3"><div className="h-4 rounded-full w-24 bg-slate-800" /></td>
                      <td className="p-3"><div className="h-6 rounded-full w-20 bg-slate-800" /></td>
                      <td className="p-3"><div className="h-6 rounded-lg w-28 ml-auto bg-slate-800" /></td>
                    </tr>
                  ))}
                </>
              ) : (
                <tr>
                  <td colSpan={8} className="p-8 text-center text-slate-400 text-xs">
                    {t('suppliers.noSuppliersQuery', 'No suppliers found matching your query.')}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── Supplier Form Modal (Add & Edit) ── */}
      <SupplierFormModal
        isOpen={isSupplierModalOpen}
        supplier={selectedSupplierForEdit}
        onClose={() => {
          setIsSupplierModalOpen(false);
          setSelectedSupplierForEdit(undefined);
        }}
        onSuccess={() => {
          fetchSuppliers();
        }}
      />

      {/* ── GRN Creation Modal from Supplier Quick Action ── */}
      <GRNFormModal
        isOpen={isGrnModalOpen}
        suppliers={suppliers}
        initialSupplierId={preselectedSupplierIdForGrn}
        onClose={() => {
          setIsGrnModalOpen(false);
          setPreselectedSupplierIdForGrn(undefined);
        }}
        onSuccess={() => {
          fetchSuppliers();
        }}
      />

      {/* ── Supplier Pending GRNs Settlement Modal (Reliance Pattern) ── */}
      <SupplierPendingGRNsModal
        isOpen={isPendingGrnsModalOpen}
        supplier={selectedSupplierForPendingGrns}
        onClose={() => {
          setIsPendingGrnsModalOpen(false);
          setSelectedSupplierForPendingGrns(null);
        }}
        onSuccess={() => {
          fetchSuppliers();
        }}
      />

      {/* ── Comprehensive Supplier Ledger View Modal ── */}
      <SupplierLedgerModal
        isOpen={isLedgerModalOpen}
        supplierId={selectedSupplierForLedger?.id || null}
        onClose={() => {
          setIsLedgerModalOpen(false);
          setSelectedSupplierForLedger(null);
        }}
        onOpenSettle={(supp) => {
          setIsLedgerModalOpen(false);
          handleOpenSettleSupplier(supp);
        }}
        onOpenAddGrn={(suppId) => {
          setIsLedgerModalOpen(false);
          handleOpenAddGrn(suppId);
        }}
      />

      {/* ── Delete Confirmation Modal ── */}
      <DeleteConfirmationModal
        isOpen={isDeleteModalOpen}
        title={t('suppliers.deleteSupplierConfirmTitle', 'Delete Supplier')}
        message={t('suppliers.deleteSupplierConfirmMessage', 'Are you sure you want to delete "{{name}}"? All associated historical records will be safely handled.', { name: supplierToDelete?.name })}
        onConfirm={handleConfirmDelete}
        onCancel={() => {
          setIsDeleteModalOpen(false);
          setSupplierToDelete(null);
        }}
      />
    </div>
  );
}
