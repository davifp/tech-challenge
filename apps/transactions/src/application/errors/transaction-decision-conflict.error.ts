import { type FinalTransactionStatusName } from '../../domain/transaction/transaction-status';

export class TransactionDecisionConflictError extends Error {
  readonly code = 'TRANSACTION_DECISION_CONFLICT';

  constructor(
    readonly transactionExternalId: string,
    readonly requestedStatus: FinalTransactionStatusName,
  ) {
    super(`Transaction ${transactionExternalId} already has a conflicting final decision`);
    this.name = TransactionDecisionConflictError.name;
  }
}
