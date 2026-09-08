export const PIX_TYPE_ID = 1;
export const TED_TYPE_ID = 2;
export const BOOK_TRANSFER_TYPE_ID = 3;

export const TRANSACTION_TYPE_NAMES = ['pix', 'ted', 'book_transfer'] as const;

export type TransactionTypeName = (typeof TRANSACTION_TYPE_NAMES)[number];

export type TransactionTypeId = 1 | 2 | 3;
