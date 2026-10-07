import React, { useState, useEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useQueryClient } from '@tanstack/react-query';
import { useTheme } from '../../contexts/ThemeContext';
import { Supplier, GRN, SupplierSettlement } from '../../types';
import api from '../../lib/api';
import { toast } from 'react-toastify';
import {
  Banknote, Landmark, CreditCard, CheckCircle2,
  Loader2, Calculator, ShieldCheck, DollarSign, FileText, Calendar, Edit3
} from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { ThemedDateTimePicker } from '../ui/date-time-picker';
import { cn } from '../../lib/utils';

import { invalidateSettlementCaches } from '../../hooks/useSettlements';

export interface SettlementModalProps {
  /** Controls modal visibility */
  isOpen: boolean;
  /** Modal close callback handler */
  onClose: () => void;
  /** Targeted supplier profile for ledger-level settlement */
  supplier?: Supplier | null;
  /** Targeted GRN for bill-level settlement */
  grn?: GRN | null;
  /** Alias for targeted GRN */
  targetGrn?: GRN | null;
  /** Existing settlement record when opened in edit mode */
  settlementToEdit?: SupplierSettlement | null;
  /** Callback returning updated data (new settlement or updated settlement + GRN) */
  onSuccess?: (updatedData?: any) => void;
  /** Direct Hierarchical Callback for nested modals and parent synchronization */
  onSettlementSuccess?: () => void;
}

/**
 * Reusable modal for settling supplier ledger balances and individual GRN dues,
 * or editing existing settlement records.
 * 
 * Features:
 * - Direct Hierarchical Callback Chaining via `onSettlementSuccess` and `onSuccess`.
 * - Prepopulates target GRN outstanding balance or existing settlement record.
 * - Dedicated static left adornment ("Rs.") with guaranteed non-overlapping spacing.
 * - Decoupled Date and Time pickers (Reliance pattern).
 * - Live debt and supplier balance recalculation upon edit/create.
 * - Aggressive multi-query cache invalidation cascade on mutation success:
 *   - ['grn-settlements', grnId] & ['grn-settlements']
 *   - ['grns']
 *   - ['suppliers']
 *   - ['supplier-ledger']
 *   - ['pending-grns']
 * - Real-time custom DOM event dispatch ('balance-updated', 'supplier-updated', 'grn-updated').
 * - Dynamic bilingual localization using `useTranslation()`.
 */
