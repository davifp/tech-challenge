export const TRANSFER_TYPE_ID = 1;

export const TRANSACTION_TYPE_NAMES = ['transfer'] as const;

export type TransactionTypeName = (typeof TRANSACTION_TYPE_NAMES)[number];

export type TransactionTypeId = typeof TRANSFER_TYPE_ID;
