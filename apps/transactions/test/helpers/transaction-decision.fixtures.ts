import { randomUUID } from 'node:crypto';

import { type ApplyTransactionDecisionInput } from '../../src/application/ports/transaction-decision-store.port';
import { type FinalTransactionStatusName } from '../../src/domain/transaction/transaction-status';

import { createTransaction } from './transaction.factory';

export const HISTORIC_UPDATED_AT = new Date('2026-01-01T00:00:00.000Z');

export function createPendingDecisionTarget() {
  return createTransaction({ updatedAt: HISTORIC_UPDATED_AT });
}

export function buildDecisionInput(
  transactionExternalId: string,
  status: FinalTransactionStatusName = 'approved',
  eventId = randomUUID(),
): ApplyTransactionDecisionInput {
  return { eventId, transactionExternalId, status };
}
