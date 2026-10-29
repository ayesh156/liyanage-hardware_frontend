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
  /** Dynamically rendered cashier's full name from logged-in user */
  cashierName?: string;
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
  cashierName = 'Admin User',
}) => {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const previewShellRef = useRef<HTMLDivElement>(null);
  const { theme } = useTheme();
  const isDark = theme === 'dark';

  useEffect(() => {
    const today = new Date().toISOString();
    const tenderAmount = Number(receivedAmount || 0);
    const safeTender = isNaN(tenderAmount) || tenderAmount < 0 ? 0 : tenderAmount;
    const changeAmount = safeTender > total ? safeTender - total : 0;

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
      receivedAmount: safeTender,
      changeAmount: changeAmount !== 0 ? changeAmount : undefined,
      issueDate: today,
      dueDate: today,
      status: paymentMethod === 'credit' ? 'pending' : 'paid',
      paymentMethod,
    };

    const html = generateReceiptHTML(previewInvoice, customer ?? null, language, cashierName);

    const iframe = iframeRef.current;
    if (!iframe) return;
    const doc = iframe.contentDocument || iframe.contentWindow?.document;
    if (!doc) return;
    doc.open();
    doc.write(html);
    doc.close();

    const applyPreviewScaling = () => {
      try {
        const body = doc.body;
        const shell = previewShellRef.current;
        const receiptRoot = (body?.querySelector('.receipt-root') || body?.firstElementChild) as HTMLElement | null;

        if (doc.documentElement) {
          doc.documentElement.style.setProperty('margin', '0', 'important');
          doc.documentElement.style.setProperty('padding', '0', 'important');
          doc.documentElement.style.setProperty('overflow', 'hidden', 'important');
          doc.documentElement.style.setProperty('width', '100%', 'important');
          doc.documentElement.style.setProperty('max-width', '100%', 'important');
          doc.documentElement.style.setProperty('min-width', '0', 'important');
          doc.documentElement.style.setProperty('box-sizing', 'border-box', 'important');
          doc.documentElement.style.setProperty('height', 'auto', 'important');
        }

        if (body) {
          body.style.setProperty('margin', '0', 'important');
          body.style.setProperty('padding', '0', 'important');
          // Snug zero bottom padding so preview terminates directly after footer
          body.style.setProperty('padding-bottom', '0', 'important');
          body.style.setProperty('background', '#ffffff', 'important');
          body.style.setProperty('overflow', 'hidden', 'important');
          body.style.setProperty('width', '100%', 'important');
          body.style.setProperty('max-width', '100%', 'important');
          body.style.setProperty('min-width', '0', 'important');
          body.style.setProperty('box-sizing', 'border-box', 'important');
          body.style.setProperty('display', 'block', 'important');
          body.style.setProperty('height', 'auto', 'important');
        }

        if (receiptRoot) {
          // Temporarily reset zoom/transform to measure natural unscaled 80mm width and content height
          receiptRoot.style.zoom = '1';
          receiptRoot.style.transform = 'none';
          receiptRoot.style.setProperty('margin', '0 auto', 'important');
          receiptRoot.style.setProperty('display', 'block', 'important');
          receiptRoot.style.setProperty('box-sizing', 'border-box', 'important');

          const baseWidth = receiptRoot.offsetWidth || 302.36; // 80mm base roll width in pixels
          // Measure unscaled content height directly from receiptRoot (avoiding doc/body scrollHeight
          // which can get locked to previous iframe dimensions)
          const unscaledContentHeight = Math.ceil(
            Math.max(
              receiptRoot.offsetHeight,
              receiptRoot.scrollHeight,
              receiptRoot.getBoundingClientRect().height
            )
          );

          // Measure container inner available width (excluding vertical scrollbar)
          const availableWidth = Math.floor(shell?.clientWidth || iframe.clientWidth || baseWidth);
          // Scale to fit available card width cleanly
          const dynamicScale = availableWidth > 0 && baseWidth > 0 ? (availableWidth / baseWidth) : 1;

          // Apply CSS zoom for seamless, layout-aware scaling
          receiptRoot.style.setProperty('zoom', String(dynamicScale), 'important');
          receiptRoot.style.setProperty('transform', 'none', 'important');

          // Accurately capture rendered scaled height directly from receiptRoot
          // (Avoid reading body/documentElement scrollHeight which creates an inflationary height loop
          // and leaves empty space after the developer footer line)
          const scaledHeight = Math.ceil(
            Math.max(
              receiptRoot.getBoundingClientRect().height,
              unscaledContentHeight * dynamicScale
            )
          );

          // Dynamically sync iframe height snugly (+2px subpixel clearance, zero trailing blank space)
          iframe.style.height = `${scaledHeight + 2}px`;
          iframe.style.width = '100%';
          iframe.style.maxWidth = '100%';
        }
      } catch (_) {}
    };

    iframe.onload = applyPreviewScaling;
    requestAnimationFrame(applyPreviewScaling);
    setTimeout(applyPreviewScaling, 60);
    setTimeout(applyPreviewScaling, 200);
    setTimeout(applyPreviewScaling, 600);
    window.addEventListener('resize', applyPreviewScaling);

    // Re-scale once web fonts finish loading
    if ((doc as any).fonts && (doc as any).fonts.ready) {
      (doc as any).fonts.ready.then(() => {
        applyPreviewScaling();
      }).catch(() => {});
    }

    // Attach listeners to receipt images (e.g. invoice logo) so height adapts on load
    const images = Array.from(doc.images || []);
    images.forEach(img => {
      if (!img.complete) {
        img.addEventListener('load', applyPreviewScaling);
        img.addEventListener('error', applyPreviewScaling);
      }
    });

    // ResizeObserver ensures seamless recalculation when parent container/layout shifts
    let resizeObserver: ResizeObserver | null = null;
    if (previewShellRef.current && typeof ResizeObserver !== 'undefined') {
      resizeObserver = new ResizeObserver(() => {
        applyPreviewScaling();
      });
      resizeObserver.observe(previewShellRef.current);
    }

    return () => {
      window.removeEventListener('resize', applyPreviewScaling);
      if (resizeObserver) {
        resizeObserver.disconnect();
      }
    };
  }, [items, discount, receivedAmount, paymentMethod, subtotal, total, customer, invoiceNumber, language, cashierName]);

  return (
    <div
      className={`w-full h-full max-h-[calc(100vh-140px)] ${
        isDark ? 'bg-slate-900 border-slate-700' : 'bg-white border-slate-700'
      } border-2 shadow-lg rounded-xl p-3 flex flex-col gap-2.5 overflow-hidden box-border`}
    >
      {/* Header bar - stays pinned at top */}
      <div className={`flex items-center justify-between border-b pb-2 flex-shrink-0 ${isDark ? 'border-slate-700' : 'border-slate-600'}`}>
        <span className={`text-xs font-bold uppercase tracking-wider flex items-center gap-1.5 ${isDark ? 'text-white' : 'text-slate-900'}`}>
          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse inline-block" />
          Live Receipt Preview
        </span>
        <span className={`text-[10px] font-bold font-mono ${isDark ? 'text-slate-300' : 'text-slate-800'}`}>{invoiceNumber}</span>
      </div>

      {/* ── Scrollable Receipt Viewport Container (Edge-to-edge scaling with custom-scrollbar) ── */}
      <div
        ref={previewShellRef}
        className={`w-full flex-1 min-h-0 overflow-y-auto overflow-x-hidden custom-scrollbar p-0 m-0 bg-slate-900/5 box-border ${
          isDark ? 'rounded-xl shadow-slate-950/80 ring-1 ring-slate-800' : 'rounded-xl shadow-slate-700/40 ring-1 ring-slate-700'
        }`}
      >
        <div className="w-full min-w-full bg-white text-black p-0 m-0 shadow-none border-x-0 flex flex-col break-words box-border" style={{ width: '100%' }}>
          <iframe
            ref={iframeRef}
            title="receipt-preview"
            sandbox="allow-scripts allow-same-origin allow-modals"
            scrolling="no"
            style={{
              width: '100%',
              maxWidth: '100%',
              border: 'none',
              display: 'block',
              minHeight: '0',
              backgroundColor: '#ffffff',
              overflow: 'hidden',
              boxSizing: 'border-box',
              minWidth: '0',
            }}
          />
        </div>
      </div>
    </div>
  );
});

ThermalReceiptPreview.displayName = 'ThermalReceiptPreview';
export default ThermalReceiptPreview;