export const SettlementModal: React.FC<SettlementModalProps> = ({
  isOpen,
  onClose,
  supplier,
  grn,
  targetGrn,
  settlementToEdit,
  onSuccess,
  onSettlementSuccess,
}) => {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const { theme } = useTheme();
  const isDark = theme === 'dark';
  const effectiveGrn = grn || targetGrn;
  const isEditing = Boolean(settlementToEdit?.id);

  const [paymentAmountStr, setPaymentAmountStr] = useState<string>('');
  const [paymentMethod, setPaymentMethod] = useState<'CASH' | 'CHEQUE' | 'BANK_TRANSFER'>('CASH');
  const [paymentDate, setPaymentDate] = useState<string>(new Date().toISOString());
  const [note, setNote] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  // Compute default reference note
  const defaultReference = useMemo(() => {
    if (effectiveGrn?.grnNumber) {
      return `Settlement for GRN #${effectiveGrn.grnNumber}`;
    }
    if (supplier?.name) {
      return `Settlement for ${supplier.name}`;
    }
    return '';
  }, [effectiveGrn, supplier]);

  // Compute outstanding balance based on target entity
  const outstandingBalance = useMemo(() => {
    if (effectiveGrn) {
      return Number(effectiveGrn.dueAmount || 0);
    }
    if (supplier) {
      return Number(supplier.currentBalance || 0);
    }
    return 0;
  }, [supplier, effectiveGrn]);

  useEffect(() => {
    if (isOpen) {
      if (settlementToEdit) {
        // Pre-fill existing settlement in edit mode
        setPaymentAmountStr(String(Number(settlementToEdit.amount) || 0));
        setPaymentMethod((settlementToEdit.paymentMethod as any) || 'CASH');
        setPaymentDate(
          settlementToEdit.createdAt
            ? new Date(settlementToEdit.createdAt).toISOString()
            : new Date().toISOString()
        );
        setNote(settlementToEdit.note || '');
      } else {
        // Create mode
        if (effectiveGrn && Number(effectiveGrn.dueAmount) > 0) {
          setPaymentAmountStr(String(Number(effectiveGrn.dueAmount)));
        } else {
          setPaymentAmountStr('');
        }
        setPaymentMethod('CASH');
        setPaymentDate(new Date().toISOString());
        setNote(defaultReference);
      }
      setIsSubmitting(false);
    }
  }, [isOpen, supplier, effectiveGrn, settlementToEdit, defaultReference]);

  if (!isOpen || (!supplier && !effectiveGrn && !settlementToEdit)) return null;

  const paymentAmount = parseFloat(paymentAmountStr) || 0;
  const remainingBalance = Math.max(0, outstandingBalance - paymentAmount);

  const handleFullPay = () => {
    setPaymentAmountStr(outstandingBalance.toFixed(2));
  };

  const handleQuickAmount = (ratio: number) => {
    const val = (outstandingBalance * ratio).toFixed(2);
    setPaymentAmountStr(val);
  };

  const handlePaymentMethodChange = (newMethod: 'CASH' | 'CHEQUE' | 'BANK_TRANSFER') => {
    setPaymentMethod(newMethod);
    if (newMethod === 'CHEQUE') {
      // When Cheque is selected: leave input strictly empty
      if (note === defaultReference || note.startsWith('Settlement for')) {
        setNote('');
      }
    } else {
      // When Cash or Bank Transfer is selected: default to Settlement for GRN #[grnNumber]
      if (!note.trim() || note === '') {
        setNote(defaultReference);
      }
    }
  };

  const handleNoteFocus = (e: React.FocusEvent<HTMLInputElement>) => {
    if (paymentMethod !== 'CHEQUE' && note === defaultReference) {
      setNote('');
    } else {
      e.target.select();
    }
  };

  const handleNoteBlur = () => {
    if (paymentMethod !== 'CHEQUE' && !note.trim()) {
      setNote(defaultReference);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (paymentAmount <= 0) {
      toast.error(t('settlement.invalidAmountError', 'Please enter a valid payment amount greater than zero'));
      return;
    }

    if (!isEditing && paymentAmount > outstandingBalance + 0.01) {
      toast.warning('Payment amount exceeds current outstanding balance.');
    }

    setIsSubmitting(true);
    try {
      if (isEditing && settlementToEdit?.id) {
        // PUT /api/grns/settlements/:settlementId
        const payload = {
          amount: paymentAmount,
          paymentMethod,
          note: note.trim() || undefined,
          createdAt: paymentDate ? new Date(paymentDate).toISOString() : undefined,
        };

        const res = await api.put<any>(`/grns/settlements/${settlementToEdit.id}`, payload);
        const data = res?.data || res;

        toast.success(
          `Settlement payment of Rs. ${paymentAmount.toLocaleString('en-LK', { minimumFractionDigits: 2 })} updated successfully!`
        );

        // Aggressive Cache Invalidation & Real-Time Event Cascade
        const targetGrnId = settlementToEdit.grnId || effectiveGrn?.id;
        await invalidateSettlementCaches(queryClient, targetGrnId);

        if (onSettlementSuccess) {
          onSettlementSuccess();
        }
        if (onSuccess) {
          onSuccess(data);
        }
        onClose();
      } else {
        // POST /api/suppliers/:supplierId/settle
        const supplierId = supplier?.id || effectiveGrn?.supplierId;
        if (!supplierId) {
          throw new Error('Supplier identifier is missing');
        }

        const payload = {
          amount: paymentAmount,
          paymentMethod,
          note: note.trim() || undefined,
          grnId: effectiveGrn?.id || undefined,
          createdAt: paymentDate ? new Date(paymentDate).toISOString() : undefined,
        };

        const response = await api.post(`/suppliers/${supplierId}/settle`, payload);

        toast.success(
          `Payment of Rs. ${paymentAmount.toLocaleString('en-LK', { minimumFractionDigits: 2 })} recorded successfully!`
        );

        // Aggressive Cache Invalidation & Real-Time Event Cascade
        const targetGrnId = effectiveGrn?.id;
        await invalidateSettlementCaches(queryClient, targetGrnId);

        if (onSettlementSuccess) {
          onSettlementSuccess();
        }
        if (onSuccess) {
          onSuccess(response);
        }
        onClose();
      }
    } catch (err: any) {
      toast.error(err?.message || (isEditing ? 'Failed to update settlement' : 'Failed to record settlement payment'));
    } finally {
      setIsSubmitting(false);
    }
  };

  const inputClass = cn(
    'w-full h-10 px-3 rounded-xl border text-xs font-medium transition-all focus:outline-none focus:ring-1',
    isDark
      ? 'border-slate-700/60 bg-slate-900/60 text-white placeholder:text-slate-500 focus:border-emerald-500/80 focus:ring-emerald-500/30'
      : 'border-slate-300 bg-white text-slate-900 placeholder:text-slate-400 focus:border-emerald-500/80 focus:ring-emerald-500/30 shadow-sm'
  );

  const labelClass = 'text-[11px] font-semibold tracking-wide uppercase text-slate-400 flex items-center gap-1.5 mb-1';

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent
        className={cn(
          'max-w-xl w-full max-h-[92vh] overflow-y-auto p-0 gap-0 rounded-2xl border shadow-2xl z-[9999]',
          isDark ? 'bg-slate-900 border-slate-800 text-white' : 'bg-white border-slate-200 text-slate-900'
        )}
      >
        <form onSubmit={handleSubmit} className="flex flex-col h-full">
          {/* Header */}
          <DialogHeader
            className={cn(
              'px-5 py-3.5 border-b flex flex-row items-center justify-between',
              isDark ? 'border-slate-800 bg-slate-900/80' : 'border-slate-200 bg-slate-50/50'
            )}
          >
            <div className="flex items-center gap-2.5 text-left">
              <div className="p-2 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 text-white shadow-md shadow-emerald-500/20 shrink-0">
                {isEditing ? <Edit3 className="w-4 h-4" /> : <Banknote className="w-4 h-4" />}
              </div>
              <div>
                <DialogTitle className="text-sm font-bold tracking-tight">
                  {isEditing
                    ? t('settlement.editSettlement', 'Edit Settlement')
                    : t('settlement.recordSettlement', 'Record Settlement')}
                </DialogTitle>
                <DialogDescription className="text-[11px] text-slate-400 mt-0.5">
                  {effectiveGrn
                    ? `For GRN #${effectiveGrn.grnNumber} (${effectiveGrn.supplier?.name || supplier?.name || ''})`
                    : `Supplier Ledger: ${supplier?.name || ''}`}
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>

          {/* Form Content */}
          <div className="p-5 space-y-3.5 overflow-y-auto">
            {/* Outstanding Balance Banner (Only in Create Mode) */}
            {!isEditing && (
              <div
                className={cn(
                  'p-3.5 rounded-xl border flex items-center justify-between',
                  isDark ? 'bg-slate-950/60 border-slate-800' : 'bg-slate-50 border-slate-200 shadow-sm'
                )}
              >
                <div>
                  <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 block mb-0.5">
                    {t('grn.dueBalance', 'Outstanding Balance')}
                  </span>
                  <div className="text-base font-black text-rose-400 tracking-tight font-mono">
                    Rs. {outstandingBalance.toLocaleString('en-LK', { minimumFractionDigits: 2 })}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={handleFullPay}
                  className="px-2.5 py-1 rounded-lg text-xs font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 hover:bg-emerald-500/20 transition-all flex items-center gap-1"
                >
                  <Calculator className="w-3 h-3" />
                  {t('grn.payFull', 'Pay Full')}
                </button>
              </div>
            )}

            {/* Payment Amount Input with Non-Overlapping Static Left Adornment */}
            <div>
              <label className={labelClass}>
                <DollarSign className="w-3.5 h-3.5 text-emerald-400" />
                {t('settlement.settlementAmount', 'Settlement Amount')} <span className="text-rose-500">*</span>
              </label>

              <div className="relative flex items-center">
                <span className="absolute left-3.5 text-xs font-bold text-slate-400 select-none pointer-events-none z-10">
                  Rs.
                </span>
                <input
                  type="number"
                  value={paymentAmountStr}
                  onChange={(e) => setPaymentAmountStr(e.target.value)}
                  onFocus={(e) => {
                    const v = paymentAmountStr.trim();
                    if (v === '0' || v === '0.00' || v === '0.0') {
                      setPaymentAmountStr('');
                    } else {
                      e.target.select();
                    }
                  }}
                  onBlur={() => {
                    if (paymentAmountStr.trim() === '') {
                      setPaymentAmountStr('0');
                    }
                  }}
                  placeholder="0.00"
                  step="0.01"
                  min="0.01"
                  className={cn(
                    'w-full pl-12 pr-4 h-10 text-sm font-semibold rounded-xl bg-slate-900/60 border border-slate-700/60 text-emerald-400 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500/30 font-mono transition-all',
                    !isDark && 'bg-white border-slate-300 text-emerald-600 focus:border-emerald-500 shadow-sm'
                  )}
                  autoFocus
                  required
                />
              </div>

              {/* Quick Ratio Pills (Only in Create Mode) */}
              {!isEditing && (
                <div className="flex items-center gap-1.5 mt-2">
                  {[0.25, 0.5, 0.75, 1].map((ratio) => (
                    <button
                      key={ratio}
                      type="button"
                      onClick={() => handleQuickAmount(ratio)}
                      className={cn(
                        'flex-1 py-1 rounded-lg text-[10px] font-semibold transition-colors text-center border',
                        isDark
                          ? 'bg-slate-800 hover:bg-slate-700 text-slate-300 border-slate-700'
                          : 'bg-slate-100 hover:bg-slate-200 text-slate-700 border-slate-200'
                      )}
                    >
                      {ratio * 100}%
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Decoupled Payment Date & Time Picker (Inline Cluster) */}
            <div className="w-fit">
              <label className={labelClass}>
                <Calendar className="w-3.5 h-3.5 text-orange-500" />
                {t('settlement.paymentDate', 'Payment Date & Time')}
              </label>
              <ThemedDateTimePicker
                value={paymentDate}
                onChange={setPaymentDate}
                theme={isDark ? 'dark' : 'light'}
              />
            </div>

            {/* Payment Method Selector */}
            <div>
              <label className={labelClass}>
                <CreditCard className="w-3.5 h-3.5 text-orange-500" />
                {t('settlement.paymentMethod', 'Payment Method')}
              </label>
              <div className="grid grid-cols-3 gap-2">
                {[
                  { id: 'CASH', label: t('grn.cash', 'Cash'), icon: Banknote },
                  { id: 'CHEQUE', label: t('grn.cheque', 'Cheque'), icon: FileText },
                  { id: 'BANK_TRANSFER', label: t('grn.bankTransfer', 'Bank Transfer'), icon: Landmark },
                ].map((pm) => {
                  const Icon = pm.icon;
                  const isSelected = paymentMethod === pm.id;
                  return (
                    <button
                      key={pm.id}
                      type="button"
                      onClick={() => handlePaymentMethodChange(pm.id as any)}
                      className={cn(
                        'flex flex-col items-center justify-center py-2 px-1 rounded-xl border text-[11px] font-semibold transition-all',
                        isSelected
                          ? 'bg-emerald-500/15 border-emerald-500 text-emerald-400 shadow-md shadow-emerald-500/10'
                          : isDark
                            ? 'bg-slate-900/60 border-slate-700/60 text-slate-400 hover:bg-slate-800'
                            : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                      )}
                    >
                      <Icon className="w-4 h-4 mb-0.5" />
                      {pm.label}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Note / Reference with Intelligent Clearing */}
            <div>
              <label className={labelClass}>
                <FileText className="w-3.5 h-3.5 text-orange-500" />
                {paymentMethod === 'CHEQUE'
                  ? t('grn.chequeNumber', 'Cheque / Ref No.')
                  : t('settlement.reference', 'Reference / Cheque No')}
              </label>
              <input
                type="text"
                placeholder={
                  paymentMethod === 'CHEQUE'
                    ? t('settlement.enterChequeDetails', 'Enter Cheque No & Bank details...')
                    : t('settlement.enterNotesDetails', 'e.g. Cash settlement / Bank Transfer ref...')
                }
                value={note}
                onChange={(e) => setNote(e.target.value)}
                onFocus={handleNoteFocus}
                onBlur={handleNoteBlur}
                className={inputClass}
              />
            </div>

            {/* Remaining Balance Summary */}
            {!isEditing && paymentAmount > 0 && (
              <div
                className={cn(
                  'p-2.5 rounded-xl border flex items-center justify-between text-xs',
                  isDark ? 'bg-slate-950/40 border-slate-800' : 'bg-slate-50 border-slate-200'
                )}
              >
                <span className="text-slate-400 text-[11px]">{t('settlement.remainingDue', 'Remaining Due Balance')}:</span>
                <span className="font-mono font-bold text-slate-200">
                  Rs. {remainingBalance.toLocaleString('en-LK', { minimumFractionDigits: 2 })}
                </span>
              </div>
            )}
          </div>

          {/* Footer */}
          <DialogFooter
            className={cn(
              'px-5 py-3 border-t flex flex-row items-center justify-end gap-2 sm:gap-2 shrink-0',
              isDark ? 'border-slate-800 bg-slate-900/90' : 'border-slate-200 bg-slate-50'
            )}
          >
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className={cn(
                'px-4 py-2 rounded-xl text-xs font-semibold transition-colors',
                isDark
                  ? 'bg-slate-800 hover:bg-slate-700 text-slate-300'
                  : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
              )}
            >
              {t('common.cancel', 'Cancel')}
            </button>
            <button
              type="submit"
              disabled={isSubmitting || paymentAmount <= 0}
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 text-white shadow-lg shadow-emerald-500/20 transition-all disabled:opacity-50"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  {isEditing ? t('common.saving', 'Saving...') : t('common.saving', 'Saving...')}
                </>
              ) : (
                <>
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  {isEditing
                    ? t('settlement.updateSettlement', 'Update Settlement')
                    : t('settlement.confirmPayment', 'Confirm Payment')}
                </>
              )}
            </button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default SettlementModal;
