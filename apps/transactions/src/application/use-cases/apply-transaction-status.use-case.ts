import { TransactionDecisionConflictError } from '../errors/transaction-decision-conflict.error';
import { TransactionNotFoundError } from '../errors/transaction-not-found.error';
import {
  type ApplyTransactionDecisionInput,
  type TransactionDecisionStore,
} from '../ports/transaction-decision-store.port';

export type ApplyTransactionStatusOutcome = 'applied' | 'duplicate';

export class ApplyTransactionStatusUseCase {
  constructor(private readonly decisionStore: TransactionDecisionStore) {}

  async execute(input: ApplyTransactionDecisionInput): Promise<ApplyTransactionStatusOutcome> {
    const outcome = await this.decisionStore.apply(input);
    if (outcome === 'not-found') throw new TransactionNotFoundError(input.transactionExternalId);
    if (outcome === 'conflict') {
      throw new TransactionDecisionConflictError(input.transactionExternalId, input.status);
    }
    return outcome;
  }
}
