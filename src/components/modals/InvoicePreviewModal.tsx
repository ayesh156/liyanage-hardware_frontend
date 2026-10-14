import React, { useCallback, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useTheme } from '../../contexts/ThemeContext';
import { Invoice, Customer } from '../../types/index';
import { X, Printer } from 'lucide-react';
import { printInvoice } from './PrintInvoiceModal';
import { generateReceiptHTML } from '../../lib/receiptGenerator';

interface InvoicePreviewModalProps {
  invoice: Invoice;
  customer?: Customer | null;
  onClose: () => void;
  onEdit?: () => void;
}

/**
 * InvoicePreviewModal
 *
 * Unified Thermal Receipt Preview & Print Modal
 * -----------------------------------------------
 * Uses generateReceiptHTML from receiptGenerator.ts as the single source of truth,
 * guaranteeing 100% visual and layout parity between the modal preview, the live checkout
 * preview, and the physical print engine without stale duplicate inline JSX.
 */
export const InvoicePreviewModal: React.FC<InvoicePreviewModalProps> = ({
  invoice,
  customer,
  onClose,
  onEdit,
}) => {
  const { theme } = useTheme();
  const isDark = theme === 'dark';
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const scrollWrapperRef = useRef<HTMLDivElement>(null);

  const handlePrint = useCallback(() => {
    // 🌟 Unified Thermal Print Engine: guarantees exact 1:1 identical template, font size,
    //    and layout whether printed upon checkout or re-printed from invoice review.
    printInvoice(invoice, customer, 'si', 'Admin User').catch((err) => {
      console.warn('Thermal print failed, falling back to window.print():', err);
      window.print();
    });
  }, [invoice, customer]);

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [onClose]);

  useEffect(() => {
    const html = generateReceiptHTML(invoice, customer ?? null, 'si', 'Admin User');
    const iframe = iframeRef.current;
    if (!iframe) return;

    const doc = iframe.contentDocument || iframe.contentWindow?.document;
    if (!doc) return;

    doc.open();
    doc.write(html);
    doc.close();

    const syncModalHeight = () => {
      try {
        const body = doc.body;
        const shell = scrollWrapperRef.current;
        const receiptRoot = (body?.querySelector('.receipt-root') || body?.firstElementChild) as HTMLElement | null;

        if (doc.documentElement) {
          doc.documentElement.style.setProperty('margin', '0', 'important');
          doc.documentElement.style.setProperty('padding', '0', 'important');
          doc.documentElement.style.setProperty('overflow', 'hidden', 'important');
          doc.documentElement.style.setProperty('width', '100%', 'important');
          doc.documentElement.style.setProperty('max-width', '100%', 'important');
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

          // Fit modal available width (minus scrollbar margin)
          const availableWidth = Math.floor(shell?.clientWidth || iframe.clientWidth || baseWidth);
          const scaleFactor = availableWidth > 0 && baseWidth > 0 ? availableWidth / baseWidth : 1;

          // Apply CSS zoom to fit width naturally without horizontal clipping
          receiptRoot.style.setProperty('zoom', String(scaleFactor), 'important');
          receiptRoot.style.setProperty('transform', 'none', 'important');

          // Accurately capture rendered scaled height directly from receiptRoot
          // (Avoid reading body/documentElement scrollHeight which creates an inflationary height loop
          // and leaves empty space after the developer footer line)
          const scaledHeight = Math.ceil(
            Math.max(
              receiptRoot.getBoundingClientRect().height,
              unscaledContentHeight * scaleFactor
            )
          );

          // Set iframe height snugly with zero trailing blank space (+2px subpixel clearance)
          iframe.style.height = `${scaledHeight + 2}px`;
          iframe.style.width = '100%';
          iframe.style.maxWidth = '100%';
        }
      } catch (_) {}
    };

    iframe.onload = syncModalHeight;
    requestAnimationFrame(syncModalHeight);
    setTimeout(syncModalHeight, 60);
    setTimeout(syncModalHeight, 200);
    setTimeout(syncModalHeight, 600);
    window.addEventListener('resize', syncModalHeight);

    if ((doc as any).fonts && (doc as any).fonts.ready) {
      (doc as any).fonts.ready.then(() => syncModalHeight()).catch(() => {});
    }

    const images = Array.from(doc.images || []);
    images.forEach((img) => {
      if (!img.complete) {
        img.addEventListener('load', syncModalHeight);
        img.addEventListener('error', syncModalHeight);
      }
    });

    let resizeObserver: ResizeObserver | null = null;
    if (scrollWrapperRef.current && typeof ResizeObserver !== 'undefined') {
      resizeObserver = new ResizeObserver(() => syncModalHeight());
      resizeObserver.observe(scrollWrapperRef.current);
    }

    return () => {
      window.removeEventListener('resize', syncModalHeight);
      if (resizeObserver) resizeObserver.disconnect();
    };
  }, [invoice, customer]);

  const modalContent = (
    /* ── OVERLAY: Edge-to-edge full viewport coverage portaled to document.body ── */
    <div
      className="fixed inset-0 top-0 left-0 right-0 bottom-0 w-screen h-screen z-50 m-0 p-0 flex items-center justify-center bg-black/60 backdrop-blur-sm"
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        width: '100vw',
        height: '100vh',
        margin: 0,
        padding: 0,
        background: 'rgba(0, 0, 0, 0.65)',
        backdropFilter: 'blur(4px)',
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      {/* ── MODAL CONTAINER — snugly wrapped to 80mm thermal receipt width ── */}
      <div
        onClick={(e) => e.stopPropagation()}
        className="relative w-full max-w-[340px] rounded-2xl border shadow-2xl animate-fade-in mx-2 flex flex-col max-h-[90vh]"
        style={{
          background: isDark ? '#1e293b' : '#f8fafc',
          borderColor: isDark ? 'rgba(51,65,85,0.5)' : '#e2e8f0',
        }}
      >
        {/* ── Fixed Action Bar ── */}
        <div
          className={`flex-shrink-0 flex items-center justify-between px-3 py-2 border-b rounded-t-2xl ${
            isDark ? 'bg-slate-900/95 border-slate-700/50' : 'bg-white/95 border-slate-200'
          }`}
        >
          <div className="flex items-center gap-1.5 min-w-0">
            <span className={`text-xs font-bold truncate ${isDark ? 'text-white' : 'text-slate-900'}`}>
              Receipt
            </span>
            <span
              className={`px-1.5 py-0.5 rounded text-[9px] font-mono font-semibold truncate ${
                isDark ? 'bg-slate-800 text-slate-400' : 'bg-slate-100 text-slate-500'
              }`}
            >
              {invoice.invoiceNumber}
            </span>
          </div>
          <div className="flex items-center gap-1 flex-shrink-0">
            <button
              onClick={handlePrint}
              className="flex items-center gap-1 px-2.5 py-1 bg-gradient-to-r from-orange-500 to-rose-500 text-white text-xs font-semibold rounded-lg hover:from-orange-600 hover:to-rose-600 transition-all shadow"
            >
              <Printer className="w-3.5 h-3.5" /> Print
            </button>
            {onEdit && (
              <button
                onClick={onEdit}
                className={`px-2 py-1 text-xs font-semibold rounded-lg transition-all ${
                  isDark
                    ? 'bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700'
                    : 'bg-white hover:bg-slate-50 text-slate-700 border border-slate-200'
                }`}
              >
                Edit
              </button>
            )}
            <button
              onClick={onClose}
              className={`p-1 rounded-lg transition-colors ${
                isDark ? 'hover:bg-slate-800 text-slate-400' : 'hover:bg-slate-100 text-slate-500'
              }`}
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* ── SCROLLABLE RECEIPT CANVAS — outer wrapper handles smooth vertical scrolling ── */}
        <div
          ref={scrollWrapperRef}
          className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden custom-scrollbar p-2 box-border bg-slate-900/5"
        >
          <div className="w-full bg-white rounded-lg shadow-sm overflow-hidden box-border">
            <iframe
              ref={iframeRef}
              title="receipt-preview-modal"
              sandbox="allow-scripts allow-same-origin allow-modals"
              scrolling="no"
              style={{
                width: '100%',
                maxWidth: '100%',
                border: 'none',
                display: 'block',
                backgroundColor: '#ffffff',
                overflow: 'hidden',
                boxSizing: 'border-box',
                minWidth: '0',
              }}
            />
          </div>
        </div>
      </div>
    </div>
  );

  return typeof document !== 'undefined' ? createPortal(modalContent, document.body) : modalContent;
};

export default InvoicePreviewModal;