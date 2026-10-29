import { describe, it, expect } from 'vitest';
import { generateReceiptHTML } from './receiptGenerator';
import type { Invoice } from '../types/index';

const baseInvoice: Invoice = {
  id: 'inv-test',
  invoiceNumber: 'INV-1001',
  customerId: 'walk-in',
  customerName: 'Walk-in Customer',
  items: [
    {
      id: 'item-1',
      productId: 'prod-1',
      productName: 'Test Item',
      productNameSi: 'පරීක්ෂණ අයිතමය',
      quantity: 2,
      unitPrice: 1200,
      originalPrice: 1500,
      total: 2400,
    },
  ],
  subtotal: 2400,
  discount: 0,
  tax: 0,
  total: 2400,
  receivedAmount: 2500,
  changeAmount: 100,
  issueDate: '2026-07-05',
  dueDate: '2026-08-04',
  status: 'paid',
  paymentMethod: 'cash',
} as Invoice;

describe('generateReceiptHTML', () => {
  it('uses the 80mm thermal layout and keeps display prices fully black', () => {
    const html = generateReceiptHTML(baseInvoice, null, 'si', 'Cashier Name');

    expect(html).toContain('width: 80mm');
    expect(html).toContain('size: 80mm auto');
    expect(html).not.toContain('opacity:0.6');
    expect(html).toContain('color:#000000');
  });

  it('wraps long product names onto multiple lines with ZERO ellipsis truncation', () => {
    // No productNameSi → the strict printing rule (productNameSi || productName)
    // falls back to this long English name, which is what the receipt emits.
    const longNameInvoice: Invoice = {
      ...baseInvoice,
      items: [
        {
          ...baseInvoice.items[0],
          id: 'item-long-1',
          productNameSi: undefined,
          productName:
            'GI GALVANIZED STEEL WATER PIPE 2 INCH CLASS C 6 METER LENGTH (G.I PIPE - HEAVY DUTY INDUSTRIAL GRADE)',
        },
      ],
    };

    const html = generateReceiptHTML(longNameInvoice, null, 'si', 'Cashier Name');

    // 1. Ellipsis truncation styles are GONE from the item name container
    expect(html).not.toContain('text-overflow:ellipsis');
    expect(html).not.toContain('overflow:hidden');

    // 2. Natural multi-line wrap styles are applied (inline !important beats
    //    the receipt master reset * { white-space:nowrap !important })
    expect(html).toContain('white-space:normal !important');
    expect(html).toContain('word-break:break-word !important');
    expect(html).toContain('overflow-wrap:break-word !important');
    expect(html).toContain('line-height:1.2');

    // 3. The FULL product name is emitted — nothing is cut off by CSS ellipsis
    expect(html).toContain(
      'GI GALVANIZED STEEL WATER PIPE 2 INCH CLASS C 6 METER LENGTH (G.I PIPE - HEAVY DUTY INDUSTRIAL GRADE)'
    );
  });

  it('renders distinct count of unique line items instead of quantity sum', () => {
    // baseInvoice has 1 unique line item with quantity 2
    const html = generateReceiptHTML(baseInvoice, null, 'si', 'Cashier Name');

    expect(html).toContain('භාණ්ඩ සංඛ්‍යාව');
    expect(html).toContain('[1]');
    expect(html).not.toContain('[2]');
  });

  it('formats customer phone number inline on the same line without float:right', () => {
    const testCustomer = {
      id: 'cust-101',
      name: 'Sunil Shantha',
      nameSi: 'සුනිල් ශාන්ත',
      phone: '0771234567',
      email: '',
      address: '',
      customerType: 'regular' as const,
      loanBalance: 0,
    };

    const html = generateReceiptHTML(baseInvoice, testCustomer, 'si', 'Cashier Name');

    // Name and phone number appear inline on the same line
    expect(html).toContain('පාරිභෝගිකයා:');
    expect(html).toContain('සුනිල් ශාන්ත');
    expect(html).toContain(' - 0771234567');
    expect(html).toContain('font-size:10.5px');
    // float:right is strictly eliminated to prevent breaking header layout
    expect(html).not.toContain('float:right');
  });

  it('displays previous customer due balance (පෙර හිඟ මුදල) on receipt when balance > 0', () => {
    const testCustomer = {
      id: 'cust-102',
      name: 'Kasun Bandara',
      nameSi: 'කසුන් බණ්ඩාර',
      phone: '0779876543',
      email: '',
      address: '',
      customerType: 'credit' as const,
      loanBalance: 15000,
    };

    const html = generateReceiptHTML(baseInvoice, testCustomer, 'si', 'Cashier Name');

    expect(html).toContain('පෙර හිඟ මුදල');
    expect(html).toContain('Rs. 15,000');
  });

  it('renders payment breakdown with change and tendered amounts strictly above profit section', () => {
    // baseInvoice: total = 2400, receivedAmount = 2500, savings = 600
    const html = generateReceiptHTML(baseInvoice, null, 'si', 'Cashier Name');

    // Row 1: Change (currentDue <= 0)
    expect(html).toContain('ඉතිරි මුදල');
    expect(html).toContain('100');

    // Row 2: Tendered
    expect(html).toContain('දුන් මුදල');
    expect(html).toContain('2,500');

    // Structural layout order check: Item Count -> Payment Breakdown -> Savings (Profit)
    const itemCountIndex = html.indexOf('භාණ්ඩ සංඛ්‍යාව');
    const paymentBreakdownIndex = html.indexOf('ඉතිරි මුදල');
    const profitIndex = html.indexOf('ඔබ ලැබූ ලාභය');

    expect(itemCountIndex).toBeGreaterThan(0);
    expect(paymentBreakdownIndex).toBeGreaterThan(itemCountIndex);
    expect(profitIndex).toBeGreaterThan(paymentBreakdownIndex);
  });

  it('renders payment breakdown with due amount when tendered is less than total', () => {
    const partialInvoice: Invoice = {
      ...baseInvoice,
      receivedAmount: 1000,
      total: 2400,
    };

    const html = generateReceiptHTML(partialInvoice, null, 'si', 'Cashier Name');

    // Row 1: Due amount (2400 - 1000 = 1400)
    expect(html).toContain('හිඟ මුදල');
    expect(html).toContain('1,400');

    // Row 2: Tendered amount
    expect(html).toContain('දුන් මුදල');
    expect(html).toContain('1,000');
  });

  it('safely handles zero or undefined receivedAmount without rendering NaN', () => {
    const zeroTenderInvoice: Invoice = {
      ...baseInvoice,
      receivedAmount: undefined,
      total: 2400,
    };

    const html = generateReceiptHTML(zeroTenderInvoice, null, 'si', 'Cashier Name');

    expect(html).not.toContain('NaN');
    expect(html).toContain('හිඟ මුදල');
    expect(html).toContain('2,400');
    expect(html).toContain('දුන් මුදල');
    expect(html).toContain('>0</span>');
  });
});
