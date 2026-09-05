import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { type TransactionRepository } from '../../src/application/ports/transaction-repository.port';
import { type ErrorEnvelopeBody, responseBody } from '../helpers/http-contracts';
import { createTransactionsTestApp, type TransactionsTestApp } from '../helpers/test-app';

const SENSITIVE_ERROR = 'database password leaked';

function failingTransactionRepository(): TransactionRepository {
  const fail = async () => {
    throw new Error(SENSITIVE_ERROR);
  };
  return {
    save: fail,
    findByExternalId: fail,
    findByIdempotencyKey: fail,
    list: fail,
  };
}

describe('HTTP internal error envelope', () => {
  let testApp: TransactionsTestApp;

  beforeAll(async () => {
    testApp = await createTransactionsTestApp({
      transactionRepository: failingTransactionRepository(),
    });
  });

  afterAll(async () => {
    await testApp.app.close();
  });

  it('returns a generic 500 response without internal details', async () => {
    const response = await request(testApp.app.getHttpServer()).get('/transactions').expect(500);
    const body = responseBody<ErrorEnvelopeBody>(response);
    expect(body).toStrictEqual({
      error: { code: 'INTERNAL_ERROR', message: 'Internal server error' },
    });
    expect(JSON.stringify(body)).not.toContain(SENSITIVE_ERROR);
  });
});
