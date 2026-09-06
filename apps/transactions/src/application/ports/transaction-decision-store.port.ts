import { type FinalTransactionStatusName } from '../../domain/transaction/transaction-status';

export const TRANSACTION_DECISION_STORE = Symbol('TransactionDecisionStore');

export type ApplyTransactionDecisionInput = {
  eventId: string;
  transactionExternalId: string;
  status: FinalTransactionStatusName;
};

export type TransactionDecisionStoreOutcome = 'applied' | 'duplicate' | 'conflict' | 'not-found';

export interface TransactionDecisionStore {
  apply(input: ApplyTransactionDecisionInput): Promise<TransactionDecisionStoreOutcome>;
}
