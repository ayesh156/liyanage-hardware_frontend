// frontend/src/components/customers/CustomerDueSettlementsModal.tsx
import React from 'react';
import { CustomerDueInvoicesModal } from '../modals/CustomerDueInvoicesModal';
import { Customer } from '../../types';

export interface CustomerDueSettlementsModalProps {
  isOpen: boolean;
  onClose: () => void;
  customer: Customer | null;
  onSuccess?: () => void;
  onSettlementSuccess?: () => void;
}

/**
 * CustomerDueSettlementsModal
 * Provides centralized customer outstanding bill settlements with FIFO allocation,
 * Master Select All controls, and auto-mutation to 'paid' status.
 */
export const CustomerDueSettlementsModal: React.FC<CustomerDueSettlementsModalProps> = (props) => {
  return <CustomerDueInvoicesModal {...props} />;
};

export default CustomerDueSettlementsModal;
