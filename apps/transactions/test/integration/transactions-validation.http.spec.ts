import { randomUUID } from 'node:crypto';

import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { prismaTest } from '../helpers/prisma-test';
import { createTransactionsTestApp, type TransactionsTestApp } from '../helpers/test-app';
import { postTransaction } from '../helpers/transactions-http';

describe('transactions HTTP validation', () => {
  let testApp: TransactionsTestApp;

  beforeAll(async () => {
    testApp = await createTransactionsTestApp();
  });

  afterAll(async () => {
    await testApp.app.close();
  });

  it('rejects equal account UUIDs with different casing without persisting', async () => {
    const account = randomUUID();
    const response = await postTransaction(testApp.app, {
      accountExternalIdDebit: account.toLowerCase(),
      accountExternalIdCredit: account.toUpperCase(),
      transferTypeId: 1,
      value: 120,
    });
    expect(response.status).toBe(400);
    await expect(prismaTest.transaction.count()).resolves.toBe(0);
  });

  it('rejects a transferTypeId outside {1,2,3} on the list endpoint', async () => {
    const response = await request(testApp.app.getHttpServer())
      .get('/transactions')
      .query({ transferTypeId: 999 });
    expect(response.status).toBe(400);
    expect(response.body).toMatchObject({
      error: { code: 'VALIDATION_ERROR' },
    });
  });

  it('rejects a malformed transaction UUID before querying PostgreSQL', async () => {
    const response = await request(testApp.app.getHttpServer()).get('/transactions/not-a-uuid');
    expect(response.status).toBe(400);
    expect(response.body).toMatchObject({
      error: { code: 'VALIDATION_ERROR' },
    });
  });
});
