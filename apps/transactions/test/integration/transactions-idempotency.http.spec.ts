import { randomUUID } from 'node:crypto';

import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { prismaTest } from '../helpers/prisma-test';
import { createTransactionsTestApp, type TransactionsTestApp } from '../helpers/test-app';
import {
  type CreateTransactionBody,
  postTransaction,
  transactionExternalId,
} from '../helpers/transactions-http';

function buildBody(value = 120): CreateTransactionBody {
  return {
    accountExternalIdDebit: randomUUID(),
    accountExternalIdCredit: randomUUID(),
    transferTypeId: 1,
    value,
  };
}

describe('transactions HTTP idempotency', () => {
  let testApp: TransactionsTestApp;

  beforeAll(async () => {
    testApp = await createTransactionsTestApp();
  });

  afterAll(async () => {
    await testApp.app.close();
  });

  it('replays the exact body when an account UUID uses uppercase', async () => {
    const body = buildBody();
    body.accountExternalIdDebit = body.accountExternalIdDebit.toUpperCase();
    const key = randomUUID();
    const first = await postTransaction(testApp.app, body, key);
    const second = await postTransaction(testApp.app, body, key);
    expect([first.status, second.status]).toEqual([201, 200]);
    expect(transactionExternalId(second)).toBe(transactionExternalId(first));
    expect(second.headers.location).toBeUndefined();
  });

  it('resolves concurrent requests with the same body as create and replay', async () => {
    const body = buildBody();
    const key = randomUUID();
    const responses = await Promise.all([
      postTransaction(testApp.app, body, key),
      postTransaction(testApp.app, body, key),
    ]);
    expect(responses.map(({ status }) => status).sort()).toEqual([200, 201]);
    expect(transactionExternalId(responses[0])).toBe(transactionExternalId(responses[1]));
    await expect(prismaTest.transaction.count()).resolves.toBe(1);
    await expect(prismaTest.outboxEvent.count()).resolves.toBe(1);
  });

  it('rejects a different body racing on the same idempotency key', async () => {
    const key = randomUUID();
    const baseBody = buildBody();
    const responses = await Promise.all([
      postTransaction(testApp.app, baseBody, key),
      postTransaction(testApp.app, { ...baseBody, value: 999 }, key),
    ]);
    expect(responses.map(({ status }) => status).sort()).toEqual([201, 422]);
    await expect(prismaTest.transaction.count()).resolves.toBe(1);
    await expect(prismaTest.outboxEvent.count()).resolves.toBe(1);
  });
});
