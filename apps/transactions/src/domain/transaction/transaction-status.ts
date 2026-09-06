export const PENDING_STATUS_ID = 1;
export const APPROVED_STATUS_ID = 2;
export const REJECTED_STATUS_ID = 3;

export const TRANSACTION_STATUS_NAMES = ['pending', 'approved', 'rejected'] as const;

export type TransactionStatusName = (typeof TRANSACTION_STATUS_NAMES)[number];

export type FinalTransactionStatusName = Exclude<TransactionStatusName, 'pending'>;

export type TransactionStatusId =
  typeof PENDING_STATUS_ID | typeof APPROVED_STATUS_ID | typeof REJECTED_STATUS_ID;

export type FinalTransactionStatusId = Exclude<TransactionStatusId, typeof PENDING_STATUS_ID>;

export const FINAL_STATUS_ID_BY_NAME: Record<FinalTransactionStatusName, FinalTransactionStatusId> =
  {
    approved: APPROVED_STATUS_ID,
    rejected: REJECTED_STATUS_ID,
  };

export function isTransactionStatusId(statusId: number): statusId is TransactionStatusId {
  return (
    statusId === PENDING_STATUS_ID ||
    statusId === APPROVED_STATUS_ID ||
    statusId === REJECTED_STATUS_ID
  );
}
