// frontend/src/components/invoices/ReceiptPreview.tsx
import React from 'react';
import ThermalReceiptPreview, { ThermalReceiptPreviewProps } from '../ThermalReceiptPreview';

export type ReceiptPreviewProps = ThermalReceiptPreviewProps;

/**
 * ReceiptPreview
 * Live thermal receipt preview component standardizing item counts to unique line items (items.length).
 */
export const ReceiptPreview: React.FC<ReceiptPreviewProps> = (props) => {
  return <ThermalReceiptPreview {...props} />;
};

export default ReceiptPreview;
