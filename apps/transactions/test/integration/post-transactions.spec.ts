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

  it('creates and persists a complete pending transaction with pix type', async () => {
    const input = buildTransactionBody(120.5);
    const response = await postTransaction(testApp.app, input).expect(201);
    const body = responseBody<TransactionResponseBody>(response);
    expect(uuidVersion(body.transactionExternalId)).toBe(7);
    expect(body).toStrictEqual({
      transactionExternalId: body.transactionExternalId,
      transactionType: { name: 'pix' },
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

  it('creates a transaction with ted type', async () => {
    const input = { ...buildTransactionBody(50), transferTypeId: 2 };
    const response = await postTransaction(testApp.app, input).expect(201);
    const body = responseBody<TransactionResponseBody>(response);
    expect(body.transactionType).toStrictEqual({ name: 'ted' });
  });

  it('creates a transaction with book_transfer type', async () => {
    const input = { ...buildTransactionBody(75), transferTypeId: 3 };
    const response = await postTransaction(testApp.app, input).expect(201);
    const body = responseBody<TransactionResponseBody>(response);
    expect(body.transactionType).toStrictEqual({ name: 'book_transfer' });
  });

  it('returns VALIDATION_ERROR for transferTypeId outside {1,2,3}', async () => {
    const input = { ...buildTransactionBody(100), transferTypeId: 4 };
    const response = await postTransaction(testApp.app, input).expect(400);
    const body = responseBody<ErrorEnvelopeBody>(response);
    expect(body).toStrictEqual({
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Invalid request payload',
        details: expect.arrayContaining([{ path: 'transferTypeId', message: expect.any(String) }]),
      },
    });
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
