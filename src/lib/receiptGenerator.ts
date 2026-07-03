import { Invoice, Customer } from '../types/index';
import { translateToSinhala } from './sinhalaTranslator';

/**
 * Generates the complete 80mm thermal receipt HTML string.
 * Used by both the print executor (PrintInvoiceModal) and the
 * live ThermalReceiptPreview component — single source of truth.
 */
export const generateReceiptHTML = (
  invoice: Invoice,
  customer?: Customer | null,
  language: 'en' | 'si' = 'si'
): string => {
  const isPaid = invoice.status === 'paid';
  const finalDiscount = invoice.discount || 0;
  const receivedAmount = invoice.receivedAmount || 0;
  const changeAmount =
    invoice.changeAmount ||
    (receivedAmount > 0 ? Math.max(0, receivedAmount - invoice.total) : 0);

  // Customer savings: Σ((displayPrice - salesPrice) × qty) + manual discount
  const totalItemDiscounts = invoice.items.reduce((sum, item) => {
    const ext = item as any;
    const dp   = Number(ext.displayPrice ?? ext.originalPrice ?? item.unitPrice ?? 0);
    const sp   = Number(ext.salesPrice   ?? ext.ourPrice      ?? ext.lastPrice ?? item.unitPrice ?? 0);
    const gap  = (dp - sp) * item.quantity;
    return sum + (gap > 0 ? gap : 0);
  }, 0);

  const isWalkIn = !customer || customer.id === 'walk-in';
  const customerName = customer?.name
    ? ((customer as any).nameSi || translateToSinhala(customer.name))
    : 'සාමාන්‍ය පාරිභෝගිකයා';
  const customerPhone = !isWalkIn ? (customer?.phone ?? '') : '';

  const itemsHtml = invoice.items
    .map((item) => {
      const ext = item as any;
      const displayName =
        item.productNameSi || translateToSinhala(item.productName);
      // Col 2 (25%): displayPrice — marked/RRP, conditionally struck-through
      //   ONLY apply line-through if salesPrice < displayPrice.
      //   If prices are equal or salesPrice > displayPrice, NO strikethrough.
      // Col 3 (25%): salesPrice  — our actual billing rate ("අපේ මිල")
      // Col 4 (35%): salesPrice × qty — line total
      const displayPrice = Number(
        ext.displayPrice ?? ext.originalPrice ?? item.unitPrice ?? 0
      );
      const salesPrice = Number(
        ext.salesPrice ?? ext.ourPrice ?? ext.lastPrice ?? item.unitPrice ?? 0
      );
      const lineTotal = salesPrice * item.quantity;
      const showStrikethrough = salesPrice < displayPrice;

      // Display quantity with up to 3 decimal places (e.g., 0.5, 0.125, 1.5)
      const displayQty = Number(item.quantity) % 1 === 0
        ? Number(item.quantity).toString()
        : Number(item.quantity).toFixed(3).replace(/\.?0+$/, '');
      return `
      <div style="border-bottom:1px dashed #000;padding:4px 0;">
        <div style="font-weight:800;font-size:12px;color:#000;margin-bottom:2px;word-break:break-word;">${displayName}</div>
        <div style="display:flex;justify-content:space-between;font-size:11px;font-weight:700;font-family:'Courier New',monospace;color:#000;width:100%;">
          <span style="width:15%;text-align:left;flex-shrink:0;">${displayQty}</span>
          <span style="width:25%;text-align:right;${showStrikethrough ? 'text-decoration:line-through;' : ''}color:#000;opacity:0.6;flex-shrink:0;">${displayPrice.toLocaleString('en-US', { minimumFractionDigits: 2 })}</span>
          <span style="width:25%;text-align:right;font-weight:800;color:#000;flex-shrink:0;">${salesPrice.toLocaleString('en-US', { minimumFractionDigits: 2 })}</span>
          <span style="width:35%;text-align:right;font-weight:900;color:#000;flex-shrink:0;">${lineTotal.toLocaleString('en-US', { minimumFractionDigits: 2 })}</span>
        </div>
      </div>`;
    })
    .join('');

  const totalSavings = totalItemDiscounts + finalDiscount;

  return `<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8"/>
<style>
  @import url('https://fonts.googleapis.com/css2?family=Noto+Sans+Sinhala:wght@400;700;900&display=swap');
  /* ════════════════════════════════════════════════════════
     THERMAL RECEIPT PRINT MASTER RESET — receiptGenerator
     Gradient fallback strategy: background-image:linear-gradient
     is NEVER stripped by any browser print engine.
     * color override REMOVED — it silently kills white text.
     ════════════════════════════════════════════════════════ */
  * {
    box-sizing: border-box;
    margin: 0;
    padding: 0;
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
  }
  /* ── Grand Total black box — gradient cannot be stripped ── */
  .wb {
    background-color: #000000 !important;
    background-image: linear-gradient(#000000, #000000) !important;
    -webkit-print-color-adjust: exact !important;
    print-color-adjust: exact !important;
    color-adjust: exact !important;
    border: 2px solid #000000 !important;
  }
  .wb, .wb *, .wb span, .wb div { color: #ffffff !important; }
  /* ── Paid badge — gradient black bg ── */
  .status-paid-text {
    background-color: #000000 !important;
    background-image: linear-gradient(#000000, #000000) !important;
    -webkit-print-color-adjust: exact !important;
    print-color-adjust: exact !important;
    color-adjust: exact !important;
    border: 2px solid #000000 !important;
    color: #ffffff !important;
  }
  .status-paid-text * { color: #ffffff !important; }
  hr { border: none !important; border-top: 1px dashed #000000 !important; }
  body {
    font-family: 'Segoe UI', 'Noto Sans Sinhala', Arial, sans-serif;
    background: #ffffff;
    font-weight: 700;
    font-size: 12px;
    line-height: 1.4;
    width: 76mm;
    color: #000000;
  }
</style>
</head>
<body>
<div style="width:76mm;padding:2px;margin:0 auto;background:#fff;font-family:'Segoe UI','Noto Sans Sinhala',Arial,sans-serif;font-size:12px;font-weight:700;color:#000;">

  <!-- HEADER -->
  <div style="text-align:center;padding-bottom:4px;border-bottom:2px double #000;">
    <img src="/inv_logo.png" alt="" style="width:90px;height:auto;display:block;margin:0 auto;"/>
    <div style="margin:5px 0 3px;border-bottom:1px solid #000;padding-bottom:3px;">
      <div style="font-size:22px;font-weight:900;color:#000;line-height:1.1;">ලියනගේ හාඩ්වෙයාර්</div>
    </div>
    <div style="font-size:11px;font-weight:700;color:#000;line-height:1.5;">
      හක්මන පාර, දෙයියන්දර<br/>
      දුරකථන: 0773751805 / 0412268217<br/>
      Email: liyanagehardware1986@gmail.com
    </div>
  </div>

  <!-- INVOICE META -->
  <div style="display:flex;justify-content:space-between;align-items:center;padding:4px 0;border-bottom:2px dashed #000;">
    <div>
      <div style="font-size:10px;font-weight:700;">බිල්පත</div>
      <div style="font-size:13px;font-weight:800;font-family:'Courier New',monospace;">${invoice.invoiceNumber}</div>
    </div>
    <div style="text-align:center;">
      <div style="display:inline-block;padding:2px 6px;border:2px solid #000000;border-radius:3px;font-size:10px;font-weight:800;background-color:${isPaid ? '#000000' : '#ffffff'} !important;background-image:${isPaid ? 'linear-gradient(#000000,#000000)' : 'none'} !important;-webkit-print-color-adjust:exact;print-color-adjust:exact;color-adjust:exact;">
        <span style="color:${isPaid ? '#ffffff' : '#000000'} !important;font-weight:800;">${isPaid ? '✓ ගෙවා ඇත' : '○ ගෙවිය යුතු'}</span>
      </div>
    </div>
    <div style="text-align:right;">
      <div style="font-size:10px;font-weight:700;">දිනය</div>
      <div style="font-size:11px;font-weight:800;">${new Date(invoice.issueDate).toLocaleDateString('si-LK', { day: '2-digit', month: 'short', year: '2-digit' })}</div>
    </div>
  </div>

  ${!isWalkIn ? `
  <!-- CUSTOMER -->
  <div style="padding:3px 0;border-bottom:2px dashed #000;">
    <span style="font-size:10px;font-weight:700;">පාරිභෝගිකයා: </span>
    <span style="font-size:12px;font-weight:800;">${customerName}</span>
    ${customerPhone ? `<span style="float:right;font-size:11px;font-weight:700;">${customerPhone}</span>` : ''}
  </div>` : ''}

  <!-- ITEMS HEADER -->
  <div style="padding:3px 0 2px;border-bottom:2px solid #000;">
    <div style="font-size:11px;font-weight:800;margin-bottom:3px;">භාණ්ඩය</div>
    <div style="display:flex;justify-content:space-between;font-size:11px;font-weight:800;font-family:'Courier New',monospace;width:100%;">
      <span style="width:15%;text-align:left;flex-shrink:0;">ප්‍රමාණය</span>
      <span style="width:25%;text-align:right;flex-shrink:0;">සඳහන් මිල</span>
      <span style="width:25%;text-align:right;flex-shrink:0;">අපේ මිල</span>
      <span style="width:35%;text-align:right;flex-shrink:0;">එකතුව</span>
    </div>
  </div>

  <!-- ITEMS -->
  <div style="padding:2px 0;">${itemsHtml}</div>

  <!-- TOTALS -->
  <div style="border-top:2px solid #000;padding-top:4px;margin-top:2px;">
    ${finalDiscount > 0 ? `
    <div style="display:flex;justify-content:space-between;padding:2px 0;font-size:12px;font-weight:700;">
      <span>වට්ටම්</span>
      <span style="font-family:'Courier New',monospace;font-weight:800;">-${finalDiscount.toLocaleString('en-US', { minimumFractionDigits: 2 })}</span>
    </div>` : ''}

    <!-- GRAND TOTAL -->
    <div class="wb" style="background-color:#000000 !important;background-image:linear-gradient(#000000,#000000) !important;color:#ffffff !important;padding:6px;margin-top:4px;border-radius:3px;border:2px solid #000000;-webkit-print-color-adjust:exact;print-color-adjust:exact;color-adjust:exact;">
      <div style="display:flex;justify-content:space-between;align-items:center;">
        <span style="font-size:15px;font-weight:800;color:#ffffff !important;">මුළු එකතුව</span>
        <span style="font-size:19px;font-weight:900;font-family:'Courier New',monospace;letter-spacing:1px;color:#ffffff !important;">${invoice.total.toLocaleString('en-US', { minimumFractionDigits: 2 })}</span>
      </div>
    </div>

    <!-- ITEM COUNT -->
    <div style="display:flex;justify-content:space-between;padding:3px 0;font-size:12px;font-weight:700;margin-top:2px;">
      <span>භාණ්ඩ සංඛ්‍යාව</span>
      <span style="font-weight:800;">[${invoice.items.reduce((a, i) => a + i.quantity, 0)}]</span>
    </div>

    ${totalSavings > 0 ? `
    <!-- SAVINGS -->
    <div style="display:flex;justify-content:space-between;padding:4px 0;font-size:13px;font-weight:800;border-top:2px dashed #000;margin-top:4px;">
      <span>ඔබ ලැබූ ලාභය</span>
      <span style="font-family:'Courier New',monospace;font-weight:900;">${totalSavings.toLocaleString('en-US', { minimumFractionDigits: 2 })}</span>
    </div>` : ''}
  </div>

  ${receivedAmount > 0 ? `
  <!-- PAYMENT -->
  <div style="border-top:2px dashed #000;margin-top:4px;padding-top:4px;">
    <div style="border:1px solid #000;padding:4px 6px;border-radius:3px;">
      <div style="display:flex;justify-content:space-between;padding:2px 0;font-size:12px;font-weight:700;">
        <span>ගෙවූ මුදල</span>
        <span style="font-family:'Courier New',monospace;font-weight:800;">${receivedAmount.toLocaleString('en-US', { minimumFractionDigits: 2 })}</span>
      </div>
      <div style="display:flex;justify-content:space-between;padding:2px 0;font-size:12px;font-weight:700;">
        <span>ඉතිරි මුදල</span>
        <span style="font-family:'Courier New',monospace;font-weight:800;">${changeAmount.toLocaleString('en-US', { minimumFractionDigits: 2 })}</span>
      </div>
    </div>
  </div>` : ''}

  <!-- CASHIER -->
  <div style="padding:3px 0;border-top:1px dashed #000;margin-top:3px;">
    <span style="font-size:11px;font-weight:700;">කැෂියර්: </span>
    <span style="font-size:11px;font-weight:800;">Admin</span>
  </div>

  <!-- FOOTER -->
  <div style="text-align:center;padding-top:6px;border-top:2px dashed #000;">
    <div style="font-size:13px;font-weight:800;">ස්තූතියි නැවත එන්න !</div>
    <div style="margin:4px 0;border-top:1px solid #000;"></div>
    <div style="font-size:11px;font-weight:700;letter-spacing:0.3px;">Software by nebulainfinite - 078 3233 760</div>
  </div>

</div>
</body>
</html>`;
};