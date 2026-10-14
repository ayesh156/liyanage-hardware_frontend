import { useCallback } from 'react';

/**
 * useHiddenIframePrint
 *
 * "Hidden Iframe Dynamic Print" architectural pattern.
 * Instead of using fragile `@media print` CSS overrides that can produce
 * blank pages when hidden inside modals/dialogs, this hook creates a
 * completely isolated browsing context via a hidden <iframe>.
 *
 * The print pipeline:
 * 1. Extract the innerHTML of the receipt container element.
 * 2. Construct a standalone HTML document with:
 *    - Inline CSS (80mm thermal receipt styles)
 *    - The extracted receipt markup
 * 3. Write the document into a hidden iframe's contentWindow.
 * 4. Call contentWindow.print() — the browser prints ONLY the iframe
 *    content with zero layout leakage from the parent dashboard.
 * 5. Clean up: remove the iframe after a short delay.
 *
 * Benefits:
 * - Zero layout leaking: parent modal, overlay, sidebar never interfere.
 * - WYSIWYG accuracy: printed output matches the preview exactly.
 * - No global CSS conflicts: the iframe is a clean document context.
 */
export function useHiddenIframePrint() {
  const printViaHiddenIframe = useCallback(
    (receiptElement: HTMLElement | null): Promise<void> => {
      return new Promise((resolve, reject) => {
        try {
          if (!receiptElement) {
            reject(new Error('Receipt element ref is null'));
            return;
          }

          // ── 1. Extract receipt HTML ──
          const receiptHTML = receiptElement.innerHTML;

          // ── 2. Build a standalone document with thermal-receipt styling ──
          const printDocument = buildPrintDocument(receiptHTML);

          // ── 3. Create hidden iframe with exact 80mm layout dimensions ──
          // Clean up any stale iframes
          const stale = document.querySelectorAll('iframe[data-role="receipt-print-frame"]');
          stale.forEach((el) => {
            try { el.remove(); } catch (_) {}
          });

          const iframe = document.createElement('iframe');
          iframe.setAttribute('data-role', 'receipt-print-frame');
          iframe.setAttribute(
            'style',
            'position:fixed; top:0; left:-9999px; width:80mm; height:100vh; border:none; opacity:0; pointer-events:none; z-index:-9999; visibility:hidden;'
          );
          iframe.setAttribute('title', 'thermal-receipt-print-frame');
          iframe.setAttribute('aria-hidden', 'true');

          // Append to body so the iframe has a document context
          document.body.appendChild(iframe);

          // ── 4. Write the print document into the iframe ──
          const iframeDoc =
            iframe.contentDocument || iframe.contentWindow?.document;
          if (!iframeDoc) {
            try { iframe.remove(); } catch (_) {}
            reject(new Error('Could not access iframe document'));
            return;
          }

          iframeDoc.open();
          iframeDoc.write(printDocument);
          iframeDoc.close();

          let isCleanedUp = false;
          const cleanup = () => {
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

          // ── 5. Wait for images/fonts to load, then print ──
          const handlePrint = () => {
            try {
              const win = iframe.contentWindow;
              if (!win) {
                cleanup();
                return;
              }

              // Clean up immediately upon print dialog close
              win.onafterprint = cleanup;

              // Focus the iframe window to ensure print dialog targets it
              win.focus();
              win.print();

              // Fallback cleanup timer in case onafterprint doesn't fire
              setTimeout(cleanup, 2000);
            } catch (printErr) {
              cleanup();
              reject(printErr);
            }
          };

          // Wait for images inside iframe
          const waitForImagesAndPrint = () => {
            const images = Array.from(iframeDoc.images || []);
            const pending = images.filter((img) => !img.complete);
            if (pending.length > 0) {
              let count = 0;
              const onDone = () => {
                count++;
                if (count >= pending.length) setTimeout(handlePrint, 50);
              };
              pending.forEach((img) => {
                img.onload = onDone;
                img.onerror = onDone;
              });
              setTimeout(handlePrint, 350);
            } else {
              setTimeout(handlePrint, 50);
            }
          };

          // If the iframe document is already loaded, print immediately
          if (
            iframeDoc.readyState === 'complete' ||
            iframeDoc.readyState === 'interactive'
          ) {
            waitForImagesAndPrint();
          } else {
            iframe.onload = waitForImagesAndPrint;
          }
        } catch (err) {
          reject(err);
        }
      });
    },
    []
  );

  return { printViaHiddenIframe };
}

/**
 * Builds a standalone HTML document string for the 80mm thermal receipt.
 * Includes all required styles, page sizing, and print-color-adjust flags.
 */
function buildPrintDocument(receiptHTML: string): string {
  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=80mm, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
  <title>Thermal Receipt</title>
  <style>
    /* ── Page setup for 80mm thermal roll ── */
    @page {
      size: 80mm auto;
      margin: 0 !important;
    }

    * {
      box-sizing: border-box !important;
      margin: 0;
      padding: 0;
      -webkit-text-size-adjust: 100% !important;
      text-size-adjust: 100% !important;
      zoom: 100% !important;
      -webkit-print-color-adjust: exact !important;
      print-color-adjust: exact !important;
      color-adjust: exact !important;
    }

    @media print {
      * {
        -webkit-print-color-adjust: exact !important;
        print-color-adjust: exact !important;
        color-adjust: exact !important;
      }
      html, body {
        width: 80mm !important;
        max-width: 80mm !important;
        min-width: 80mm !important;
        margin: 0 !important;
        padding: 0 !important;
        -webkit-text-size-adjust: 100% !important;
        text-size-adjust: 100% !important;
        zoom: 100% !important;
      }
    }

    html, body {
      width: 80mm !important;
      max-width: 80mm !important;
      min-width: 80mm !important;
      min-height: auto;
      margin: 0 !important;
      padding: 2px !important;
      background: #ffffff !important;
      -webkit-text-size-adjust: 100% !important;
      text-size-adjust: 100% !important;
      zoom: 100% !important;
      font-family: 'Segoe UI', Arial, sans-serif;
      font-size: 12px;
      color: #000000;
      font-weight: 700;
      line-height: 1.4;
    }

    .receipt-print-root {
      width: 76mm;
      max-width: 100%;
      margin: 0 auto;
      background: #ffffff;
      color: #000000;
      font-weight: 700;
    }

    /* ── GRADIENT FALLBACK: black background that CANNOT be stripped ──
       linear-gradient(#000,#000) renders identically to background:#000
       but bypasses ALL browser background-stripping rules            */
    .print-black-box {
      background-color: #000000 !important;
      background-image: linear-gradient(#000000, #000000) !important;
      -webkit-print-color-adjust: exact !important;
      print-color-adjust: exact !important;
      color-adjust: exact !important;
      border: 2px solid #000000 !important;
    }
    /* White text inside black boxes — NOT overridden by any * rule */
    .print-black-box,
    .print-black-box span,
    .print-black-box div,
    .print-black-box * {
      color: #ffffff !important;
    }

    /* ── PAID BADGE — gradient black bg + thick border matrix ── */
    .print-badge-paid {
      background-color: #000000 !important;
      background-image: linear-gradient(#000000, #000000) !important;
      -webkit-print-color-adjust: exact !important;
      print-color-adjust: exact !important;
      color-adjust: exact !important;
      border: 2px solid #000000 !important;
      display: inline-block !important;
    }
    .print-badge-paid,
    .print-badge-paid * {
      color: #ffffff !important;
    }

    /* ── PENDING BADGE — white bg, black border ── */
    .print-badge-pending {
      background-color: #ffffff !important;
      border: 2px solid #000000 !important;
    }
    .print-badge-pending,
    .print-badge-pending * {
      color: #000000 !important;
    }

    /* ── All other receipt text defaults to black ── */
    .receipt-print-root > *,
    .receipt-print-root div:not(.print-black-box):not(.print-badge-paid),
    .receipt-print-root span:not(.print-black-box *):not(.print-badge-paid *) {
      color: #000000;
    }

    .strikethrough-price {
      text-decoration: line-through !important;
      font-weight: 700 !important;
    }

    .receipt-item {
      page-break-inside: avoid;
      break-inside: avoid;
    }

    a { text-decoration: none; }
  </style>
</head>
<body>
  <div class="receipt-print-root">
    ${receiptHTML}
  </div>
</body>
</html>`;
}