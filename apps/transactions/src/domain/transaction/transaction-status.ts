export const PENDING_STATUS_ID = 1;
export const APPROVED_STATUS_ID = 2;
export const REJECTED_STATUS_ID = 3;

export const TRANSACTION_STATUS_NAMES = ['pending', 'approved', 'rejected'] as const;

export type TransactionStatusName = (typeof TRANSACTION_STATUS_NAMES)[number];

export type TransactionStatusId =
  typeof PENDING_STATUS_ID | typeof APPROVED_STATUS_ID | typeof REJECTED_STATUS_ID;
