import { version as uuidVersion } from 'uuid';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import {
  type ErrorEnvelopeBody,
  responseBody,
  type TransactionResponseBody,
} from '../helpers/http-contracts';
import { prismaTest } from '../helpers/prisma-test';
import { createTransactionsTestApp, type TransactionsTestApp } from '../helpers/test-app';
import { buildTransactionBody, postTransaction } from '../helpers/transactions-http';

describe('POST /transactions', () => {
  let testApp: TransactionsTestApp;

  beforeAll(async () => {
    testApp = await createTransactionsTestApp();
  });

  afterAll(async () => {
    await testApp.app.close();
  });

  it('creates and persists a complete pending transaction', async () => {
    const input = buildTransactionBody(120.5);
    const response = await postTransaction(testApp.app, input).expect(201);
    const body = responseBody<TransactionResponseBody>(response);
    expect(uuidVersion(body.transactionExternalId)).toBe(7);
    expect(body).toStrictEqual({
      transactionExternalId: body.transactionExternalId,
      transactionType: { name: 'transfer' },
      transactionStatus: { name: 'pending' },
      value: input.value,
      createdAt: expect.any(String),
      updatedAt: expect.any(String),
      accountExternalIdDebit: input.accountExternalIdDebit,
      accountExternalIdCredit: input.accountExternalIdCredit,
    });
    expect(response.headers.location).toBe(`/transactions/${body.transactionExternalId}`);
    const persisted = await prismaTest.transaction.findUniqueOrThrow({
      where: { transactionExternalId: body.transactionExternalId },
    });
    expect(persisted).toMatchObject({ transactionStatusId: 1, transferTypeId: 1 });
    expect(persisted.createdAt).toBeInstanceOf(Date);
    expect(persisted.updatedAt).toBeInstanceOf(Date);
  });

  it('returns VALIDATION_ERROR and does not persist an invalid body', async () => {
    const response = await postTransaction(testApp.app, buildTransactionBody(0)).expect(400);
    const body = responseBody<ErrorEnvelopeBody>(response);
    expect(body).toStrictEqual({
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Invalid request payload',
        details: expect.arrayContaining([{ path: 'value', message: expect.any(String) }]),
      },
    });
    await expect(prismaTest.transaction.count()).resolves.toBe(0);
  });
});
