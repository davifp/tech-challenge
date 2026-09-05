import { type Transaction } from '../../domain/transaction/transaction';
import { type TransactionStatusName } from '../../domain/transaction/transaction-status';

export const TRANSACTION_REPOSITORY = Symbol('TransactionRepository');

export type ListTransactionsFilters = {
  status?: TransactionStatusName;
  transferTypeId?: number;
  createdAtFrom?: Date;
  createdAtTo?: Date;
  page: number;
  limit: number;
};

export type ListTransactionsResult = {
  items: Transaction[];
  total: number;
};

export type TransactionIdempotency = {
  key: string;
  bodyHash: string;
};

export type IdempotentTransaction = {
  transaction: Transaction;
  bodyHash: string;
};

export type SaveTransactionResult =
  | { outcome: 'created'; transaction: Transaction }
  | { outcome: 'replayed'; transaction: Transaction; bodyHash: string };

export interface TransactionRepository {
  save(
    transaction: Transaction,
    idempotency?: TransactionIdempotency,
  ): Promise<SaveTransactionResult>;
  findByExternalId(externalId: string): Promise<Transaction | null>;
  findByIdempotencyKey(idempotencyKey: string): Promise<IdempotentTransaction | null>;
  list(filters: ListTransactionsFilters): Promise<ListTransactionsResult>;
}
