import React, { useState, useMemo } from 'react';
import { useTheme } from '../../contexts/ThemeContext';
import { useTranslation } from 'react-i18next';
import { Invoice } from '../../types';
import api from '../../lib/api';
import { toast } from 'react-toastify';
import { X, CreditCard, Banknote, CheckCircle, Calculator } from 'lucide-react';

interface PayDueBalanceModalProps {
  isOpen: boolean;
  onClose: () => void;
  invoice: Invoice | null;
  onSuccess: () => void;
}

export const PayDueBalanceModal: React.FC<PayDueBalanceModalProps> = ({
  isOpen,
  onClose,
  invoice,
  onSuccess,
}) => {
  const { theme } = useTheme();
  const { i18n } = useTranslation();
  const isDark = theme === 'dark';
  const isSi = (i18n.language || '').toLowerCase().startsWith('si');

  // 🌟 React Hook Rules: useState hooks සියල්ලම Component එකේ ඉහළින්ම තැබිය යුතුය
  const [paymentAmountStr, setPaymentAmountStr] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  // Modal එක වැසී ඇත්නම් හෝ invoice එකක් නැත්නම් hooks ක්‍රියාත්මක වූ පසු පමණක් return කරන්න
  if (!isOpen || !invoice) return null;

  const totalAmount = Number(invoice.total || 0);
  const alreadyReceived = Number(invoice.receivedAmount || 0);
  const currentDue = Math.max(0, totalAmount - alreadyReceived);

  const paymentAmount = parseFloat(paymentAmountStr) || 0;
  const newReceivedAmount = alreadyReceived + paymentAmount;
  const remainingDue = Math.max(0, currentDue - paymentAmount);

  // Full payment එකක් තෝරා ගැනීම
  const handleFullPay = () => {
    setPaymentAmountStr(currentDue.toFixed(2));
  };

  const handleSavePayment = async () => {
    if (paymentAmount <= 0) {
      toast.error(isSi ? 'කරුණාකර වලංගු ගෙවීම් මුදලක් ඇතුළත් කරන්න' : 'Please enter a valid payment amount');
      return;
    }

    if (paymentAmount > currentDue) {
      toast.error(isSi ? 'ගෙවන මුදල හිඟ ණය මුදලට වඩා වැඩි විය නොහැක' : 'Payment amount cannot exceed remaining due');
      return;
    }

    setIsSubmitting(true);
    try {
      // Backend එකේ PATCH /api/invoices/:id වෙත යවයි
      await api.patch(`/invoices/${invoice.id}`, {
        receivedAmount: newReceivedAmount,
        changeAmount: 0,
      });

      toast.success(
        isSi
          ? `ගිණුම්පත් ${invoice.invoiceNumber} සඳහා ගෙවීම සාර්ථකව යාවත්කාලීන විය!`
          : `Payment updated successfully for invoice ${invoice.invoiceNumber}!`
      );
      onSuccess();
      onClose();
    } catch (err: any) {
      toast.error(err?.message || (isSi ? 'ගෙවීම සුරැකීම අසාර්ථක විය' : 'Failed to update payment'));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div
        className={`w-full max-w-md rounded-2xl border shadow-2xl p-5 overflow-hidden transition-all ${
          isDark ? 'bg-slate-900 border-slate-700/80 text-white' : 'bg-white border-slate-200 text-slate-900'
        }`}
      >
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-slate-700/40">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-emerald-500/10 text-emerald-400 flex items-center justify-center border border-emerald-500/20">
              <CreditCard className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold">
                {isSi ? 'ණය පියවීම (Pay Due Balance)' : 'Pay Due Balance (ණය පියවීම)'}
              </h3>
              <p className="text-[10px] text-slate-400 font-mono">#{invoice.invoiceNumber} • {invoice.customerName}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-white transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Financial Details (Read-only / Immutable) */}
        <div className="mt-4 space-y-3">
          <div className="grid grid-cols-2 gap-2 text-xs">
            <div className={`p-2.5 rounded-xl border ${isDark ? 'bg-slate-800/40 border-slate-700/50' : 'bg-slate-50 border-slate-200'}`}>
              <span className="text-[10px] text-slate-400 block mb-0.5">{isSi ? 'මුළු මුදල (Total)' : 'Total Amount'}</span>
              <span className="font-mono font-bold text-sm">Rs. {totalAmount.toLocaleString('en-US', { minimumFractionDigits: 2 })}</span>
            </div>
            <div className={`p-2.5 rounded-xl border ${isDark ? 'bg-slate-800/40 border-slate-700/50' : 'bg-slate-50 border-slate-200'}`}>
              <span className="text-[10px] text-slate-400 block mb-0.5">{isSi ? 'ලැබුණු මුදල (Paid)' : 'Already Received'}</span>
              <span className="font-mono font-bold text-sm text-emerald-400">Rs. {alreadyReceived.toLocaleString('en-US', { minimumFractionDigits: 2 })}</span>
            </div>
          </div>

          <div className={`p-3 rounded-xl border flex items-center justify-between ${isDark ? 'bg-amber-500/10 border-amber-500/30' : 'bg-amber-50 border-amber-200'}`}>
            <div>
              <span className="text-[10px] font-semibold text-amber-500 block uppercase tracking-wider">{isSi ? 'ගෙවීමට ඇති හිඟ ණය' : 'Current Due Balance'}</span>
              <span className="text-base font-black font-mono text-amber-400">Rs. {currentDue.toLocaleString('en-US', { minimumFractionDigits: 2 })}</span>
            </div>
            <button
              type="button"
              onClick={handleFullPay}
              className="px-2.5 py-1.5 rounded-lg text-xs font-bold bg-amber-500 hover:bg-amber-600 text-slate-950 transition-all shadow shadow-amber-500/20 active:scale-95"
            >
              {isSi ? 'සම්පූර්ණ ගෙවීම (Full Pay)' : 'Full Pay'}
            </button>
          </div>

          {/* New Payment Input Field */}
          <div>
            <label className="block text-[11px] font-bold text-slate-300 mb-1">
              {isSi ? 'දැන් ගෙවන මුදල (Amount Paying Now)' : 'Amount Paying Now'} *
            </label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400">Rs.</span>
              <input
                type="number"
                step="any"
                min="0"
                max={currentDue}
                autoFocus
                placeholder="0.00"
                value={paymentAmountStr}
                onChange={(e) => setPaymentAmountStr(e.target.value)}
                className={`w-full pl-9 pr-3 py-2 text-sm font-mono font-bold rounded-xl border focus:outline-none focus:ring-2 focus:ring-emerald-500/40 transition-all ${
                  isDark ? 'bg-slate-800/80 border-slate-700 text-white placeholder-slate-500' : 'bg-slate-50 border-slate-200 text-slate-900 placeholder-slate-400'
                }`}
              />
            </div>
          </div>

          {/* Balance Preview */}
          {paymentAmount > 0 && (
            <div className={`p-2.5 rounded-xl border flex items-center justify-between text-xs ${isDark ? 'bg-slate-800/60 border-slate-700' : 'bg-slate-100 border-slate-200'}`}>
              <span className="text-slate-400">{isSi ? 'ඉතිරි වන ණය ශේෂය:' : 'Remaining Due After Payment:'}</span>
              <span className={`font-mono font-bold ${remainingDue === 0 ? 'text-emerald-400' : 'text-amber-400'}`}>
                Rs. {remainingDue.toLocaleString('en-US', { minimumFractionDigits: 2 })} {remainingDue === 0 && ' (PAID)'}
              </span>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="mt-5 pt-3 border-t border-slate-700/40 flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className={`px-3 py-2 rounded-xl text-xs font-semibold transition-colors ${
              isDark ? 'hover:bg-slate-800 text-slate-400' : 'hover:bg-slate-100 text-slate-600'
            }`}
          >
            {isSi ? 'අවලංගු කරන්න' : 'Cancel'}
          </button>
          <button
            type="button"
            disabled={isSubmitting || paymentAmount <= 0}
            onClick={handleSavePayment}
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-600 hover:to-teal-600 text-white shadow-lg shadow-emerald-500/20 active:scale-95 disabled:opacity-40 transition-all"
          >
            <CheckCircle className="w-3.5 h-3.5" />
            <span>{isSubmitting ? (isSi ? 'සුරකිමින්...' : 'Saving...') : (isSi ? 'ගෙවීම තහවුරු කරන්න' : 'Confirm Payment')}</span>
          </button>
        </div>
      </div>
    </div>
  );
};