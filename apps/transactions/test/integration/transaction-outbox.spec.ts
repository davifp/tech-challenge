import { randomUUID } from 'node:crypto';

import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { createTransactionCreatedEvent } from '../../src/application/helpers/create-transaction-created-event';
import {
  TRANSACTION_EVENT_STORE,
  type TransactionEventStore,
} from '../../src/application/ports/transaction-event-store.port';
import { Transaction } from '../../src/domain/transaction/transaction';
import { TRANSFER_TYPE_ID } from '../../src/domain/transaction/transaction-type';
import { prismaTest } from '../helpers/prisma-test';
import { createTransactionsTestApp, type TransactionsTestApp } from '../helpers/test-app';
import { postTransaction, transactionExternalId } from '../helpers/transactions-http';

function buildTransaction(): Transaction {
  return Transaction.createPending({
    accountExternalIdDebit: randomUUID(),
    accountExternalIdCredit: randomUUID(),
    value: 120,
    transferTypeId: TRANSFER_TYPE_ID,
  });
}

describe('TI-02 transaction creation with transactional outbox', () => {
  let testApp: TransactionsTestApp;
  let eventStore: TransactionEventStore;

  beforeAll(async () => {
    testApp = await createTransactionsTestApp();
    eventStore = testApp.app.get(TRANSACTION_EVENT_STORE);
  });

  afterAll(async () => {
    await testApp.app.close();
  });

  it('persists one pending transaction and one logical event across HTTP replay', async () => {
    const body = {
      accountExternalIdDebit: randomUUID(),
      accountExternalIdCredit: randomUUID(),
      value: 120,
      transferTypeId: TRANSFER_TYPE_ID,
    };
    const idempotencyKey = randomUUID();
    const created = await postTransaction(testApp.app, body, idempotencyKey);
    const replayed = await postTransaction(testApp.app, body, idempotencyKey);
    expect([created.status, replayed.status]).toEqual([201, 200]);
    expect(transactionExternalId(replayed)).toBe(transactionExternalId(created));
    const events = await prismaTest.outboxEvent.findMany();
    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({
      aggregateId: transactionExternalId(created),
      eventName: 'transaction.created',
      attemptCount: 0,
      publishedAt: null,
      lastError: null,
    });
    expect(events[0]?.payload).toMatchObject({
      eventId: events[0]?.eventId,
      correlationId: transactionExternalId(created),
      data: { transactionExternalId: transactionExternalId(created), value: 120 },
    });
  });

  it('rolls back the transaction when its outbox insert fails', async () => {
    const persisted = buildTransaction();
    const persistedEvent = createTransactionCreatedEvent(persisted);
    await eventStore.savePending({ transaction: persisted, event: persistedEvent });
    const rolledBack = buildTransaction();
    const collidingEvent = {
      ...createTransactionCreatedEvent(rolledBack),
      eventId: persistedEvent.eventId,
    };
    await expect(
      eventStore.savePending({ transaction: rolledBack, event: collidingEvent }),
    ).rejects.toThrow();
    await expect(
      prismaTest.transaction.findUnique({
        where: { transactionExternalId: rolledBack.transactionExternalId },
      }),
    ).resolves.toBeNull();
    await expect(prismaTest.transaction.count()).resolves.toBe(1);
    await expect(prismaTest.outboxEvent.count()).resolves.toBe(1);
  });
});
