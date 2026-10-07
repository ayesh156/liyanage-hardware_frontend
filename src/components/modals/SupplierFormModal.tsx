import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Supplier } from '../../types/index';
import { useTheme } from '../../contexts/ThemeContext';
import { 
  Building2, User, Phone, Smartphone, MapPin, 
  DollarSign, Mail, Check, Loader2, Landmark
} from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { toast } from 'react-toastify';
import api from '../../lib/api';
import { cn } from '../../lib/utils';

export interface SupplierFormModalProps {
  isOpen: boolean;
  supplier?: Supplier;
  onClose: () => void;
  onSuccess: (savedSupplier: Supplier) => void;
}

interface SupplierFormData {
  name: string;
  companyName: string;
  address: string;
  mobileNumber: string;
  telephoneNumber: string;
  startingBalance: number | string;
  contactPerson: string;
  email: string;
}

/**
 * Modal dialog for creating and editing Supplier records with unified CategoryFormModal styling.
 */
export const SupplierFormModal: React.FC<SupplierFormModalProps> = ({
  isOpen,
  supplier,
  onClose,
  onSuccess,
}) => {
  const { t } = useTranslation();
  const { theme } = useTheme();
  const isDark = theme === 'dark';
  const isEditing = !!supplier;

  const [formData, setFormData] = useState<SupplierFormData>({
    name: '',
    companyName: '',
    address: '',
    mobileNumber: '',
    telephoneNumber: '',
    startingBalance: 0,
    contactPerson: '',
    email: '',
  });

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (supplier) {
      setFormData({
        name: supplier.name || '',
        companyName: supplier.companyName || '',
        address: supplier.address || '',
        mobileNumber: supplier.mobileNumber || supplier.phone || '',
        telephoneNumber: supplier.telephoneNumber || '',
        startingBalance: supplier.startingBalance ?? 0,
        contactPerson: supplier.contactPerson || '',
        email: supplier.email || '',
      });
    } else {
      setFormData({
        name: '',
        companyName: '',
        address: '',
        mobileNumber: '',
        telephoneNumber: '',
        startingBalance: 0,
        contactPerson: '',
        email: '',
      });
    }
    setErrors({});
  }, [supplier, isOpen]);

  const validate = () => {
    const errs: Record<string, string> = {};
    if (!formData.name.trim()) {
      errs.name = t('suppliers.nameRequired', 'Supplier name is required');
    }
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;

    setIsSubmitting(true);
    try {
      const payload = {
        name: formData.name.trim(),
        companyName: formData.companyName.trim() || undefined,
        address: formData.address.trim() || undefined,
        mobileNumber: formData.mobileNumber.trim() || undefined,
        telephoneNumber: formData.telephoneNumber.trim() || undefined,
        startingBalance: Number(formData.startingBalance || 0),
        contactPerson: formData.contactPerson.trim() || undefined,
        email: formData.email.trim() || undefined,
      };

      let saved: Supplier;
      if (isEditing && supplier?.id) {
        saved = await api.put<Supplier>(`/suppliers/${supplier.id}`, payload);
        toast.success(`Supplier "${saved.name}" updated successfully!`);
      } else {
        saved = await api.post<Supplier>('/suppliers', payload);
        toast.success(`Supplier "${saved.name}" added successfully!`);
      }

      onSuccess(saved);
      onClose();
    } catch (err: any) {
      toast.error(err?.message || 'Failed to save supplier profile');
    } finally {
      setIsSubmitting(false);
    }
  };

  const inputClass = (hasError?: boolean) =>
    cn(
      'w-full h-9 px-3 rounded-xl border text-xs font-medium transition-all focus:outline-none focus:ring-1',
      hasError
        ? 'border-rose-500/80 bg-rose-500/10 focus:ring-rose-500/30 text-rose-300'
        : isDark
        ? 'border-slate-700/60 bg-slate-900/60 text-white placeholder:text-slate-500 focus:border-orange-500/80 focus:ring-orange-500/30'
        : 'border-slate-300 bg-white text-slate-900 placeholder:text-slate-400 focus:border-orange-500/80 focus:ring-orange-500/30 shadow-sm'
    );

  const labelClass = 'text-[11px] font-semibold tracking-wide uppercase text-slate-400 flex items-center gap-1.5 mb-1';

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent
        className={cn(
          'sm:max-w-xl max-h-[92vh] overflow-y-auto p-0 gap-0 rounded-2xl border shadow-2xl',
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
                <Building2 className="w-4 h-4" />
              </div>
              <div>
                <DialogTitle className="text-sm font-bold tracking-tight">
                  {isEditing ? t('suppliers.editProfile', 'Edit Supplier Profile') : t('suppliers.newSupplier', 'New Supplier')}
                </DialogTitle>
                <DialogDescription className="text-[11px] text-slate-400 mt-0.5">
                  {isEditing
                    ? t('suppliers.updating', 'Updating {{name}}', { name: supplier.name })
                    : t('suppliers.createRecordDesc', 'Create supplier record with starting balance tracking')}
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>

          {/* Form Content */}
          <div className="p-5 space-y-3.5 overflow-y-auto">
            {/* Supplier Name */}
            <div>
              <label className={labelClass}>
                <User className="w-3.5 h-3.5 text-orange-500" />
                {t('suppliers.supplierName', 'Supplier Name')} <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                required
                placeholder="e.g. ACL Cables PLC / Nimal Hardware Supplies"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className={inputClass(!!errors.name)}
                autoFocus
              />
              {errors.name && <p className="text-[10px] text-rose-500 mt-1">{errors.name}</p>}
            </div>

            {/* Company Name */}
            <div>
              <label className={labelClass}>
                <Landmark className="w-3.5 h-3.5 text-orange-500" />
                {t('suppliers.companyName', 'Company / Business Name')}
              </label>
              <input
                type="text"
                placeholder="e.g. ACL Commercial Distributions"
                value={formData.companyName}
                onChange={(e) => setFormData({ ...formData, companyName: e.target.value })}
                className={inputClass()}
              />
            </div>

            {/* Phone Numbers Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className={labelClass}>
                  <Smartphone className="w-3.5 h-3.5 text-orange-500" />
                  {t('suppliers.mobileNumber', 'Mobile Number')}
                </label>
                <input
                  type="tel"
                  placeholder="077 123 4567"
                  value={formData.mobileNumber}
                  onChange={(e) => setFormData({ ...formData, mobileNumber: e.target.value })}
                  className={inputClass()}
                />
              </div>
              <div>
                <label className={labelClass}>
                  <Phone className="w-3.5 h-3.5 text-orange-500" />
                  {t('suppliers.telephoneNumber', 'Telephone')}
                </label>
                <input
                  type="tel"
                  placeholder="011 234 5678"
                  value={formData.telephoneNumber}
                  onChange={(e) => setFormData({ ...formData, telephoneNumber: e.target.value })}
                  className={inputClass()}
                />
              </div>
            </div>

            {/* Address */}
            <div>
              <label className={labelClass}>
                <MapPin className="w-3.5 h-3.5 text-orange-500" />
                {t('suppliers.address', 'Physical Address')}
              </label>
              <textarea
                rows={2}
                placeholder="e.g. No. 45, Commercial Road, Colombo 11"
                value={formData.address}
                onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                className={cn(
                  'w-full p-2.5 rounded-xl border text-xs font-medium resize-none transition-all focus:outline-none focus:ring-1',
                  isDark
                    ? 'border-slate-700/60 bg-slate-900/60 text-white placeholder:text-slate-500 focus:border-orange-500/80 focus:ring-orange-500/30'
                    : 'border-slate-300 bg-white text-slate-900 placeholder:text-slate-400 focus:border-orange-500/80 focus:ring-orange-500/30 shadow-sm'
                )}
              />
            </div>

            {/* Starting Balance & Email Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className={labelClass}>
                  <DollarSign className="w-3.5 h-3.5 text-orange-500" />
                  {t('suppliers.startingBalanceLkr', 'Starting Balance (LKR)')}
                </label>
                <div className="relative">
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    placeholder="0.00"
                    value={formData.startingBalance}
                    onChange={(e) => setFormData({ ...formData, startingBalance: e.target.value })}
                    className={cn(inputClass(), 'pl-7 font-mono font-medium')}
                  />
                  <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[11px] font-bold text-slate-400">
                    Rs.
                  </span>
                </div>
                <p className="text-[10px] text-slate-400 mt-1">
                  {t('suppliers.startingBalanceDesc', 'Outstanding balance brought forward from legacy ledger.')}
                </p>
              </div>

              <div>
                <label className={labelClass}>
                  <Mail className="w-3.5 h-3.5 text-orange-500" />
                  {t('suppliers.emailContactNote', 'Email / Contact Note')}
                </label>
                <input
                  type="email"
                  placeholder="supplier@domain.com"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  className={inputClass()}
                />
              </div>
            </div>
          </div>

          {/* Footer */}
          <DialogFooter
            className={cn(
              'px-5 py-3 border-t flex flex-row items-center justify-end gap-2 sm:gap-2',
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
              disabled={isSubmitting}
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold bg-gradient-to-r from-orange-500 to-rose-500 hover:from-orange-600 hover:to-rose-600 text-white shadow-lg shadow-orange-500/20 transition-all disabled:opacity-50"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  {t('common.saving', 'Saving...')}
                </>
              ) : (
                <>
                  <Check className="w-3.5 h-3.5" />
                  {isEditing ? t('suppliers.updateSupplier', 'Update Supplier') : t('suppliers.saveSupplier', 'Save Supplier')}
                </>
              )}
            </button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default SupplierFormModal;
