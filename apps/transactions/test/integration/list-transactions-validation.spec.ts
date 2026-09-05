import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { type ErrorEnvelopeBody, responseBody } from '../helpers/http-contracts';
import { createTransactionsTestApp, type TransactionsTestApp } from '../helpers/test-app';

const INVALID_QUERIES = [
  ['page below one', { page: 0 }, 'page'],
  ['limit above maximum', { limit: 999 }, 'limit'],
  ['unknown status', { status: 'unknown' }, 'status'],
  ['non-numeric transfer type', { transferTypeId: 'abc' }, 'transferTypeId'],
  ['date without timezone', { createdAtFrom: '2026-09-04' }, 'createdAtFrom'],
  ['malformed date', { createdAtFrom: 'not-a-date' }, 'createdAtFrom'],
] as const;

describe('GET /transactions validation', () => {
  let testApp: TransactionsTestApp;

  beforeAll(async () => {
    testApp = await createTransactionsTestApp();
  });

  afterAll(async () => {
    await testApp.app.close();
  });

  it.each(INVALID_QUERIES)('rejects %s with VALIDATION_ERROR', async (_, query, path) => {
    const response = await request(testApp.app.getHttpServer())
      .get('/transactions')
      .query(query)
      .expect(400);
    expect(responseBody<ErrorEnvelopeBody>(response)).toStrictEqual({
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Invalid request payload',
        details: expect.arrayContaining([{ path, message: expect.any(String) }]),
      },
    });
  });
});
