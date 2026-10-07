import React, { useState, useEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useTheme } from '../../contexts/ThemeContext';
import { Supplier, GRN, GRNImageItem } from '../../types';
import api from '../../lib/api';
import { toast } from 'react-toastify';
import { 
  PackagePlus, Building2, Calendar, DollarSign, 
  Plus, Trash2, Loader2, Layers, CheckCircle2,
  FileText, Hash, CreditCard, Edit2, ShieldAlert,
  Banknote
} from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { SearchableSelect, SearchableSelectOption } from '../ui/searchable-select';
import { ThemedDateTimePicker } from '../ui/date-time-picker';
import { SmartNumberInput } from '../ui/smart-number-input';
import { GRNAttachmentDropzone } from '../suppliers/GRNAttachmentDropzone';
import { cn } from '../../lib/utils';

export interface GRNFormModalProps {
  isOpen: boolean;
  suppliers: Supplier[];
  initialSupplierId?: string;
  initialData?: GRN | null;
  onClose: () => void;
  onSuccess: (savedGrn: GRN) => void;
}

export const GRNFormModal: React.FC<GRNFormModalProps> = ({
  isOpen,
  suppliers,
  initialSupplierId,
  initialData,
  onClose,
  onSuccess,
}) => {
  const { t } = useTranslation();
  const { theme } = useTheme();
  const isDark = theme === 'dark';
  const isEditMode = !!initialData;

  const paymentMethodOptions: SearchableSelectOption[] = useMemo(() => [
    { value: 'CASH', label: t('grn.cash', 'Cash'), icon: <Banknote className="w-3.5 h-3.5 text-emerald-400" /> },
    { value: 'CHEQUE', label: t('grn.cheque', 'Cheque'), icon: <FileText className="w-3.5 h-3.5 text-purple-400" /> },
    { value: 'BANK_TRANSFER', label: t('grn.bankTransfer', 'Bank Transfer'), icon: <CreditCard className="w-3.5 h-3.5 text-blue-400" /> },
  ], [t]);

  // Form states
  const [grnNumber, setGrnNumber] = useState<string>('');
  const [supplierId, setSupplierId] = useState<string>('');
  const [date, setDate] = useState<string>(new Date().toISOString());
  const [summaryTotal, setSummaryTotal] = useState<string>('');
  const [paidAmountStr, setPaidAmountStr] = useState<string>('0');
  
  // Upfront settlement payment fields
  const [paymentMethod, setPaymentMethod] = useState<string>('CASH');
  const [paymentDate, setPaymentDate] = useState<string>(new Date().toISOString());
  const [paymentNote, setPaymentNote] = useState<string>('');

  const [notes, setNotes] = useState<string>('');

  // Itemized breakdown
  const [useItemization, setUseItemization] = useState<boolean>(true);
  const [items, setItems] = useState<Array<{ name: string; unitPrice: number | string; qty: number | string; subtotal: number }>>([
    { name: '', unitPrice: '', qty: 1, subtotal: 0 },
  ]);

  // Image attachments
  const [images, setImages] = useState<GRNImageItem[]>([]);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  // Initialize or preload state on open
  useEffect(() => {
    if (!isOpen) return;

    if (initialData) {
      // ── Edit Mode ──
      setGrnNumber(initialData.grnNumber || '');
      setSupplierId(initialData.supplierId || '');
      setDate(
        initialData.createdAt
          ? new Date(initialData.createdAt).toISOString()
          : new Date().toISOString()
      );
      setSummaryTotal(String(Number(initialData.totalAmount) || 0));
      setPaidAmountStr(String(Number(initialData.paidAmount) || 0));
      setPaymentMethod('CASH');
      setPaymentDate(new Date().toISOString());
      setPaymentNote('');
      setNotes(initialData.notes || '');

      // Line items
      if (initialData.items && initialData.items.length > 0) {
        setUseItemization(true);
        setItems(
          initialData.items.map((it) => ({
            name: it.name,
            unitPrice: Number(it.unitPrice) || 0,
            qty: Number(it.qty) || 1,
            subtotal: Number(it.subtotal) || Number(it.unitPrice) * Number(it.qty),
          }))
        );
      } else {
        setUseItemization(false);
        setItems([{ name: '', unitPrice: '', qty: 1, subtotal: 0 }]);
      }

      // Attachments
      if (initialData.images && Array.isArray(initialData.images)) {
        const parsedImages: GRNImageItem[] = (initialData.images as any[]).map((img) => {
          if (typeof img === 'string') {
            return { url: img, name: 'Attachment', source: 'upload' };
          }
          return img;
        });
        setImages(parsedImages);
      } else {
        setImages([]);
      }
    } else {
      /**
       * Initializes auto-generated GRN sequence identifier.
       * Attempts backend lookup (`/grns/next-number`), falling back to compact `GRN` + `YYMMDD` + 3-digit sequence.
       * Example: `GRN261007001`
       */
      const initNextNumber = async () => {
        try {
          const res = await api.get<{ grnNumber: string }>('/grns/next-number');
          if (res?.grnNumber) {
            setGrnNumber(res.grnNumber);
          }
        } catch {
          const now = new Date();
          const yy = String(now.getFullYear()).slice(-2);
          const mm = String(now.getMonth() + 1).padStart(2, '0');
          const dd = String(now.getDate()).padStart(2, '0');
          const randomSuffix = String(Math.floor(1 + Math.random() * 99)).padStart(3, '0');
          setGrnNumber(`GRN${yy}${mm}${dd}${randomSuffix}`);
        }
      };

      initNextNumber();
      setSupplierId(initialSupplierId || (suppliers.length > 0 ? suppliers[0].id : ''));
      setDate(new Date().toISOString());
      setSummaryTotal('');
      setPaidAmountStr('0');
      setPaymentMethod('CASH');
      setPaymentDate(new Date().toISOString());
      setPaymentNote('');
      setNotes('');
      setUseItemization(true);
      setItems([{ name: '', unitPrice: '', qty: 1, subtotal: 0 }]);
      setImages([]);
    }
  }, [isOpen, initialData, initialSupplierId, suppliers]);

  // Supplier Options for SearchableSelect
  const supplierOptions: SearchableSelectOption[] = useMemo(() => {
    return suppliers.map((s) => ({
      value: s.id,
      label: s.companyName ? `${s.name} (${s.companyName})` : s.name,
      icon: <Building2 className="w-3.5 h-3.5 text-orange-500 shrink-0" />,
    }));
  }, [suppliers]);

  /**
   * Calculates the running sub-total from all itemized line entries.
   *
   * Only relevant when `useItemization === true`.
   * When itemization is disabled, `summaryTotal` is used directly as the bill amount.
   *
   * @returns {number} Sum of (unitPrice × qty) across all line item rows.
   */
  const calculatedItemsTotal = useMemo(() => {
    return items.reduce((acc, it) => acc + (Number(it.subtotal) || 0), 0);
  }, [items]);

  /**
   * Resolves the final canonical bill total.
   *
   * - Itemization ENABLED  → auto-computed from line items (calculatedItemsTotal).
   * - Itemization DISABLED → manual entry via summaryTotal input field.
   *
   * @type {number}
   */
  const finalTotalAmount = useItemization ? calculatedItemsTotal : (parseFloat(summaryTotal) || 0);

  /** Numeric representation of the paid/down-payment amount. */
  const paidAmount = parseFloat(paidAmountStr) || 0;

  /**
   * Remaining due balance after deducting the upfront payment.
   *
   * Edge cases:
   * - If `paidAmount >= finalTotalAmount`: balance is 0 (fully settled or advance credit).
   * - If `paidAmount > finalTotalAmount`: the overage becomes a credit balance tracked
   *   separately; this function deliberately clamps to 0 to avoid negative balance errors.
   * - Credit advance is gracefully allowed; no validation error is thrown.
   *
   * Formula: dueAmount = Math.max(0, totalAmount - paidAmount)
   *
   * @type {number}
   */
  const calculatedDueAmount = Math.max(0, finalTotalAmount - paidAmount);

  /**
   * Detects when the user has paid MORE than the stated bill total,
   * creating a supplier credit/advance balance situation.
   *
   * @type {boolean}
   */
  const isAdvancePayment = paidAmount > 0 && paidAmount > finalTotalAmount;

  // Recalculate item line subtotal
  const handleItemChange = (index: number, field: 'name' | 'unitPrice' | 'qty', value: string) => {
    const updated = [...items];
    const current = { ...updated[index], [field]: value };

    const unitPrice = parseFloat(String(current.unitPrice)) || 0;
    const qty = parseFloat(String(current.qty)) || 0;
    current.subtotal = unitPrice * qty;

    updated[index] = current;
    setItems(updated);
  };

  const addItemRow = () => {
    setItems([...items, { name: '', unitPrice: '', qty: 1, subtotal: 0 }]);
  };

  const removeItemRow = (index: number) => {
    if (items.length <= 1) {
      setItems([{ name: '', unitPrice: '', qty: 1, subtotal: 0 }]);
      return;
    }
    setItems(items.filter((_, i) => i !== index));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!supplierId) {
      toast.error(t('grn.selectSupplierError', 'Please select a supplier'));
      return;
    }

    if (finalTotalAmount <= 0) {
      toast.error('Total GRN amount must be greater than zero');
      return;
    }

    setIsSubmitting(true);
    try {
      const validItems = useItemization
        ? items
            .filter((it) => it.name.trim() || Number(it.subtotal) > 0)
            .map((it) => ({
              name: it.name.trim() || 'General Hardware Item',
              unitPrice: Number(it.unitPrice) || 0,
              qty: Number(it.qty) || 1,
              subtotal: Number(it.subtotal) || 0,
            }))
        : undefined;

      const payload = {
        grnNumber: grnNumber.trim(),
        supplierId,
        totalAmount: finalTotalAmount,
        paidAmount,
        paymentMethod: paidAmount > 0 ? paymentMethod : undefined,
        paymentNote: paidAmount > 0 ? paymentNote.trim() : undefined,
        paymentDate: paidAmount > 0 ? paymentDate : undefined,
        notes: notes.trim() || undefined,
        images: images.length > 0 ? images : undefined,
        items: validItems && validItems.length > 0 ? validItems : undefined,
        createdAt: date ? new Date(date).toISOString() : undefined,
      };

      let result: GRN;
      if (isEditMode && initialData) {
        result = await api.put<GRN>(`/grns/${initialData.id}`, payload);
        toast.success(`GRN #${result.grnNumber} updated successfully!`);
      } else {
        result = await api.post<GRN>('/grns', payload);
        toast.success(`GRN #${result.grnNumber} recorded successfully!`);
      }

      onSuccess(result);
      onClose();
    } catch (err: any) {
      toast.error(err?.message || 'Failed to save GRN');
    } finally {
      setIsSubmitting(false);
    }
  };

  const inputClass = cn(
    'w-full h-9 px-3 rounded-xl border text-xs font-medium transition-all focus:outline-none focus:ring-1',
    isDark
      ? 'border-slate-700/60 bg-slate-900/60 text-white placeholder:text-slate-500 focus:border-orange-500/80 focus:ring-orange-500/30'
      : 'border-slate-300 bg-white text-slate-900 placeholder:text-slate-400 focus:border-orange-500/80 focus:ring-orange-500/30 shadow-sm'
  );

  const labelClass = 'text-[11px] font-semibold tracking-wide uppercase text-slate-400 flex items-center gap-1.5 mb-1';

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent
        className={cn(
          'sm:max-w-3xl max-h-[92vh] overflow-y-auto p-0 gap-0 rounded-2xl border shadow-2xl',
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
              <div className="p-2 rounded-xl bg-gradient-to-br from-orange-500 to-rose-500 text-white shadow-md shadow-orange-500/20">
                {isEditMode ? <Edit2 className="w-4 h-4" /> : <PackagePlus className="w-4 h-4" />}
              </div>
              <div>
                <DialogTitle className="text-sm font-bold tracking-tight flex items-center gap-2">
                  {isEditMode ? t('grn.editGrnTitle', 'Edit Goods Received Note') : t('grn.newGrnTitle', 'New Goods Received Note')}
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-orange-500/10 text-orange-400 border border-orange-500/20">
                    {isEditMode ? t('grn.modifyRecord', 'Modify Record') : t('grn.stockEntry', 'Stock Entry')}
                  </span>
                </DialogTitle>
                <DialogDescription className="text-[11px] text-slate-400 mt-0.5">
                  {isEditMode
                    ? t('grn.editGrnSubtitle', 'Update line items, total amounts, and synchronized ledger balances')
                    : t('grn.newGrnSubtitle', 'Record incoming supplier stock, upload bills, and calculate live balances')}
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>

          {/* Body Content */}
          <div className="p-5 space-y-4 overflow-y-auto overflow-x-hidden">
            {/* ── Row 1: GRN Number & Supplier (Spacious 2-Column Grid) ── */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className={labelClass}>
                  <Hash className="w-3.5 h-3.5 text-orange-500" />
                  {t('grn.grnNumber', 'GRN Number')} <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={grnNumber}
                  onChange={(e) => setGrnNumber(e.target.value)}
                  className={cn(inputClass, 'font-mono font-bold text-orange-400')}
                />
              </div>

              <div>
                <label className={labelClass}>
                  <Building2 className="w-3.5 h-3.5 text-orange-500" />
                  {t('grn.supplier', 'Supplier')} <span className="text-rose-500">*</span>
                </label>
                <SearchableSelect
                  options={supplierOptions}
                  value={supplierId}
                  onValueChange={setSupplierId}
                  placeholder={t('grn.filterBySupplier', 'Select supplier...')}
                  searchPlaceholder="Search supplier name..."
                  theme={isDark ? 'dark' : 'light'}
                  triggerClassName={cn(
                    'h-9 text-xs rounded-xl',
                    isDark
                      ? 'border-slate-700/60 bg-slate-900/60 text-white hover:bg-slate-800'
                      : 'border-slate-300 bg-white text-slate-900 hover:bg-slate-50'
                  )}
                />
              </div>
            </div>

            {/* ── Row 2: Dedicated Arrival Date & Time Row (Tight Inline Cluster) ── */}
            <div className="w-fit">
              <label className={labelClass}>
                <Calendar className="w-3.5 h-3.5 text-orange-500" />
                {t('grn.arrivalDateTime', 'Arrival Date & Time')}
              </label>
              <ThemedDateTimePicker
                value={date}
                onChange={setDate}
                theme={isDark ? 'dark' : 'light'}
              />
            </div>

            {/* Financial Summary & Due Balance Box */}
            <div
              className={cn(
                'p-3.5 rounded-xl border grid grid-cols-1 sm:grid-cols-3 gap-3',
                isDark ? 'bg-slate-950/50 border-slate-800' : 'bg-slate-50 border-slate-200'
              )}
            >
              {/* Total Bill Amount */}
              <div>
                <span className={labelClass}>
                  <DollarSign className="w-3.5 h-3.5 text-orange-500" />
                  {t('grn.totalAmount', 'Total Bill Amount')}
                </span>
                {useItemization ? (
                  <div className="font-mono font-bold text-base text-slate-100 h-9 flex items-center">
                    Rs. {calculatedItemsTotal.toLocaleString('en-LK', { minimumFractionDigits: 2 })}
                  </div>
                ) : (
                  <SmartNumberInput
                    value={summaryTotal}
                    onChange={setSummaryTotal}
                    defaultValueOnEmpty="0"
                    prefix="Rs."
                    placeholder="0.00"
                    step="0.01"
                    min="0"
                    className={cn(inputClass, 'font-mono font-bold text-slate-100')}
                  />
                )}
              </div>

              {/* Paid Down Payment */}
              <div>
                <span className={labelClass}>
                  <CreditCard className="w-3.5 h-3.5 text-emerald-500" />
                  {t('grn.paidAmount', 'Paid Amount')}
                </span>
                <SmartNumberInput
                  value={paidAmountStr}
                  onChange={setPaidAmountStr}
                  defaultValueOnEmpty="0"
                  prefix="Rs."
                  placeholder="0.00"
                  step="0.01"
                  min="0"
                  className={cn(inputClass, 'font-mono font-bold text-emerald-400')}
                />
              </div>

              {/* Outstanding Due Balance — shows credit note if advance payment detected */}
              <div>
                <span className={labelClass}>
                  <ShieldAlert className={cn('w-3.5 h-3.5', isAdvancePayment ? 'text-blue-400' : 'text-rose-500')} />
                  {isAdvancePayment
                    ? t('grn.advanceCredit', 'Advance Credit')
                    : t('grn.dueBalance', 'Remaining Due')}
                </span>
                <div className="space-y-0.5">
                  <div
                    className={cn(
                      'font-mono font-bold text-base h-9 flex items-center',
                      calculatedDueAmount > 0 ? 'text-rose-400' : 'text-emerald-400'
                    )}
                  >
                    Rs. {calculatedDueAmount.toLocaleString('en-LK', { minimumFractionDigits: 2 })}
                  </div>
                  {/* Advance payment notice — supplier owes us the overage */}
                  {isAdvancePayment && (
                    <p className="text-[10px] text-blue-400 font-medium">
                      {t('grn.advanceCreditNote', 'Advance: Rs. {{amount}} credit with supplier', {
                        amount: (paidAmount - finalTotalAmount).toLocaleString('en-LK', { minimumFractionDigits: 2 })
                      })}
                    </p>
                  )}
                </div>
              </div>
            </div>

            {/* ── Inline Upfront Settlement Details (Shown when Paid Amount > 0) ── */}
            {paidAmount > 0 && (
              <div
                className={cn(
                  'p-3.5 rounded-2xl border space-y-3 animate-in fade-in-50 duration-150',
                  isDark ? 'bg-emerald-950/20 border-emerald-500/30' : 'bg-emerald-50/50 border-emerald-200'
                )}
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-emerald-400 flex items-center gap-1.5">
                    <Banknote className="w-4 h-4" />
                    {t('grn.upfrontPaymentDetails', 'Upfront Payment Details')}
                  </span>
                  <span className="text-[10px] font-mono text-emerald-400 font-bold bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/20">
                    Rs. {paidAmount.toFixed(2)}
                  </span>
                </div>

                {/* Sub-row 1: Payment Method (50%) and Cheque / Reference No. (50%) */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="text-[10px] font-semibold text-slate-400 uppercase mb-1 block">
                      {t('grn.paymentMethod', 'Payment Method')}
                    </label>
                    <SearchableSelect
                      options={paymentMethodOptions}
                      value={paymentMethod}
                      onValueChange={setPaymentMethod}
                      placeholder="Select Method..."
                      theme={isDark ? 'dark' : 'light'}
                      triggerClassName="h-9 text-xs rounded-xl"
                    />
                  </div>

                  <div>
                    <label className="text-[10px] font-semibold text-slate-400 uppercase mb-1 block">
                      {t('grn.chequeNumber', 'Reference / Cheque Number')}
                    </label>
                    <input
                      type="text"
                      value={paymentNote}
                      onChange={(e) => setPaymentNote(e.target.value)}
                      placeholder="e.g. Cheque #48912 / Slip #992"
                      className={cn(
                        'w-full h-9 px-3 rounded-xl border text-xs font-medium focus:outline-none',
                        isDark
                          ? 'border-slate-700 bg-slate-900 text-slate-200 focus:border-emerald-500'
                          : 'border-slate-300 bg-white text-slate-800 focus:border-emerald-500'
                      )}
                    />
                  </div>
                </div>

                {/* Sub-row 2: Dedicated Payment Date & Time Inline Row */}
                <div className="w-fit">
                  <label className="text-[10px] font-semibold text-slate-400 uppercase mb-1 block">
                    {t('grn.paymentDate', 'Payment Date & Time')}
                  </label>
                  <ThemedDateTimePicker
                    value={paymentDate}
                    onChange={setPaymentDate}
                    theme={isDark ? 'dark' : 'light'}
                  />
                </div>
              </div>
            )}

            {/* Toggle Itemized Breakdown */}
            <div className="flex items-center justify-between pt-1">
              <span className="text-xs font-bold text-slate-300 flex items-center gap-1.5">
                <Layers className="w-4 h-4 text-orange-500" />
                {t('grn.itemizedLineItems', 'Itemized Line Items (Optional)')}
              </span>
              <button
                type="button"
                onClick={() => setUseItemization(!useItemization)}
                className={cn(
                  'px-2.5 py-1 rounded-lg text-[11px] font-semibold transition-all border',
                  useItemization
                    ? 'bg-orange-500/15 border-orange-500/40 text-orange-400'
                    : 'bg-slate-800 border-slate-700 text-slate-400 hover:text-slate-200'
                )}
              >
                {useItemization ? t('grn.disableItemization', 'Disable Itemization') : t('grn.enableItemization', 'Enable Itemization')}
              </button>
            </div>

            {/* Dynamic Items Table */}
            {useItemization && (
              <div
                className={cn(
                  'rounded-xl border overflow-hidden',
                  isDark ? 'bg-slate-950/40 border-slate-800' : 'bg-slate-50 border-slate-200'
                )}
              >
                <div className="p-2 space-y-2">
                  <div className="grid grid-cols-12 gap-2 text-[10px] font-bold uppercase tracking-wider text-slate-400 px-1">
                    <div className="col-span-5">{t('grn.itemDescription', 'Item Description')}</div>
                    <div className="col-span-3 text-right">{t('suppliers.unitPrice', 'Unit Price')}</div>
                    <div className="col-span-2 text-right">{t('suppliers.quantity', 'Qty')}</div>
                    <div className="col-span-2 text-right">{t('suppliers.subtotal', 'Subtotal')}</div>
                  </div>

                  {items.map((row, idx) => (
                    <div key={idx} className="grid grid-cols-12 gap-2 items-center">
                      <div className="col-span-5">
                        <input
                          type="text"
                          placeholder="e.g. 1/2' PVC Elbow"
                          value={row.name}
                          onChange={(e) => handleItemChange(idx, 'name', e.target.value)}
                          className={inputClass}
                        />
                      </div>
                      <div className="col-span-3">
                        <SmartNumberInput
                          value={row.unitPrice}
                          onChange={(val) => handleItemChange(idx, 'unitPrice', val)}
                          defaultValueOnEmpty="0"
                          placeholder="0.00"
                          step="0.01"
                          min="0"
                          className={cn(inputClass, 'text-right font-mono')}
                        />
                      </div>
                      <div className="col-span-2">
                        <SmartNumberInput
                          value={row.qty}
                          onChange={(val) => handleItemChange(idx, 'qty', val)}
                          defaultValueOnEmpty="1"
                          placeholder="1"
                          step="1"
                          min="1"
                          className={cn(inputClass, 'text-right font-mono')}
                        />
                      </div>
                      <div className="col-span-2 flex items-center justify-between gap-1">
                        <span className="font-mono font-bold text-xs text-slate-200 truncate">
                          {Number(row.subtotal).toFixed(2)}
                        </span>
                        <button
                          type="button"
                          onClick={() => removeItemRow(idx)}
                          className="p-1.5 rounded-lg text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 transition-colors"
                          title="Remove item"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  ))}

                  <button
                    type="button"
                    onClick={addItemRow}
                    className="w-full py-1.5 rounded-lg border border-dashed border-slate-700 hover:border-orange-500/60 text-xs font-semibold text-slate-400 hover:text-orange-400 flex items-center justify-center gap-1.5 transition-all"
                  >
                    <Plus className="w-3.5 h-3.5" /> {t('grn.addRow', 'Add Row')}
                  </button>
                </div>
              </div>
            )}

            {/* Multi-Attachment Bill Dropzone */}
            <div>
              <GRNAttachmentDropzone
                images={images}
                onChange={setImages}
              />
            </div>

            {/* Notes Input */}
            <div>
              <label className={labelClass}>
                <FileText className="w-3.5 h-3.5 text-orange-500" />
                {t('grn.notesAndRef', 'Notes & Reference')}
              </label>
              <textarea
                rows={2}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder={t('grn.notesPlaceholder', 'Optional supplier bill number, invoice remarks, or delivery notes...')}
                className={cn(
                  'w-full p-2.5 rounded-xl border text-xs font-medium focus:outline-none focus:ring-1 resize-none',
                  isDark
                    ? 'border-slate-700/60 bg-slate-900/60 text-white placeholder:text-slate-500 focus:border-orange-500/80 focus:ring-orange-500/30'
                    : 'border-slate-300 bg-white text-slate-900 placeholder:text-slate-400 focus:border-orange-500/80 focus:ring-orange-500/30'
                )}
              />
            </div>
          </div>

          {/* Footer */}
          <DialogFooter
            className={cn(
              'px-5 py-3 border-t flex flex-row items-center justify-end gap-2',
              isDark ? 'border-slate-800 bg-slate-900/80' : 'border-slate-200 bg-slate-50/50'
            )}
          >
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="px-4 py-2 rounded-xl text-xs font-bold border border-slate-700 text-slate-300 hover:bg-slate-800 transition-colors"
            >
              {t('common.cancel', 'Cancel')}
            </button>

            <button
              type="submit"
              disabled={isSubmitting}
              className="flex items-center gap-2 px-5 py-2 rounded-xl text-xs font-bold bg-gradient-to-r from-orange-500 to-rose-600 hover:from-orange-600 hover:to-rose-700 text-white shadow-lg shadow-orange-500/25 transition-all disabled:opacity-50"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  {t('common.saving', 'Saving...')}
                </>
              ) : isEditMode ? (
                <>
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  {t('grn.updateGrn', 'Update GRN')}
                </>
              ) : (
                <>
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  {t('grn.saveGrn', 'Save GRN')}
                </>
              )}
            </button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default GRNFormModal;
