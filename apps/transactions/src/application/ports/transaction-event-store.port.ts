import { type TransactionCreatedV1 } from '@tech-challenge/event-contracts';

import { type Transaction } from '../../domain/transaction/transaction';

export const TRANSACTION_EVENT_STORE = Symbol('TransactionEventStore');

export type TransactionIdempotency = {
  key: string;
  bodyHash: string;
};

export type IdempotentTransaction = {
  transaction: Transaction;
  bodyHash: string;
};

export type SavePendingTransactionInput = {
  transaction: Transaction;
  event: TransactionCreatedV1;
  idempotency?: TransactionIdempotency;
};

export type SaveTransactionResult =
  | { outcome: 'created'; transaction: Transaction }
  | { outcome: 'replayed'; transaction: Transaction; bodyHash: string };

export interface TransactionEventStore {
  savePending(input: SavePendingTransactionInput): Promise<SaveTransactionResult>;
  findByIdempotencyKey(idempotencyKey: string): Promise<IdempotentTransaction | null>;
}
