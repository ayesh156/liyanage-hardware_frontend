import React, { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { useQueryClient } from '@tanstack/react-query';
import { useTheme } from '../../contexts/ThemeContext';
import { GRN, SupplierSettlement } from '../../types';
import api from '../../lib/api';
import { toast } from 'react-toastify';
import { 
  History, Banknote, Calendar, CreditCard, 
  Trash2, Edit2, Check, X, Plus, Loader2,
  DollarSign, Clock, ShieldAlert, CheckCircle2,
  AlertTriangle, ArrowUpRight, FileText, Landmark
} from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { ThemedDateTimePicker } from '../ui/date-time-picker';
import { SmartNumberInput } from '../ui/smart-number-input';
import { SearchableSelect, SearchableSelectOption } from '../ui/searchable-select';
import { SettlementModal } from './SettlementModal';
import { cn } from '../../lib/utils';

import { invalidateSettlementCaches } from '../../hooks/useSettlements';

export interface GRNSettlementHistoryModalProps {
  /** Controls modal visibility */
  isOpen: boolean;
  /** Targeted GRN record */
  grn: GRN | null;
  /** Modal close callback handler */
  onClose: () => void;
  /** Callback fired when GRN settlement state updates */
  onGRNUpdated: (updatedGrn: GRN) => void;
  /** Optional callback to open dedicated settlement modal */
  onOpenSettlementModal?: (grn: GRN) => void;
}

/**
 * Row-Level Goods Received Note (GRN) Settlement History & Inline Ledger CRUD Modal.
 * 
 * Features:
 * - Wide container breathing naturally without horizontal overflow.
 * - Strict table column sizing: Date/Time (190px), Method (110px), Amount (130px), Notes (max 240px truncate), Actions (90px).
 * - Multi-Level Optimistic & Real-Time Sync across nested modal-over-modal boundaries.
 * - Direct hierarchical callback chaining via `onSettlementSuccess` and `onSuccess`.
 * - Aggressive multi-query cache invalidation cascade:
 *   - ['grn-settlements', grnId] & ['grn-settlements']
 *   - ['grns']
 *   - ['suppliers']
 *   - ['supplier-ledger']
 *   - ['pending-grns']
 * - Event-driven live reactivity listening to 'balance-updated', 'supplier-updated', 'grn-updated'.
 * - Instant optimistic UI row insertion and paid/due metric recomputation.
 * - Dynamic bilingual localization using `useTranslation()`.
 */
export const GRNSettlementHistoryModal: React.FC<GRNSettlementHistoryModalProps> = ({
  isOpen,
  grn,
  onClose,
  onGRNUpdated,
  onOpenSettlementModal,
}) => {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const { theme } = useTheme();
  const isDark = theme === 'dark';

  const [currentGrn, setCurrentGrn] = useState<GRN | null>(grn);
  const [settlements, setSettlements] = useState<SupplierSettlement[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  // Dedicated SettlementModal edit/create state
  const [isSettlementModalOpen, setIsSettlementModalOpen] = useState<boolean>(false);
  const [settlementToEdit, setSettlementToEdit] = useState<SupplierSettlement | null>(null);

  // Inline editing state
  const [editingSettlementId, setEditingSettlementId] = useState<string | null>(null);
  const [editAmount, setEditAmount] = useState<string>('');
  const [editMethod, setEditMethod] = useState<string>('CASH');
  const [editNote, setEditNote] = useState<string>('');
  const [editDate, setEditDate] = useState<string>('');
  const [isSavingEdit, setIsSavingEdit] = useState<boolean>(false);

  // New settlement inline form state
  const [isAddingNew, setIsAddingNew] = useState<boolean>(false);
  const [newAmount, setNewAmount] = useState<string>('');
  const [newMethod, setNewMethod] = useState<string>('CASH');
  const [newDate, setNewDate] = useState<string>(new Date().toISOString());
  const [newNote, setNewNote] = useState<string>('');
  const [isSubmittingNew, setIsSubmittingNew] = useState<boolean>(false);

  // Deletion state
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const paymentMethodOptions: SearchableSelectOption[] = [
    { value: 'CASH', label: t('grn.cash', 'Cash'), icon: <Banknote className="w-3.5 h-3.5 text-emerald-400" /> },
    { value: 'CHEQUE', label: t('grn.cheque', 'Cheque'), icon: <FileText className="w-3.5 h-3.5 text-purple-400" /> },
    { value: 'BANK_TRANSFER', label: t('grn.bankTransfer', 'Bank Transfer'), icon: <Landmark className="w-3.5 h-3.5 text-blue-400" /> },
  ];

  // Sync GRN when prop changes
  useEffect(() => {
    setCurrentGrn(grn);
  }, [grn]);

  // Fetch settlements for current GRN
  const fetchSettlements = useCallback(async () => {
    const targetId = currentGrn?.id || grn?.id;
    if (!targetId) return;
    setIsLoading(true);
    try {
      const res = await api.get<any>(`/grns/${targetId}/settlements`);
      const list = Array.isArray(res) ? res : res?.data || [];
      setSettlements(list);
    } catch (err: any) {
      console.error('Failed to fetch GRN settlements:', err);
      if (currentGrn?.settlements || grn?.settlements) {
        setSettlements(currentGrn?.settlements || grn?.settlements || []);
      }
    } finally {
      setIsLoading(false);
    }
  }, [currentGrn?.id, currentGrn?.settlements, grn?.id, grn?.settlements]);

  // Initial load and reset on open
  useEffect(() => {
    if (isOpen && (currentGrn?.id || grn?.id)) {
      fetchSettlements();
      setEditingSettlementId(null);
      setIsAddingNew(false);
      setIsSettlementModalOpen(false);
      setSettlementToEdit(null);
    }
  }, [isOpen, currentGrn?.id, grn?.id, fetchSettlements]);

  // Live event subscription for real-time background and cross-modal state sync
  useEffect(() => {
    if (!isOpen) return;
    const targetId = currentGrn?.id || grn?.id;
    if (!targetId) return;

    const handleSync = () => {
      fetchSettlements();
      // Re-fetch fresh GRN balances to ensure 100% zero-refresh accuracy
      api.get<any>(`/grns/${targetId}`)
        .then((res) => {
          const fresh = res?.data || res;
          if (fresh?.id) {
            setCurrentGrn(fresh);
            onGRNUpdated(fresh);
          }
        })
        .catch(console.error);
    };

    window.addEventListener('balance-updated', handleSync);
    window.addEventListener('supplier-updated', handleSync);
    window.addEventListener('grn-updated', handleSync);

    return () => {
      window.removeEventListener('balance-updated', handleSync);
      window.removeEventListener('supplier-updated', handleSync);
      window.removeEventListener('grn-updated', handleSync);
    };
  }, [isOpen, currentGrn?.id, grn?.id, fetchSettlements, onGRNUpdated]);

  // Open dedicated SettlementModal in edit mode
  const handleOpenEditModal = (s: SupplierSettlement) => {
    setSettlementToEdit(s);
    setIsSettlementModalOpen(true);
  };

  // Open dedicated SettlementModal in create mode
  const handleOpenCreateModal = () => {
    setSettlementToEdit(null);
    setIsSettlementModalOpen(true);
  };

  // Handle successful submission from SettlementModal with optimistic & real-time sync
  const handleSettlementModalSuccess = async (resultData: any) => {
    const targetGrnId = currentGrn?.id || grn?.id;
    
    // 1. Optimistic GRN & Settlements Synchronization
    if (resultData?.grn) {
      setCurrentGrn(resultData.grn);
      onGRNUpdated(resultData.grn);
    } else if (resultData?.settlement && currentGrn) {
      const addedSettlement: SupplierSettlement = resultData.settlement;
      const amt = Number(addedSettlement.amount || 0);
      
      // If we were editing
      if (settlementToEdit) {
        const oldAmt = Number(settlementToEdit.amount || 0);
        const diff = amt - oldAmt;
        const newPaid = Math.max(0, Number(currentGrn.paidAmount || 0) + diff);
        const total = Number(currentGrn.totalAmount || 0);
        const newDue = Math.max(0, total - newPaid);
        const newStatus = newDue === 0 ? 'PAID' : (newPaid > 0 ? 'PARTIAL' : 'DUE');
        
        const optimisticGrn: GRN = {
          ...currentGrn,
          paidAmount: newPaid,
          dueAmount: newDue,
          status: newStatus,
        };
        setCurrentGrn(optimisticGrn);
        onGRNUpdated(optimisticGrn);
        setSettlements((prev) =>
          prev.map((s) => (s.id === addedSettlement.id ? { ...s, ...addedSettlement } : s))
        );
      } else {
        // Adding new settlement
        const newPaid = Number(currentGrn.paidAmount || 0) + amt;
        const total = Number(currentGrn.totalAmount || 0);
        const newDue = Math.max(0, total - newPaid);
        const newStatus = newDue === 0 ? 'PAID' : (newPaid > 0 ? 'PARTIAL' : 'DUE');
        
        const optimisticGrn: GRN = {
          ...currentGrn,
          paidAmount: newPaid,
          dueAmount: newDue,
          status: newStatus,
        };
        setCurrentGrn(optimisticGrn);
        onGRNUpdated(optimisticGrn);
        setSettlements((prev) => [addedSettlement, ...prev.filter((s) => s.id !== addedSettlement.id)]);
      }
    }

    // 2. Immediate settlement re-fetch and query cache invalidation cascade
    fetchSettlements();
    await invalidateSettlementCaches(queryClient, targetGrnId);

    // 3. Confirm latest server authoritative state
    if (targetGrnId) {
      api.get<any>(`/grns/${targetGrnId}`).then((res) => {
        const freshGrn = res?.data || res;
        if (freshGrn?.id) {
          setCurrentGrn(freshGrn);
          onGRNUpdated(freshGrn);
        }
      }).catch(console.error);
    }
  };

  // Start inline editing
  const handleStartInlineEdit = (s: SupplierSettlement) => {
    setEditingSettlementId(s.id);
    setEditAmount(String(Number(s.amount) || 0));
    setEditMethod(s.paymentMethod || 'CASH');
    setEditNote(s.note || '');
    setEditDate(
      s.createdAt ? new Date(s.createdAt).toISOString() : new Date().toISOString()
    );
  };

  const handleCancelInlineEdit = () => {
    setEditingSettlementId(null);
  };

  // Submit inline edit
  const handleSaveInlineEdit = async (settlementId: string) => {
    const parsedAmount = parseFloat(editAmount);
    if (isNaN(parsedAmount) || parsedAmount <= 0) {
      toast.error('Please enter a valid settlement amount');
      return;
    }

    const currentItem = settlements.find((s) => s.id === settlementId);
    const oldAmount = currentItem ? Number(currentItem.amount) : 0;
    const amountDiff = parsedAmount - oldAmount;

    // Optimistic UI Update
    setSettlements((prev) =>
      prev.map((s) =>
        s.id === settlementId
          ? {
              ...s,
              amount: parsedAmount,
              paymentMethod: editMethod,
              note: editNote.trim(),
              createdAt: editDate ? new Date(editDate).toISOString() : s.createdAt,
            }
          : s
      )
    );

    if (currentGrn) {
      const updatedPaid = Math.max(0, Number(currentGrn.paidAmount || 0) + amountDiff);
      const total = Number(currentGrn.totalAmount || 0);
      const updatedDue = Math.max(0, total - updatedPaid);
      const updatedStatus = updatedDue === 0 ? 'PAID' : (updatedPaid > 0 ? 'PARTIAL' : 'DUE');

      const optimisticGrn: GRN = {
        ...currentGrn,
        paidAmount: updatedPaid,
        dueAmount: updatedDue,
        status: updatedStatus,
      };
      setCurrentGrn(optimisticGrn);
      onGRNUpdated(optimisticGrn);
    }

    setIsSavingEdit(true);
    try {
      const res = await api.put<{
        settlement: SupplierSettlement;
        grn: GRN | null;
      }>(`/grns/settlements/${settlementId}`, {
        amount: parsedAmount,
        paymentMethod: editMethod,
        note: editNote.trim(),
        createdAt: editDate ? new Date(editDate).toISOString() : undefined,
      });

      toast.success('Settlement record updated successfully');
      setEditingSettlementId(null);

      const targetGrnId = currentGrn?.id || grn?.id;
      await invalidateSettlementCaches(queryClient, targetGrnId);

      // Reconcile with server response
      fetchSettlements();
      if (res.grn) {
        setCurrentGrn(res.grn);
        onGRNUpdated(res.grn);
      }
    } catch (err: any) {
      toast.error(err?.message || 'Failed to update settlement');
      fetchSettlements();
    } finally {
      setIsSavingEdit(false);
    }
  };

  // Delete settlement
  const handleDelete = async (settlementId: string) => {
    if (!window.confirm(t('settlement.deleteConfirm', 'Are you sure you want to delete this payment record? The debt balance will be restored to the GRN and supplier ledger.'))) {
      return;
    }

    const itemToDelete = settlements.find((s) => s.id === settlementId);
    const deleteAmount = itemToDelete ? Number(itemToDelete.amount || 0) : 0;

    // Optimistic Removal
    setSettlements((prev) => prev.filter((s) => s.id !== settlementId));

    if (currentGrn) {
      const updatedPaid = Math.max(0, Number(currentGrn.paidAmount || 0) - deleteAmount);
      const total = Number(currentGrn.totalAmount || 0);
      const updatedDue = Math.max(0, total - updatedPaid);
      const updatedStatus = updatedDue === 0 ? 'PAID' : (updatedPaid > 0 ? 'PARTIAL' : 'DUE');

      const optimisticGrn: GRN = {
        ...currentGrn,
        paidAmount: updatedPaid,
        dueAmount: updatedDue,
        status: updatedStatus,
      };
      setCurrentGrn(optimisticGrn);
      onGRNUpdated(optimisticGrn);
    }

    setDeletingId(settlementId);
    try {
      const res = await api.delete<{ success: boolean; grn: GRN | null }>(
        `/grns/settlements/${settlementId}`
      );

      toast.success('Settlement payment deleted and balance restored');

      const targetGrnId = currentGrn?.id || grn?.id;
      await invalidateSettlementCaches(queryClient, targetGrnId);

      fetchSettlements();
      if (res.grn) {
        setCurrentGrn(res.grn);
        onGRNUpdated(res.grn);
      }
    } catch (err: any) {
      toast.error(err?.message || 'Failed to delete settlement');
      fetchSettlements();
    } finally {
      setDeletingId(null);
    }
  };

  // Add new payment settlement for this GRN with instant optimistic synchronization
  const handleAddNewPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentGrn) return;

    const parsedAmount = parseFloat(newAmount);
    if (isNaN(parsedAmount) || parsedAmount <= 0) {
      toast.error('Please enter a valid payment amount');
      return;
    }

    // 1. Optimistic Payment Insertion
    const tempId = `temp-${Date.now()}`;
    const optimisticSettlement: SupplierSettlement = {
      id: tempId,
      supplierId: currentGrn.supplierId,
      grnId: currentGrn.id,
      amount: parsedAmount,
      paymentMethod: newMethod,
      note: newNote.trim() || `Payment for GRN #${currentGrn.grnNumber}`,
      createdAt: newDate ? new Date(newDate).toISOString() : new Date().toISOString(),
    };

    setSettlements((prev) => [optimisticSettlement, ...prev.filter((s) => !s.id.startsWith('temp-'))]);

    // 2. Optimistic Parent & Top Metric Recalculation
    const updatedPaid = Number(currentGrn.paidAmount || 0) + parsedAmount;
    const total = Number(currentGrn.totalAmount || 0);
    const updatedDue = Math.max(0, total - updatedPaid);
    const updatedStatus = updatedDue === 0 ? 'PAID' : (updatedPaid > 0 ? 'PARTIAL' : 'DUE');

    const updatedGrnObj: GRN = {
      ...currentGrn,
      paidAmount: updatedPaid,
      dueAmount: updatedDue,
      status: updatedStatus,
    };

    setCurrentGrn(updatedGrnObj);
    onGRNUpdated(updatedGrnObj);

    setIsSubmittingNew(true);
    try {
      await api.post<{
        settlement: SupplierSettlement;
        supplier: any;
      }>(`/suppliers/${currentGrn.supplierId}/settle`, {
        amount: parsedAmount,
        paymentMethod: newMethod,
        note: newNote.trim() || `Payment for GRN #${currentGrn.grnNumber}`,
        grnId: currentGrn.id,
        createdAt: newDate ? new Date(newDate).toISOString() : undefined,
      });

      toast.success(`Payment of Rs. ${parsedAmount.toFixed(2)} recorded!`);
      setIsAddingNew(false);
      setNewAmount('');
      setNewNote('');

      const targetGrnId = currentGrn.id || grn?.id;
      await invalidateSettlementCaches(queryClient, targetGrnId);

      // Refresh full settlements and server state
      fetchSettlements();
      if (targetGrnId) {
        api.get<any>(`/grns/${targetGrnId}`).then((res) => {
          const fresh = res?.data || res;
          if (fresh?.id) {
            setCurrentGrn(fresh);
            onGRNUpdated(fresh);
          }
        }).catch(console.error);
      }
    } catch (err: any) {
      toast.error(err?.message || 'Failed to record payment');
      fetchSettlements();
    } finally {
      setIsSubmittingNew(false);
    }
  };

  if (!grn) return null;

  const totalAmount = Number(currentGrn?.totalAmount || 0);
  const paidAmount = Number(currentGrn?.paidAmount || 0);
  const dueAmount = Number(currentGrn?.dueAmount || 0);
  const status = currentGrn?.status || 'DUE';

  return (
    <>
      <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
        <DialogContent
          className={cn(
            'sm:max-w-4xl lg:max-w-5xl w-full max-h-[90vh] overflow-y-auto p-0 gap-0 rounded-2xl border shadow-2xl z-[9990]',
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
              <div className="p-2.5 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 text-white shadow-md shadow-emerald-500/20 shrink-0">
                <History className="w-5 h-5" />
              </div>
              <div>
                <DialogTitle className="text-sm font-bold tracking-tight flex items-center gap-2">
                  <span>{t('grn.settlementHistory', 'Settlement History')}</span>
                  <span className="text-[11px] font-mono font-bold px-2.5 py-0.5 rounded-full bg-cyan-500/10 text-cyan-400 border border-cyan-500/20">
                    #{currentGrn?.grnNumber}
                  </span>
                </DialogTitle>
                <DialogDescription className="text-[11px] text-slate-400 mt-0.5">
                  Supplier: <span className="font-semibold text-slate-300">{currentGrn?.supplier?.name}</span>
                  {currentGrn?.supplier?.companyName && ` (${currentGrn.supplier.companyName})`}
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>

          <div className="p-6 space-y-4 overflow-y-auto">
            {/* ── Summary Financial Metrics Header ── */}
            <div
              className={cn(
                'p-4 rounded-2xl border grid grid-cols-3 gap-3',
                isDark ? 'bg-slate-950/60 border-slate-800' : 'bg-slate-50 border-slate-200'
              )}
            >
              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
                  {t('grn.totalAmount', 'Total Bill Amount')}
                </span>
                <div className="text-base sm:text-lg font-black font-mono text-slate-100 mt-0.5">
                  Rs. {totalAmount.toLocaleString('en-LK', { minimumFractionDigits: 2 })}
                </div>
              </div>

              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-400 block">
                  {t('grn.paidAmount', 'Total Paid')}
                </span>
                <div className="text-base sm:text-lg font-black font-mono text-emerald-400 mt-0.5">
                  Rs. {paidAmount.toLocaleString('en-LK', { minimumFractionDigits: 2 })}
                </div>
              </div>

              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-rose-400 block">
                  {t('grn.dueBalance', 'Remaining Due')}
                </span>
                <div className="flex items-center gap-2 mt-0.5">
                  <span
                    className={cn(
                      'text-base sm:text-lg font-black font-mono',
                      dueAmount > 0 ? 'text-rose-400' : 'text-emerald-400'
                    )}
                  >
                    Rs. {dueAmount.toLocaleString('en-LK', { minimumFractionDigits: 2 })}
                  </span>
                  <span
                    className={cn(
                      'text-[10px] font-bold px-1.5 py-0.5 rounded-full uppercase font-mono border',
                      status === 'PAID'
                        ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30'
                        : status === 'PARTIAL'
                        ? 'bg-amber-500/15 text-amber-400 border-amber-500/30'
                        : 'bg-rose-500/15 text-rose-400 border-rose-500/30'
                    )}
                  >
                    {status}
                  </span>
                </div>
              </div>
            </div>

            {/* ── Quick Add Payment Section ── */}
            <div className="flex items-center justify-between pt-1">
              <span className="text-xs font-bold text-slate-300 flex items-center gap-1.5">
                <Banknote className="w-4 h-4 text-emerald-400" />
                {t('settlement.allSettlements', 'Payment Records')} ({settlements.length})
              </span>

              {dueAmount > 0 && !isAddingNew && (
                <button
                  type="button"
                  onClick={handleOpenCreateModal}
                  className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-bold bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 text-white shadow-md shadow-emerald-500/20 transition-all"
                >
                  <Plus className="w-3.5 h-3.5" />
                  {t('grn.recordPayment', 'Record Payment')}
                </button>
              )}
            </div>

            {/* New Payment Inline Form */}
            {isAddingNew && (
              <form
                onSubmit={handleAddNewPayment}
                className={cn(
                  'p-3.5 rounded-2xl border space-y-3 animate-in fade-in-50 duration-150',
                  isDark ? 'bg-emerald-950/20 border-emerald-500/30' : 'bg-emerald-50/50 border-emerald-200'
                )}
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-emerald-400 flex items-center gap-1.5">
                    <Banknote className="w-4 h-4" /> {t('settlement.recordSettlement', 'New Payment Settlement')}
                  </span>
                  <button
                    type="button"
                    onClick={() => setIsAddingNew(false)}
                    className="p-1 text-slate-400 hover:text-slate-200"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-4 gap-2.5">
                  <div>
                    <label className="text-[10px] font-semibold text-slate-400 uppercase mb-1 block">
                      {t('settlement.settlementAmount', 'Amount (Rs.)')} <span className="text-rose-500">*</span>
                    </label>
                    <SmartNumberInput
                      value={newAmount}
                      onChange={setNewAmount}
                      defaultValueOnEmpty="0"
                      prefix="Rs."
                      placeholder="0.00"
                      step="0.01"
                      className={cn(
                        'w-full h-9 text-xs rounded-xl border font-mono font-bold text-emerald-400',
                        isDark ? 'bg-slate-900 border-slate-700' : 'bg-white border-slate-300 text-emerald-600'
                      )}
                      autoFocus
                      required
                    />
                  </div>

                  <div>
                    <label className="text-[10px] font-semibold text-slate-400 uppercase mb-1 block">
                      {t('settlement.paymentMethod', 'Method')}
                    </label>
                    <SearchableSelect
                      options={paymentMethodOptions}
                      value={newMethod}
                      onValueChange={setNewMethod}
                      placeholder="Method"
                      className="h-9 text-xs"
                    />
                  </div>

                  <div>
                    <label className="text-[10px] font-semibold text-slate-400 uppercase mb-1 block">
                      {t('settlement.paymentDate', 'Date & Time')}
                    </label>
                    <ThemedDateTimePicker
                      value={newDate}
                      onChange={setNewDate}
                      theme={isDark ? 'dark' : 'light'}
                    />
                  </div>

                  <div>
                    <label className="text-[10px] font-semibold text-slate-400 uppercase mb-1 block">
                      {t('settlement.reference', 'Notes / Cheque #')}
                    </label>
                    <input
                      type="text"
                      placeholder="Reference note..."
                      value={newNote}
                      onChange={(e) => setNewNote(e.target.value)}
                      className={cn(
                        'w-full h-9 px-3 rounded-xl border text-xs',
                        isDark ? 'bg-slate-900 border-slate-700 text-white' : 'bg-white border-slate-300 text-slate-900'
                      )}
                    />
                  </div>
                </div>

                <div className="flex justify-end gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => setIsAddingNew(false)}
                    className="px-3 py-1.5 rounded-xl text-xs font-semibold border border-slate-700 text-slate-300 hover:bg-slate-800"
                  >
                    {t('common.cancel', 'Cancel')}
                  </button>
                  <button
                    type="submit"
                    disabled={isSubmittingNew || !newAmount || parseFloat(newAmount) <= 0}
                    className="flex items-center gap-1 px-3.5 py-1.5 rounded-xl text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white disabled:opacity-50"
                  >
                    {isSubmittingNew ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
                    {t('settlement.confirmPayment', 'Confirm Payment')}
                  </button>
                </div>
              </form>
            )}

            {/* ── Settlement Timeline History Table ── */}
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
                      <th className="p-3.5 w-[190px] shrink-0">{t('settlement.paymentDate', 'Date & Exact Time')}</th>
                      <th className="p-3.5 w-[110px] shrink-0">{t('settlement.paymentMethod', 'Method')}</th>
                      <th className="p-3.5 w-[130px] shrink-0 text-right">{t('settlement.settlementAmount', 'Amount Paid')}</th>
                      <th className="p-3.5 max-w-[240px] truncate">{t('settlement.reference', 'Reference / Notes')}</th>
                      <th className="p-3.5 w-[90px] shrink-0 text-center">{t('common.actions', 'Actions')}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/40">
                    {settlements.length > 0 ? (
                      settlements.map((s) => {
                        const isEditingThis = editingSettlementId === s.id;
                        const isDeleting = deletingId === s.id;

                        if (isEditingThis) {
                          return (
                            <tr key={s.id} className="bg-emerald-950/10 border-emerald-500/20">
                              <td colSpan={5} className="p-3">
                                <div className="grid grid-cols-1 sm:grid-cols-4 gap-2">
                                  <div>
                                    <label className="text-[10px] text-slate-400 font-semibold mb-1 block">Amount</label>
                                    <SmartNumberInput
                                      value={editAmount}
                                      onChange={setEditAmount}
                                      defaultValueOnEmpty="0"
                                      prefix="Rs."
                                      placeholder="0.00"
                                      step="0.01"
                                      className={cn(
                                        'w-full h-8 text-xs font-mono font-bold rounded-lg border',
                                        isDark ? 'bg-slate-900 border-slate-700 text-emerald-400' : 'bg-white border-slate-300'
                                      )}
                                      autoFocus
                                    />
                                  </div>
                                  <div>
                                    <label className="text-[10px] text-slate-400 font-semibold mb-1 block">Method</label>
                                    <SearchableSelect
                                      options={paymentMethodOptions}
                                      value={editMethod}
                                      onValueChange={setEditMethod}
                                      placeholder="Method"
                                      className="h-8 text-xs"
                                    />
                                  </div>
                                  <div>
                                    <label className="text-[10px] text-slate-400 font-semibold mb-1 block">Date & Time</label>
                                    <ThemedDateTimePicker
                                      value={editDate}
                                      onChange={setEditDate}
                                      theme={isDark ? 'dark' : 'light'}
                                    />
                                  </div>
                                  <div>
                                    <label className="text-[10px] text-slate-400 font-semibold mb-1 block">Note</label>
                                    <input
                                      type="text"
                                      value={editNote}
                                      onChange={(e) => setEditNote(e.target.value)}
                                      placeholder="Note..."
                                      className={cn(
                                        'w-full h-8 px-2 rounded-lg border text-xs',
                                        isDark ? 'bg-slate-900 border-slate-700 text-white' : 'bg-white border-slate-300'
                                      )}
                                    />
                                  </div>
                                </div>
                                <div className="flex justify-end gap-2 mt-2">
                                  <button
                                    type="button"
                                    onClick={handleCancelInlineEdit}
                                    className="px-2.5 py-1 rounded-lg text-xs border border-slate-700 text-slate-300 hover:bg-slate-800"
                                  >
                                    {t('common.cancel', 'Cancel')}
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => handleSaveInlineEdit(s.id)}
                                    disabled={isSavingEdit}
                                    className="flex items-center gap-1 px-3 py-1 rounded-lg text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white disabled:opacity-50"
                                  >
                                    {isSavingEdit ? <Loader2 className="w-3 h-3 animate-spin" /> : <Check className="w-3 h-3" />}
                                    {t('common.save', 'Save')}
                                  </button>
                                </div>
                              </td>
                            </tr>
                          );
                        }

                        return (
                          <tr
                            key={s.id}
                            className={cn(
                              'transition-colors',
                              isDark ? 'hover:bg-slate-800/30' : 'hover:bg-slate-50'
                            )}
                          >
                            {/* Date & Exact Time (190px shrink-0) */}
                            <td className="p-3.5 w-[190px] shrink-0 whitespace-nowrap">
                              <div className="font-mono font-bold text-slate-200 flex items-center gap-1.5">
                                <Calendar className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                                {new Date(s.createdAt).toLocaleDateString()}
                              </div>
                              <div className="text-[10px] text-slate-500 font-mono mt-0.5 flex items-center gap-1">
                                <Clock className="w-3 h-3 text-slate-600 shrink-0" />
                                {new Date(s.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                              </div>
                            </td>

                            {/* Payment Method Badge (110px shrink-0) */}
                            <td className="p-3.5 w-[110px] shrink-0 whitespace-nowrap">
                              <span
                                className={cn(
                                  'px-2 py-0.5 rounded-full text-[10px] font-bold uppercase font-mono border inline-block',
                                  s.paymentMethod === 'CHEQUE'
                                    ? 'bg-purple-500/10 text-purple-400 border-purple-500/20'
                                    : s.paymentMethod === 'BANK_TRANSFER'
                                    ? 'bg-blue-500/10 text-blue-400 border-blue-500/20'
                                    : 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                                )}
                              >
                                {s.paymentMethod || 'CASH'}
                              </span>
                            </td>

                            {/* Amount Paid (130px shrink-0 text-right) */}
                            <td className="p-3.5 w-[130px] shrink-0 text-right font-mono font-bold text-sm text-emerald-400 whitespace-nowrap">
                              Rs. {Number(s.amount).toLocaleString('en-LK', { minimumFractionDigits: 2 })}
                            </td>

                            {/* Reference / Note (Flexible with max-w-[240px] truncate) */}
                            <td className="p-3.5 text-slate-400 max-w-[240px] truncate" title={s.note || undefined}>
                              {s.note || <span className="text-slate-600">-</span>}
                            </td>

                            {/* Actions: Dedicated SettlementModal Edit & Delete (90px shrink-0 text-center) */}
                            <td className="p-3.5 w-[90px] shrink-0 text-center whitespace-nowrap">
                              <div className="flex items-center justify-center gap-1.5">
                                <button
                                  type="button"
                                  onClick={() => handleOpenEditModal(s)}
                                  className="p-1.5 rounded-lg border border-slate-700 bg-slate-800/80 hover:bg-slate-700 text-slate-300 hover:text-white transition-colors"
                                  title="Edit settlement payment details"
                                >
                                  <Edit2 className="w-3.5 h-3.5" />
                                </button>

                                <button
                                  type="button"
                                  onClick={() => handleDelete(s.id)}
                                  disabled={isDeleting}
                                  className="p-1.5 rounded-lg border border-rose-500/30 bg-rose-500/10 hover:bg-rose-500 hover:text-white text-rose-400 transition-colors disabled:opacity-50"
                                  title="Delete payment record & restore balance"
                                >
                                  {isDeleting ? (
                                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                  ) : (
                                    <Trash2 className="w-3.5 h-3.5" />
                                  )}
                                </button>
                              </div>
                            </td>
                          </tr>
                        );
                      })
                    ) : (
                      <tr>
                        <td colSpan={5} className="p-8 text-center text-slate-400 text-xs">
                          {isLoading ? (
                            <div className="flex items-center justify-center gap-2">
                              <Loader2 className="w-4 h-4 animate-spin text-orange-400" />
                              Loading settlement logs...
                            </div>
                          ) : (
                            'No payment records found for this Goods Received Note.'
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
              'px-6 py-3 border-t flex items-center justify-end shrink-0',
              isDark ? 'border-slate-800 bg-slate-900/80' : 'border-slate-200 bg-slate-50/50'
            )}
          >
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

      {/* ── Dedicated Standalone Settlement Modal (for Create & Edit modes) ── */}
      {isSettlementModalOpen && (
        <SettlementModal
          isOpen={isSettlementModalOpen}
          onClose={() => {
            setIsSettlementModalOpen(false);
            setSettlementToEdit(null);
          }}
          grn={currentGrn}
          supplier={currentGrn?.supplier || null}
          settlementToEdit={settlementToEdit}
          onSettlementSuccess={() => {
            fetchSettlements();
            const targetId = currentGrn?.id || grn?.id;
            if (targetId) {
              api.get<any>(`/grns/${targetId}`).then((res) => {
                const fresh = res?.data || res;
                if (fresh?.id) {
                  setCurrentGrn(fresh);
                  onGRNUpdated(fresh);
                }
              }).catch(console.error);
            }
          }}
          onSuccess={handleSettlementModalSuccess}
        />
      )}
    </>
  );
};

export default GRNSettlementHistoryModal;
