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

export interface TransactionRepository {
  findByExternalId(externalId: string): Promise<Transaction | null>;
  list(filters: ListTransactionsFilters): Promise<ListTransactionsResult>;
}
