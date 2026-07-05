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
});
