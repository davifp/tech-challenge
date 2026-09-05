import { randomUUID } from 'node:crypto';

import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { type ErrorEnvelopeBody, responseBody } from '../helpers/http-contracts';
import { prismaTest } from '../helpers/prisma-test';
import { createTransactionsTestApp, type TransactionsTestApp } from '../helpers/test-app';
import {
  buildTransactionBody,
  postTransaction,
  transactionExternalId,
} from '../helpers/transactions-http';

describe('POST /transactions idempotency', () => {
  let testApp: TransactionsTestApp;

  beforeAll(async () => {
    testApp = await createTransactionsTestApp();
  });

  afterAll(async () => {
    await testApp.app.close();
  });

  it('replays a sequential request with the same body', async () => {
    const key = randomUUID();
    const body = buildTransactionBody();
    const first = await postTransaction(testApp.app, body, key).expect(201);
    const second = await postTransaction(testApp.app, body, key).expect(200);
    expect(second.body).toStrictEqual(first.body);
    expect(transactionExternalId(second)).toBe(transactionExternalId(first));
    expect(first.headers.location).toBe(`/transactions/${transactionExternalId(first)}`);
    expect(second.headers.location).toBeUndefined();
    await expect(prismaTest.transaction.count()).resolves.toBe(1);
  });

  it('atomically replays concurrent requests with the same body', async () => {
    const key = randomUUID();
    const body = buildTransactionBody();
    const responses = await Promise.all([
      postTransaction(testApp.app, body, key),
      postTransaction(testApp.app, body, key),
    ]);
    const statuses = responses.map(({ status }) => status).sort();
    expect(statuses).toStrictEqual([200, 201]);
    expect(responses.every(({ status }) => status !== 500)).toBe(true);
    expect(transactionExternalId(responses[0])).toBe(transactionExternalId(responses[1]));
    await expect(prismaTest.transaction.count()).resolves.toBe(1);
  });

  it('rejects reuse of a key with a different body', async () => {
    const key = randomUUID();
    const body = buildTransactionBody();
    await postTransaction(testApp.app, body, key).expect(201);
    const response = await postTransaction(testApp.app, { ...body, value: 999 }, key).expect(422);
    expect(responseBody<ErrorEnvelopeBody>(response)).toStrictEqual({
      error: {
        code: 'IDEMPOTENCY_KEY_CONFLICT',
        message: `Idempotency-Key ${key} reused with a different body`,
      },
    });
    await expect(prismaTest.transaction.count()).resolves.toBe(1);
  });
});
