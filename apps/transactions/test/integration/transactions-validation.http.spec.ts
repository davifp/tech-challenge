import { randomUUID } from 'node:crypto';

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
    const response = await postTransaction(testApp.baseUrl, {
      accountExternalIdDebit: account.toLowerCase(),
      accountExternalIdCredit: account.toUpperCase(),
      transferTypeId: 1,
      value: 120,
    });
    expect(response.status).toBe(400);
    await expect(prismaTest.transaction.count()).resolves.toBe(0);
  });

  it('rejects a transfer type absent from the catalog', async () => {
    const response = await fetch(`${testApp.baseUrl}/transactions?transferTypeId=999`);
    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({
      error: { code: 'TRANSFER_TYPE_NOT_FOUND' },
    });
  });

  it('rejects a malformed transaction UUID before querying PostgreSQL', async () => {
    const response = await fetch(`${testApp.baseUrl}/transactions/not-a-uuid`);
    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({
      error: { code: 'VALIDATION_ERROR' },
    });
  });
});
