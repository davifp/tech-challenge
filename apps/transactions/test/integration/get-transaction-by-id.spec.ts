import { randomUUID } from 'node:crypto';

import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import {
  type ErrorEnvelopeBody,
  responseBody,
  type TransactionResponseBody,
} from '../helpers/http-contracts';
import { createTransactionsTestApp, type TransactionsTestApp } from '../helpers/test-app';
import { createTransaction } from '../helpers/transaction.factory';

describe('GET /transactions/:transactionExternalId', () => {
  let testApp: TransactionsTestApp;

  beforeAll(async () => {
    testApp = await createTransactionsTestApp();
  });

  afterAll(async () => {
    await testApp.app.close();
  });

  it('returns the transaction with the exact public contract', async () => {
    const record = await createTransaction({ value: 245.75, transactionStatusId: 2 });
    const response = await request(testApp.app.getHttpServer())
      .get(`/transactions/${record.transactionExternalId}`)
      .expect(200);
    expect(responseBody<TransactionResponseBody>(response)).toStrictEqual({
      transactionExternalId: record.transactionExternalId,
      transactionType: { name: 'pix' },
      transactionStatus: { name: 'approved' },
      value: 245.75,
      createdAt: record.createdAt.toISOString(),
      updatedAt: record.updatedAt.toISOString(),
      accountExternalIdDebit: record.accountExternalIdDebit,
      accountExternalIdCredit: record.accountExternalIdCredit,
    });
  });

  it('returns a descriptive TRANSACTION_NOT_FOUND envelope', async () => {
    const externalId = randomUUID();
    const response = await request(testApp.app.getHttpServer())
      .get(`/transactions/${externalId}`)
      .expect(404);
    expect(responseBody<ErrorEnvelopeBody>(response)).toStrictEqual({
      error: {
        code: 'TRANSACTION_NOT_FOUND',
        message: `Transaction ${externalId} not found`,
      },
    });
  });
});
