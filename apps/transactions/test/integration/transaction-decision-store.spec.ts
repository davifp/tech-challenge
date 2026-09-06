import { randomUUID } from 'node:crypto';

import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import {
  TRANSACTION_DECISION_STORE,
  type TransactionDecisionStore,
} from '../../src/application/ports/transaction-decision-store.port';
import { APPROVED_STATUS_ID } from '../../src/domain/transaction/transaction-status';
import { prismaTest } from '../helpers/prisma-test';
import { createTransactionsTestApp, type TransactionsTestApp } from '../helpers/test-app';
import {
  HISTORIC_UPDATED_AT,
  buildDecisionInput,
  createPendingDecisionTarget,
} from '../helpers/transaction-decision.fixtures';

describe('TI-05 transaction decision store', () => {
  let testApp: TransactionsTestApp;
  let store: TransactionDecisionStore;

  beforeAll(async () => {
    testApp = await createTransactionsTestApp();
    store = testApp.app.get(TRANSACTION_DECISION_STORE);
  });

  afterAll(async () => {
    await testApp.app.close();
  });

  it('applies a final decision and records its inbox entry atomically', async () => {
    const transaction = await createPendingDecisionTarget();
    const input = buildDecisionInput(transaction.transactionExternalId);
    await expect(store.apply(input)).resolves.toBe('applied');
    const persisted = await prismaTest.transaction.findUniqueOrThrow({
      where: { transactionExternalId: transaction.transactionExternalId },
    });
    const inbox = await prismaTest.inboxEvent.findUnique({ where: { eventId: input.eventId } });
    expect(persisted.transactionStatusId).toBe(APPROVED_STATUS_ID);
    expect(persisted.updatedAt.getTime()).toBeGreaterThan(HISTORIC_UPDATED_AT.getTime());
    expect(inbox).toMatchObject({
      eventId: input.eventId,
      eventName: 'transaction.status.updated',
      transactionExternalId: transaction.transactionExternalId,
    });
    const response = await request(testApp.app.getHttpServer()).get(
      `/transactions/${transaction.transactionExternalId}`,
    );
    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({ transactionStatus: { name: 'approved' } });
  });

  it('does not update the timestamp when the same event is delivered again', async () => {
    const transaction = await createPendingDecisionTarget();
    const input = buildDecisionInput(transaction.transactionExternalId);
    await store.apply(input);
    const applied = await prismaTest.transaction.findUniqueOrThrow({
      where: { transactionExternalId: transaction.transactionExternalId },
    });
    await expect(store.apply(input)).resolves.toBe('duplicate');
    const duplicated = await prismaTest.transaction.findUniqueOrThrow({
      where: { transactionExternalId: transaction.transactionExternalId },
    });
    expect(duplicated.updatedAt).toEqual(applied.updatedAt);
    await expect(prismaTest.inboxEvent.count()).resolves.toBe(1);
  });

  it('keeps the same final state as a no-op for a different event', async () => {
    const transaction = await createPendingDecisionTarget();
    await store.apply(buildDecisionInput(transaction.transactionExternalId));
    const applied = await prismaTest.transaction.findUniqueOrThrow({
      where: { transactionExternalId: transaction.transactionExternalId },
    });
    await expect(store.apply(buildDecisionInput(transaction.transactionExternalId))).resolves.toBe(
      'duplicate',
    );
    const duplicated = await prismaTest.transaction.findUniqueOrThrow({
      where: { transactionExternalId: transaction.transactionExternalId },
    });
    expect(duplicated.updatedAt).toEqual(applied.updatedAt);
    await expect(prismaTest.inboxEvent.count()).resolves.toBe(2);
  });

  it('returns not-found without recording an inbox entry', async () => {
    await expect(store.apply(buildDecisionInput(randomUUID()))).resolves.toBe('not-found');
    await expect(prismaTest.inboxEvent.count()).resolves.toBe(0);
    await expect(prismaTest.transaction.count()).resolves.toBe(0);
  });
});
