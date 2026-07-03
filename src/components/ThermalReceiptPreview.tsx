import React, { useEffect, useRef, memo } from 'react';
import { useTheme } from '../contexts/ThemeContext';
import { Invoice, InvoiceItem, Customer } from '../types/index';
import { generateReceiptHTML } from '../lib/receiptGenerator';

export interface ThermalReceiptPreviewProps {
  /** Live cart items from QuickCheckout state */
  items: Array<InvoiceItem & {
    displayPrice?: number;
    ourPrice?: number;
    salesPrice?: number;
    lastPrice?: number;
    productNameSi?: string;
  }>;
  discount: number;
  receivedAmount: number;
  paymentMethod: 'cash' | 'credit';
  subtotal: number;
  total: number;
  customer?: Customer | null;
  invoiceNumber?: string;
  language?: 'en' | 'si';
}

const ThermalReceiptPreview: React.FC<ThermalReceiptPreviewProps> = memo(({
  items,
  discount,
  receivedAmount,
  paymentMethod,
  subtotal,
  total,
  customer,
  invoiceNumber = 'PREVIEW',
  language = 'si',
}) => {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const { theme } = useTheme();
  const isDark = theme === 'dark';

  useEffect(() => {
    const today = new Date().toISOString().split('T')[0];
    const changeAmount = receivedAmount > total ? receivedAmount - total : 0;

    // Build a live Invoice object mirroring what handleCheckout produces
    const previewInvoice: Invoice = {
      id: 'preview',
      invoiceNumber,
      customerId: customer?.id ?? 'walk-in',
      customerName: customer?.name ?? 'සාමාන්‍ය පාරිභෝගිකයා',
      items: items.map(item => ({
        ...item,
        // Strict field extraction — no || fallback that would corrupt 0-value prices
        salesPrice:   Number(item.salesPrice  ?? item.ourPrice ?? item.unitPrice),
        unitPrice:    Number(item.salesPrice  ?? item.ourPrice ?? item.unitPrice),
        total:        Number(item.salesPrice  ?? item.ourPrice ?? item.unitPrice) * item.quantity,
        displayPrice: Number(item.displayPrice ?? item.unitPrice),
        ourPrice:     Number(item.salesPrice  ?? item.ourPrice ?? item.unitPrice),
        cost:         Number((item as any).cost      ?? 0),
        lastPrice:    Number((item as any).lastPrice ?? 0),
      })) as any,
      subtotal,
      discount,
      tax: 0,
      total,
      receivedAmount: receivedAmount > 0 ? receivedAmount : undefined,
      changeAmount: changeAmount > 0 ? changeAmount : undefined,
      issueDate: today,
      dueDate: today,
      status: paymentMethod === 'credit' ? 'pending' : 'paid',
      paymentMethod,
    };

    const html = generateReceiptHTML(previewInvoice, customer ?? null, language);

    const iframe = iframeRef.current;
    if (!iframe) return;
    const doc = iframe.contentDocument || iframe.contentWindow?.document;
    if (!doc) return;
    doc.open();
    doc.write(html);
    doc.close();

    // Resize iframe to match receipt content height
    const resize = () => {
      try {
        const body = iframe.contentDocument?.body;
        if (body) {
          iframe.style.height = body.scrollHeight + 'px';
        }
      } catch (_) {}
    };
    iframe.onload = resize;
    setTimeout(resize, 200);
  }, [items, discount, receivedAmount, paymentMethod, subtotal, total, customer, invoiceNumber, language]);

  return (
    <div className={`${isDark ? 'bg-slate-900 border-slate-700' : 'bg-white border-slate-700'} border-2 shadow-lg rounded-xl p-4 flex flex-col gap-3`}>
      {/* Header bar */}
      <div className={`flex items-center justify-between border-b pb-2 ${isDark ? 'border-slate-700' : 'border-slate-600'}`}>
        <span className={`text-xs font-bold uppercase tracking-wider flex items-center gap-1.5 ${isDark ? 'text-white' : 'text-slate-900'}`}>
          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse inline-block" />
          Live Receipt Preview
        </span>
        <span className={`text-[10px] font-bold font-mono ${isDark ? 'text-slate-300' : 'text-slate-800'}`}>{invoiceNumber}</span>
      </div>

      {/* Paper receipt container */}
      <div className={`rounded-lg overflow-hidden shadow-xl ${isDark ? 'bg-slate-950 shadow-slate-950/80 ring-1 ring-slate-800' : 'bg-white shadow-slate-700/40 ring-1 ring-slate-700'}`}>
        <iframe
          ref={iframeRef}
          title="receipt-preview"
          sandbox="allow-same-origin"
          scrolling="no"
          style={{
            width: '100%',
            border: 'none',
            display: 'block',
            minHeight: '200px',
            backgroundColor: '#ffffff',
          }}
        />
      </div>
    </div>
  );
});

ThermalReceiptPreview.displayName = 'ThermalReceiptPreview';
export default ThermalReceiptPreview;