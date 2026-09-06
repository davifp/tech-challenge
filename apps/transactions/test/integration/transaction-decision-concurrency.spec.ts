import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import {
  TRANSACTION_DECISION_STORE,
  type TransactionDecisionStore,
} from '../../src/application/ports/transaction-decision-store.port';
import {
  APPROVED_STATUS_ID,
  PENDING_STATUS_ID,
  REJECTED_STATUS_ID,
} from '../../src/domain/transaction/transaction-status';
import { prismaTest } from '../helpers/prisma-test';
import { createTransactionsTestApp, type TransactionsTestApp } from '../helpers/test-app';
import {
  buildDecisionInput,
  createPendingDecisionTarget,
} from '../helpers/transaction-decision.fixtures';

describe('TI-05 concurrent transaction decisions', () => {
  let testApp: TransactionsTestApp;
  let store: TransactionDecisionStore;

  beforeAll(async () => {
    testApp = await createTransactionsTestApp();
    store = testApp.app.get(TRANSACTION_DECISION_STORE);
  });

  afterAll(async () => {
    await testApp.app.close();
  });

  it('applies the same event once under concurrent delivery', async () => {
    const transaction = await createPendingDecisionTarget();
    const input = buildDecisionInput(transaction.transactionExternalId);
    const outcomes = await Promise.all([store.apply(input), store.apply(input)]);
    expect(outcomes.sort()).toEqual(['applied', 'duplicate']);
    await expect(prismaTest.inboxEvent.count()).resolves.toBe(1);
  });

  it('commits only one of two opposing decisions', async () => {
    const transaction = await createPendingDecisionTarget();
    const approved = buildDecisionInput(transaction.transactionExternalId, 'approved');
    const rejected = buildDecisionInput(transaction.transactionExternalId, 'rejected');
    const [approvedOutcome, rejectedOutcome] = await Promise.all([
      store.apply(approved),
      store.apply(rejected),
    ]);
    expect([approvedOutcome, rejectedOutcome].sort()).toEqual(['applied', 'conflict']);
    const persisted = await prismaTest.transaction.findUniqueOrThrow({
      where: { transactionExternalId: transaction.transactionExternalId },
    });
    const expectedStatus = approvedOutcome === 'applied' ? APPROVED_STATUS_ID : REJECTED_STATUS_ID;
    expect(persisted.transactionStatusId).toBe(expectedStatus);
    await expect(prismaTest.inboxEvent.count()).resolves.toBe(1);
  });

  it('does not update status when the inbox insert fails', async () => {
    const recorded = await createPendingDecisionTarget();
    const target = await createPendingDecisionTarget();
    const input = buildDecisionInput(target.transactionExternalId);
    await prismaTest.inboxEvent.create({
      data: {
        eventId: input.eventId,
        eventName: 'transaction.status.updated',
        transactionExternalId: recorded.transactionExternalId,
      },
    });
    await expect(store.apply(input)).resolves.toBe('conflict');
    const persisted = await prismaTest.transaction.findUniqueOrThrow({
      where: { transactionExternalId: target.transactionExternalId },
    });
    expect(persisted.transactionStatusId).toBe(PENDING_STATUS_ID);
  });
});
