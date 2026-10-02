// frontend/src/components/modals/CustomerDueInvoicesModal.tsx
import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Customer, Invoice } from '../../types';
import { useTheme } from '../../contexts/ThemeContext';
import { useTranslation } from 'react-i18next';
import api from '../../lib/api';
import { toast } from 'react-toastify';
import { 
  X, CheckCircle, Calculator, CreditCard, MessageCircle, 
  Calendar, DollarSign, FileText, Phone 
} from 'lucide-react';
import { sendWhatsAppDueReminder } from '../../lib/whatsappReminder';

interface CustomerDueInvoicesModalProps {
  isOpen: boolean;
  onClose: () => void;
  customer: Customer | null;
  onSuccess: () => void;
}

export const CustomerDueInvoicesModal: React.FC<CustomerDueInvoicesModalProps> = ({
  isOpen,
  onClose,
  customer,
  onSuccess,
}) => {
  const { theme } = useTheme();
  const { i18n } = useTranslation();
  const isDark = theme === 'dark';
  const isSi = (i18n.language || '').toLowerCase().startsWith('si');

  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [selectedInvoiceIds, setSelectedInvoiceIds] = useState<Set<string>>(new Set());
  const [payingAmountStr, setPayingAmountStr] = useState<string>('');
  const [sortBy, setSortBy] = useState<'date' | 'price' | 'invNo'>('date');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  // පාරිභෝගිකයාගේ හිඟ බිල්පත් සජීවීව Backend එකෙන් ලබා ගැනීම
  const fetchCustomerInvoices = useCallback(async () => {
    if (!customer?.id) return;
    try {
      setLoading(true);
      const res = await api.get<any>('/invoices', { customerId: customer.id, perPage: 100 }, true);
      const data: Invoice[] = Array.isArray(res) ? res : (res?.data || []);
      // හිඟ මුදලක් පවතින ඉන්වොයිස් පමණක් තෝරා ගැනීම
      const pendingInvs = data.filter(inv => {
        const due = (inv.total || 0) - (inv.receivedAmount || 0);
        return due > 0;
      });
      setInvoices(pendingInvs);
      // ආරම්භයේදී සියලුම හිඟ ඉන්වොයිස් තෝරා ගැනීම (Select all)
      setSelectedInvoiceIds(new Set(pendingInvs.map(i => i.id)));
    } catch (err) {
      toast.error('Failed to load customer pending invoices');
    } finally {
      setLoading(false);
    }
  }, [customer?.id]);

  useEffect(() => {
    if (isOpen && customer) {
      fetchCustomerInvoices();
      setPayingAmountStr('');
    }
  }, [isOpen, customer, fetchCustomerInvoices]);

  // පෙරහන් සහ පිළිවෙළ සැකසීම (Sorting Logic)
  const sortedInvoices = useMemo(() => {
    return [...invoices].sort((a, b) => {
      if (sortBy === 'price') {
        const dueA = (a.total || 0) - (a.receivedAmount || 0);
        const dueB = (b.total || 0) - (b.receivedAmount || 0);
        return sortOrder === 'asc' ? dueA - dueB : dueB - dueA;
      }
      if (sortBy === 'invNo') {
        return sortOrder === 'asc' 
          ? a.invoiceNumber.localeCompare(b.invoiceNumber) 
          : b.invoiceNumber.localeCompare(a.invoiceNumber);
      }
      const dateA = new Date(a.issueDate).getTime();
      const dateB = new Date(b.issueDate).getTime();
      return sortOrder === 'asc' ? dateA - dateB : dateB - dateA;
    });
  }, [invoices, sortBy, sortOrder]);

  // තෝරාගත් බිල්පත් වල මුළු එකතුව ගණනය කිරීම
  const totalSelectedDue = useMemo(() => {
    return sortedInvoices
      .filter(i => selectedInvoiceIds.has(i.id))
      .reduce((sum, i) => sum + ((i.total || 0) - (i.receivedAmount || 0)), 0);
  }, [sortedInvoices, selectedInvoiceIds]);

  const toggleSelectInvoice = (id: string) => {
    const next = new Set(selectedInvoiceIds);
    if (next.has(id)) {
      next.delete(id);
    } else {
      next.add(id);
    }
    setSelectedInvoiceIds(next);
  };

  const handleFullPay = () => {
    setPayingAmountStr(totalSelectedDue.toFixed(2));
  };

  // බිල්පත් පියවීම (FIFO පදනම මත තෝරාගත් බිල්පත් සඳහා මුදල් බැර කිරීම)
  const handleSettlePayment = async () => {
    const entered = parseFloat(payingAmountStr) || 0;
    if (entered <= 0) {
      toast.error(isSi ? 'වලංගු මුදලක් ඇතුළත් කරන්න' : 'Please enter a valid payment amount');
      return;
    }
    if (entered > totalSelectedDue) {
      toast.error(isSi ? 'ගෙවන මුදල හිඟ මුදලට වඩා වැඩි විය නොහැක' : 'Amount cannot exceed selected due');
      return;
    }

    setIsSubmitting(true);
    try {
      let remainingToAllocate = entered;
      const targetInvoices = sortedInvoices.filter(i => selectedInvoiceIds.has(i.id));

      // 🌟 FIFO ක්‍රමයට තෝරාගත් එක් එක් ඉන්වොයිස් හි ගෙවීම් යාවත්කාලීන කිරීම
      for (const inv of targetInvoices) {
        if (remainingToAllocate <= 0) break;
        const currentPaid = inv.receivedAmount || 0;
        const invoiceDue = inv.total - currentPaid;
        const payThis = Math.min(invoiceDue, remainingToAllocate);

        await api.patch(`/invoices/${inv.id}`, {
          receivedAmount: currentPaid + payThis,
          changeAmount: 0,
        });

        remainingToAllocate -= payThis;
      }

      // 🌟 Backend Customer Schema එකෙහි loanBalance අගයද සෘජුවම අඩු කර සමමුහුර්ත කිරීම
      const newCustomerLoanBalance = Math.max(0, Number(customer.loanBalance || 0) - entered);
      await api.put(`/customers/${customer.id}`, {
        ...customer,
        loanBalance: newCustomerLoanBalance,
      });

      // 🌟 පද්ධතියේ සියලුම පිටු (Invoices & Customers) Live Sync වීමට Global Event එකක් නිකුත් කිරීම
      window.dispatchEvent(new CustomEvent('balance-updated'));

      toast.success(isSi ? 'ණය පියවීම සාර්ථකව යාවත්කාලීන විය!' : 'Payments settled successfully!');
      onSuccess();
      onClose();
    } catch (err: any) {
      toast.error(err?.message || 'Failed to process payment');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen || !customer) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 bg-black/60 backdrop-blur-sm animate-in fade-in">
      <div className={`w-full max-w-2xl rounded-2xl border shadow-2xl overflow-hidden transition-all flex flex-col max-h-[92vh] ${
        isDark ? 'bg-slate-900 border-slate-700 text-white' : 'bg-white border-slate-200 text-slate-900'
      }`}>
        {/* Header */}
        <div className="p-4 border-b border-slate-700/50 flex items-center justify-between">
          <div>
            <div className="flex items-center gap-2">
              <CreditCard className="w-4 h-4 text-emerald-400" />
              <h3 className="font-bold text-sm">
                {isSi ? 'පාරිභෝගික ණය ගෙවීම් (Customer Bill Settlements)' : 'Customer Due Settlements'}
              </h3>
            </div>
            <p className="text-[11px] text-slate-400 mt-0.5">
              {customer.name} {customer.phone ? `(${customer.phone})` : ''} • Total Balance: Rs. {Number(customer.loanBalance).toLocaleString()}
            </p>
          </div>
          <div className="flex items-center gap-1.5">
            {/* Emoji රහිත WhatsApp Reminder බොත්තම */}
            {customer.phone && (
              <button
                type="button"
                onClick={() => {
                  const invNos = sortedInvoices.filter(i => selectedInvoiceIds.has(i.id)).map(i => i.invoiceNumber);
                  sendWhatsAppDueReminder(customer.phone, customer.name, totalSelectedDue, invNos);
                }}
                className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-bold bg-emerald-600 hover:bg-emerald-500 text-white transition-all shadow"
                title="Send WhatsApp Reminder"
              >
                <MessageCircle className="w-3.5 h-3.5" />
                <span>WhatsApp</span>
              </button>
            )}
            <button onClick={onClose} className="p-1 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-white">
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Toolbar: Sorting & Filters */}
        <div className={`px-4 py-2 border-b flex items-center justify-between text-xs gap-2 ${
          isDark ? 'bg-slate-800/40 border-slate-700/40' : 'bg-slate-50 border-slate-200'
        }`}>
          <div className="flex items-center gap-2">
            <span className="text-[10px] text-slate-400 font-semibold uppercase">Sort By:</span>
            <button
              onClick={() => {
                if (sortBy === 'date') setSortOrder(o => o === 'asc' ? 'desc' : 'asc');
                else { setSortBy('date'); setSortOrder('desc'); }
              }}
              className={`px-2 py-0.5 rounded text-[11px] border flex items-center gap-1 ${
                sortBy === 'date' ? 'bg-orange-500 text-white border-orange-500' : 'border-slate-700'
              }`}
            >
              <Calendar className="w-3 h-3" /> Date {sortBy === 'date' && (sortOrder === 'asc' ? '↑' : '↓')}
            </button>
            <button
              onClick={() => {
                if (sortBy === 'price') setSortOrder(o => o === 'asc' ? 'desc' : 'asc');
                else { setSortBy('price'); setSortOrder('desc'); }
              }}
              className={`px-2 py-0.5 rounded text-[11px] border flex items-center gap-1 ${
                sortBy === 'price' ? 'bg-orange-500 text-white border-orange-500' : 'border-slate-700'
              }`}
            >
              <DollarSign className="w-3 h-3" /> Price {sortBy === 'price' && (sortOrder === 'asc' ? '↑' : '↓')}
            </button>
            <button
              onClick={() => {
                if (sortBy === 'invNo') setSortOrder(o => o === 'asc' ? 'desc' : 'asc');
                else { setSortBy('invNo'); setSortOrder('asc'); }
              }}
              className={`px-2 py-0.5 rounded text-[11px] border flex items-center gap-1 ${
                sortBy === 'invNo' ? 'bg-orange-500 text-white border-orange-500' : 'border-slate-700'
              }`}
            >
              <FileText className="w-3 h-3" /> A-Z {sortBy === 'invNo' && (sortOrder === 'asc' ? '↑' : '↓')}
            </button>
          </div>
          <span className="text-[11px] text-slate-400 font-mono">
            {selectedInvoiceIds.size} / {sortedInvoices.length} Selected
          </span>
        </div>

        {/* Invoice List (Selectable Table) */}
        <div className="flex-1 overflow-y-auto p-4 space-y-1.5 custom-scrollbar">
          {loading ? (
            <div className="py-8 text-center text-xs text-slate-400">Loading pending invoices...</div>
          ) : sortedInvoices.length === 0 ? (
            <div className="py-8 text-center text-xs text-slate-400">No pending invoices found for this customer.</div>
          ) : (
            sortedInvoices.map((inv) => {
              const due = (inv.total || 0) - (inv.receivedAmount || 0);
              const isSelected = selectedInvoiceIds.has(inv.id);
              return (
                <div
                  key={inv.id}
                  onClick={() => toggleSelectInvoice(inv.id)}
                  className={`p-2.5 rounded-xl border flex items-center justify-between cursor-pointer transition-all ${
                    isSelected
                      ? isDark ? 'bg-slate-800 border-amber-500/60 shadow' : 'bg-amber-50 border-amber-300'
                      : isDark ? 'bg-slate-900/50 border-slate-800 opacity-60' : 'bg-white border-slate-200 opacity-60'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={() => {}}
                      className="w-4 h-4 accent-amber-500 rounded cursor-pointer"
                    />
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-mono font-bold text-xs text-indigo-400">{inv.invoiceNumber}</span>
                        <span className="text-[10px] text-slate-400">{new Date(inv.issueDate).toISOString().split('T')[0]}</span>
                      </div>
                      <span className="text-[10px] text-slate-400">Total: Rs. {inv.total.toLocaleString()}</span>
                    </div>
                  </div>
                  <div className="text-right">
                    <span className="text-[10px] text-slate-400 block">Due Balance</span>
                    <span className="text-xs font-mono font-bold text-amber-400">
                      Rs. {due.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                    </span>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Bottom Settlement Controls */}
        <div className="p-4 border-t border-slate-700/50 space-y-3">
          <div className="flex items-center justify-between text-xs">
            <div>
              <span className="text-[10px] text-slate-400 block uppercase">Selected Due Sum</span>
              <span className="text-base font-black font-mono text-amber-400">
                Rs. {totalSelectedDue.toLocaleString('en-US', { minimumFractionDigits: 2 })}
              </span>
            </div>
            <button
              type="button"
              onClick={handleFullPay}
              className="px-3 py-1.5 bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold text-xs rounded-lg transition-all shadow"
            >
              {isSi ? 'සම්පූර්ණ මුදල (Full Pay)' : 'Full Pay'}
            </button>
          </div>

          <div className="flex items-center gap-2">
            <div className="relative flex-1">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400">Rs.</span>
              <input
                type="number"
                step="any"
                min="0"
                max={totalSelectedDue}
                placeholder="Enter amount to pay..."
                value={payingAmountStr}
                onChange={(e) => setPayingAmountStr(e.target.value)}
                className={`w-full pl-9 pr-3 py-2 text-sm font-mono font-bold rounded-xl border focus:outline-none focus:ring-2 focus:ring-emerald-500/40 ${
                  isDark ? 'bg-slate-800 border-slate-700 text-white' : 'bg-slate-50 border-slate-200'
                }`}
              />
            </div>
            <button
              type="button"
              disabled={isSubmitting || !parseFloat(payingAmountStr)}
              onClick={handleSettlePayment}
              className="px-4 py-2 bg-gradient-to-r from-emerald-500 to-teal-500 text-white font-bold text-xs rounded-xl shadow transition-all disabled:opacity-40"
            >
              {isSubmitting ? 'Saving...' : (isSi ? 'ගෙවීම තහවුරු කරන්න' : 'Confirm Settlement')}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};