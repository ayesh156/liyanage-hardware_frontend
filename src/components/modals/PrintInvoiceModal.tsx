import { Invoice, Customer } from '../../types/index';
import { generateReceiptHTML } from '../../lib/receiptGenerator';

/**
 * printInvoice
 *
 * Unified Hidden Iframe Thermal Print Engine
 * -------------------------------------------
 * Uses generateReceiptHTML from receiptGenerator.ts as the single source of truth.
 * Creates an isolated, off-screen 80mm iframe to trigger crisp thermal printing
 * with 1:1 visual fidelity to the live checkout preview and the review modal.
 */
export const printInvoice = (
  invoice: Invoice,
  customer?: Customer | null,
  language: 'en' | 'si' = 'si',
  cashierName: string = 'Admin User'
): Promise<void> => {
  return new Promise((resolve, reject) => {
    try {
      const printContent = generateReceiptHTML(invoice, customer, language, cashierName);

      // 1. Clean up any existing stale print iframes from previous print jobs
      const staleIframes = document.querySelectorAll('iframe#pos-print-iframe, iframe[data-role="pos-print-engine"]');
      staleIframes.forEach((el) => {
        try { el.remove(); } catch (_) {}
      });

      // 2. Create an isolated hidden iframe with exact 80mm layout dimensions
      //    Rendered off-screen (left: -9999px) rather than width: 0, preventing
      //    Chromium viewport collapsing, text-size-adjust errors, and font distortion.
      const iframe = document.createElement('iframe');
      iframe.id = 'pos-print-iframe';
      iframe.setAttribute('data-role', 'pos-print-engine');
      iframe.setAttribute('aria-hidden', 'true');
      iframe.setAttribute('title', 'thermal-receipt-print-frame');
      iframe.style.cssText = [
        'position:fixed',
        'top:0',
        'left:-9999px',
        'width:80mm',
        'height:100vh',
        'border:none',
        'opacity:0',
        'pointer-events:none',
        'z-index:-9999',
        'visibility:hidden',
      ].join(';');
      document.body.appendChild(iframe);

      const doc = iframe.contentWindow?.document ?? iframe.contentDocument;
      if (!doc) {
        try { iframe.remove(); } catch (_) {}
        reject(new Error('Cannot access isolated print iframe document'));
        return;
      }

      doc.open();
      doc.write(printContent);
      doc.close();

      let isCleanedUp = false;
      const cleanupIframe = () => {
        if (isCleanedUp) return;
        isCleanedUp = true;
        try {
          if (iframe.parentNode) {
            iframe.parentNode.removeChild(iframe);
          } else {
            iframe.remove();
          }
        } catch (_) {}
        resolve();
      };

      const dispatchPrint = () => {
        try {
          const win = iframe.contentWindow;
          if (!win) {
            cleanupIframe();
            return;
          }

          // Modern browsers fire onafterprint when the print modal is either confirmed or cancelled
          win.onafterprint = cleanupIframe;

          win.focus();
          win.print();
        } catch (err) {
          console.warn('Print trigger warning:', err);
        }

        // Safety fallback: ensure iframe is completely unmounted even if onafterprint is suppressed
        setTimeout(cleanupIframe, 2000);
      };

      // 3. Wait for all resources (images & fonts) to settle before invoking print
      //    Guarantees the invoice logo has non-zero height on the very first print job,
      //    preventing logo/header text overlapping.
      const handleReadyAndPrint = () => {
        const images = Array.from(doc.images || []);
        const pendingImages = images.filter((img) => !img.complete);

        if (pendingImages.length > 0) {
          let resolved = 0;
          const onImgDone = () => {
            resolved++;
            if (resolved >= pendingImages.length) {
              setTimeout(dispatchPrint, 60);
            }
          };
          pendingImages.forEach((img) => {
            img.onload = onImgDone;
            img.onerror = onImgDone;
          });
          // Fallback maximum wait for images: 350ms
          setTimeout(dispatchPrint, 350);
        } else {
          setTimeout(dispatchPrint, 60);
        }
      };

      if (
        iframe.contentDocument?.readyState === 'complete' ||
        iframe.contentWindow?.document?.readyState === 'complete'
      ) {
        handleReadyAndPrint();
      } else {
        iframe.onload = handleReadyAndPrint;
      }
    } catch (err) {
      reject(err);
    }
  });
};