import React, { useState } from 'react';
import { useTheme } from '../../contexts/ThemeContext';
import { GRN, GRNImageItem } from '../../types';
import { normalizeImageUrl, isPdfUrl } from '../../utils/imageUtils';
import { 
  PackageCheck, Building2, Calendar, DollarSign, 
  Eye, Banknote, FileText, Layers, CheckCircle2,
  Download, ExternalLink
} from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { LightboxModal } from '../ui/LightboxModal';
import { cn } from '../../lib/utils';

export interface GRNDetailsModalProps {
  isOpen: boolean;
  grn: GRN | null;
  onClose: () => void;
  onSettleClick: (grn: GRN) => void;
}

/**
 * Detailed inspector modal for Goods Received Notes (GRN) items, attached bills, and settlement logs.
 * Integrates interactive hover-zoom LightboxModal for checking bill line items and PDF invoices.
 */
export const GRNDetailsModal: React.FC<GRNDetailsModalProps> = ({
  isOpen,
  grn,
  onClose,
  onSettleClick,
}) => {
  const { theme } = useTheme();
  const isDark = theme === 'dark';

  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);

  if (!isOpen || !grn) return null;

  const totalAmount = Number(grn.totalAmount || 0);
  const paidAmount = Number(grn.paidAmount || 0);
  const dueAmount = Number(grn.dueAmount || 0);

  const imagesList: GRNImageItem[] = Array.isArray(grn.images)
    ? (grn.images as any[]).map((img) => {
        if (typeof img === 'string') {
          return {
            url: img,
            name: 'Invoice Document',
            fileType: isPdfUrl(img) ? 'pdf' : 'image',
          };
        }
        return {
          ...img,
          fileType: isPdfUrl(img) ? 'pdf' : (img.fileType || 'image'),
        };
      })
    : [];

  return (
    <>
      <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
        <DialogContent
          className={cn(
            'sm:max-w-3xl max-h-[92vh] overflow-y-auto p-0 gap-0 rounded-2xl border shadow-2xl',
            isDark ? 'bg-slate-900 border-slate-800 text-white' : 'bg-white border-slate-200 text-slate-900'
          )}
        >
          {/* Header */}
          <DialogHeader
            className={cn(
              'px-5 py-3.5 border-b flex flex-row items-center justify-between',
              isDark ? 'border-slate-800 bg-slate-900/80' : 'border-slate-200 bg-slate-50/50'
            )}
          >
            <div className="flex items-center gap-2.5 text-left">
              <div className="p-2 rounded-xl bg-gradient-to-br from-orange-500 to-rose-500 text-white shadow-md shadow-orange-500/20">
                <PackageCheck className="w-4 h-4" />
              </div>
              <div>
                <DialogTitle className="text-sm font-bold tracking-tight flex items-center gap-2">
                  GRN #{grn.grnNumber}
                  <span
                    className={cn(
                      'text-[10px] font-mono px-2 py-0.5 rounded-full border',
                      grn.status === 'PAID'
                        ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                        : grn.status === 'PARTIAL'
                        ? 'bg-amber-500/10 text-amber-400 border-amber-500/30'
                        : 'bg-rose-500/10 text-rose-400 border-rose-500/30'
                    )}
                  >
                    {grn.status}
                  </span>
                </DialogTitle>
                <DialogDescription className="text-[11px] text-slate-400 mt-0.5">
                  {grn.supplier?.name} {grn.supplier?.companyName ? `• ${grn.supplier.companyName}` : ''}
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>

          {/* Body */}
          <div className="p-5 space-y-4 overflow-y-auto">
            {/* Financial Overview Cards */}
            <div className="grid grid-cols-3 gap-3">
              <div
                className={cn(
                  'p-3 rounded-xl border',
                  isDark ? 'bg-slate-950/50 border-slate-800' : 'bg-slate-50 border-slate-200'
                )}
              >
                <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 block mb-0.5">
                  Total Bill
                </span>
                <div className="text-sm font-bold font-mono text-slate-100">
                  Rs. {totalAmount.toLocaleString('en-LK', { minimumFractionDigits: 2 })}
                </div>
              </div>
              <div
                className={cn(
                  'p-3 rounded-xl border',
                  isDark ? 'bg-slate-950/50 border-slate-800' : 'bg-slate-50 border-slate-200'
                )}
              >
                <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 block mb-0.5">
                  Paid Amount
                </span>
                <div className="text-sm font-bold font-mono text-emerald-400">
                  Rs. {paidAmount.toLocaleString('en-LK', { minimumFractionDigits: 2 })}
                </div>
              </div>
              <div
                className={cn(
                  'p-3 rounded-xl border',
                  isDark ? 'bg-slate-950/50 border-slate-800' : 'bg-slate-50 border-slate-200'
                )}
              >
                <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 block mb-0.5">
                  Due Balance
                </span>
                <div
                  className={cn(
                    'text-sm font-bold font-mono',
                    dueAmount > 0 ? 'text-rose-400' : 'text-emerald-400'
                  )}
                >
                  Rs. {dueAmount.toLocaleString('en-LK', { minimumFractionDigits: 2 })}
                </div>
              </div>
            </div>

            {/* Line Items Table */}
            {grn.items && grn.items.length > 0 && (
              <div
                className={cn(
                  'p-3.5 rounded-xl border',
                  isDark ? 'bg-slate-950/40 border-slate-800' : 'bg-slate-50/70 border-slate-200'
                )}
              >
                <div className="flex items-center gap-1.5 mb-2.5">
                  <Layers className="w-3.5 h-3.5 text-orange-500" />
                  <span className="text-xs font-bold text-slate-200">
                    Itemized Stock Lines ({grn.items.length})
                  </span>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead>
                      <tr className="border-b border-slate-700/60 text-slate-400 uppercase tracking-wider text-[10px]">
                        <th className="pb-2 font-semibold">Item Name</th>
                        <th className="pb-2 font-semibold text-right">Unit Price</th>
                        <th className="pb-2 font-semibold text-right">Qty</th>
                        <th className="pb-2 font-semibold text-right">Subtotal</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800">
                      {grn.items.map((item, idx) => (
                        <tr key={idx} className="hover:bg-slate-800/20">
                          <td className="py-2 font-medium text-slate-200">{item.name}</td>
                          <td className="py-2 text-right font-mono text-slate-300">
                            Rs. {Number(item.unitPrice).toFixed(2)}
                          </td>
                          <td className="py-2 text-right font-mono text-slate-300">
                            {Number(item.qty)}
                          </td>
                          <td className="py-2 text-right font-mono font-bold text-orange-400">
                            Rs. {Number(item.subtotal).toFixed(2)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Image & PDF Gallery */}
            {imagesList.length > 0 && (
              <div
                className={cn(
                  'p-3.5 rounded-xl border',
                  isDark ? 'bg-slate-950/40 border-slate-800' : 'bg-slate-50/70 border-slate-200'
                )}
              >
                <div className="flex items-center justify-between mb-2.5">
                  <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                    <FileText className="w-3.5 h-3.5 text-orange-500" />
                    Attached Invoices & Bill Photos ({imagesList.length})
                  </span>
                  <span className="text-[10px] text-slate-400 font-medium">
                    Click any attachment for full-screen hover-zoom lens
                  </span>
                </div>
                <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-2">
                  {imagesList.map((img, idx) => {
                    const resolved = normalizeImageUrl(img.url);
                    const isPdf = isPdfUrl(img) || img.fileType === 'pdf' || isPdfUrl(resolved);

                    return (
                      <div
                        key={idx}
                        className="group relative rounded-xl overflow-hidden border border-slate-700/60 bg-slate-900 aspect-square cursor-pointer hover:border-orange-500/80 transition-all shadow-sm"
                        onClick={() => setLightboxIndex(idx)}
                      >
                        {isPdf ? (
                          <div className="w-full h-full bg-slate-950 flex flex-col items-center justify-center p-2 text-center">
                            <FileText className="w-7 h-7 text-rose-400 mb-1" />
                            <span className="text-[9px] font-bold text-slate-300 truncate max-w-full px-1">
                              {img.name || 'PDF Doc'}
                            </span>
                            <span className="text-[8px] font-mono text-rose-400 bg-rose-500/10 px-1 rounded mt-0.5">
                              PDF
                            </span>
                          </div>
                        ) : (
                          <img
                            src={resolved}
                            alt={img.name || `Attachment ${idx + 1}`}
                            referrerPolicy="no-referrer"
                            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-200"
                          />
                        )}
                        <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                          <Eye className="w-4 h-4 text-white" />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Payment & Settlement History */}
            {grn.settlements && grn.settlements.length > 0 && (
              <div
                className={cn(
                  'p-3.5 rounded-xl border',
                  isDark ? 'bg-slate-950/40 border-slate-800' : 'bg-slate-50/70 border-slate-200'
                )}
              >
                <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 flex items-center gap-1.5 mb-2">
                  <Banknote className="w-3.5 h-3.5 text-emerald-400" />
                  Payment Settlement Logs
                </span>
                <div className="space-y-1.5">
                  {grn.settlements.map((st, idx) => (
                    <div
                      key={idx}
                      className="p-2 rounded-lg bg-slate-800/40 border border-slate-700/40 flex items-center justify-between text-xs"
                    >
                      <div>
                        <div className="font-semibold text-slate-200">
                          Rs. {Number(st.amount).toFixed(2)} via {st.paymentMethod}
                        </div>
                        {st.note && <div className="text-[11px] text-slate-400">{st.note}</div>}
                      </div>
                      <div className="text-[10px] text-slate-400 font-mono">
                        {new Date(st.createdAt).toLocaleDateString()}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Notes */}
            {grn.notes && (
              <div className="text-xs text-slate-400 bg-slate-800/30 p-2.5 rounded-xl border border-slate-700/60">
                <span className="font-semibold text-slate-300">Notes:</span> {grn.notes}
              </div>
            )}
          </div>

          {/* Footer */}
          <DialogFooter
            className={cn(
              'px-5 py-3 border-t flex flex-row items-center justify-between gap-2 sm:gap-2',
              isDark ? 'border-slate-800 bg-slate-900/90' : 'border-slate-200 bg-slate-50'
            )}
          >
            <div className="text-[11px] text-slate-400">
              Created: {new Date(grn.createdAt).toLocaleDateString()}
            </div>
            <div className="flex items-center gap-2">
              {dueAmount > 0 && (
                <button
                  type="button"
                  onClick={() => {
                    onClose();
                    onSettleClick(grn);
                  }}
                  className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 text-white shadow-md shadow-emerald-500/20 transition-all"
                >
                  <Banknote className="w-3.5 h-3.5" />
                  Settle Due (Rs. {dueAmount.toFixed(2)})
                </button>
              )}
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
                Close
              </button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Lightbox Preview */}
      {lightboxIndex !== null && (
        <LightboxModal
          items={imagesList}
          initialIndex={lightboxIndex}
          onClose={() => setLightboxIndex(null)}
        />
      )}
    </>
  );
};

export default GRNDetailsModal;
