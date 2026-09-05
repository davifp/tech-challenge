import { type Response } from 'supertest';

export const TRANSACTION_RESPONSE_KEYS = [
  'transactionExternalId',
  'transactionType',
  'transactionStatus',
  'value',
  'createdAt',
  'updatedAt',
  'accountExternalIdDebit',
  'accountExternalIdCredit',
] as const;

export type TransactionResponseBody = {
  transactionExternalId: string;
  transactionType: { name: string };
  transactionStatus: { name: string };
  value: number;
  createdAt: string;
  updatedAt: string;
  accountExternalIdDebit: string;
  accountExternalIdCredit: string;
};

export type ListTransactionsResponseBody = {
  items: TransactionResponseBody[];
  page: number;
  limit: number;
  total: number;
};

export type ErrorEnvelopeBody = {
  error: {
    code: string;
    message: string;
    details?: Array<{ path: string; message: string }>;
  };
};

export function responseBody<T>(response: Response): T {
  return response.body as T;
}
