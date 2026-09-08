import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import {
  type ListTransactionsResponseBody,
  responseBody,
  TRANSACTION_RESPONSE_KEYS,
} from '../helpers/http-contracts';
import { createTimedTransactions, externalIds } from '../helpers/list-transactions.fixtures';
import { createTransactionsTestApp, type TransactionsTestApp } from '../helpers/test-app';
import { createTransaction } from '../helpers/transaction.factory';

describe('GET /transactions', () => {
  let testApp: TransactionsTestApp;

  beforeAll(async () => {
    testApp = await createTransactionsTestApp();
  });

  afterAll(async () => {
    await testApp.app.close();
  });

  it('applies defaults and orders by createdAt descending', async () => {
    const records = await createTimedTransactions(3);
    const response = await request(testApp.app.getHttpServer()).get('/transactions').expect(200);
    const body = responseBody<ListTransactionsResponseBody>(response);
    expect({ page: body.page, limit: body.limit, total: body.total }).toStrictEqual({
      page: 1,
      limit: 20,
      total: 3,
    });
    expect(externalIds(body.items)).toStrictEqual(externalIds(records.toReversed()));
    expect(Object.keys(body.items[0] ?? {}).sort()).toStrictEqual(
      [...TRANSACTION_RESPONSE_KEYS].sort(),
    );
  });

  it('filters approved transactions', async () => {
    const approved = await createTransaction({ transactionStatusId: 2 });
    await createTransaction({ transactionStatusId: 1 });
    const response = await request(testApp.app.getHttpServer())
      .get('/transactions')
      .query({ status: 'approved' })
      .expect(200);
    const body = responseBody<ListTransactionsResponseBody>(response);
    expect(externalIds(body.items)).toStrictEqual([approved.transactionExternalId]);
    expect(body.items[0]?.transactionStatus).toStrictEqual({ name: 'approved' });
  });

  it('filters by transfer type', async () => {
    const records = await createTimedTransactions(2);
    const otherType = await createTransaction({ transferTypeId: 2 });
    const response = await request(testApp.app.getHttpServer())
      .get('/transactions')
      .query({ transferTypeId: 1 })
      .expect(200);
    const body = responseBody<ListTransactionsResponseBody>(response);
    expect(externalIds(body.items)).toStrictEqual(externalIds(records.toReversed()));
    expect(externalIds(body.items)).not.toContain(otherType.transactionExternalId);
    expect(body.items[0]?.transactionType).toStrictEqual({ name: 'pix' });
  });

  it('filters by type and status combined', async () => {
    const approved = await createTransaction({ transferTypeId: 2, transactionStatusId: 2 });
    await createTransaction({ transferTypeId: 2, transactionStatusId: 1 });
    await createTransaction({ transferTypeId: 1, transactionStatusId: 2 });
    const response = await request(testApp.app.getHttpServer())
      .get('/transactions')
      .query({ transferTypeId: 2, status: 'approved' })
      .expect(200);
    const body = responseBody<ListTransactionsResponseBody>(response);
    expect(externalIds(body.items)).toStrictEqual([approved.transactionExternalId]);
    expect(body.items[0]?.transactionType).toStrictEqual({ name: 'ted' });
    expect(body.items[0]?.transactionStatus).toStrictEqual({ name: 'approved' });
  });

  it('includes both boundaries of a createdAt range', async () => {
    const dates = ['2026-08-31', '2026-09-01', '2026-09-02', '2026-09-03', '2026-09-04'];
    const records = await Promise.all(
      dates.map((date) => createTransaction({ createdAt: new Date(`${date}T00:00:00.000Z`) })),
    );
    const response = await request(testApp.app.getHttpServer()).get('/transactions').query({
      createdAtFrom: '2026-09-01T00:00:00.000Z',
      createdAtTo: '2026-09-03T00:00:00.000Z',
    });
    const body = responseBody<ListTransactionsResponseBody>(response);
    expect(externalIds(body.items)).toStrictEqual(externalIds(records.slice(1, 4).toReversed()));
  });

  it('returns page two and the global total', async () => {
    const records = await createTimedTransactions(11);
    const response = await request(testApp.app.getHttpServer())
      .get('/transactions')
      .query({ page: 2, limit: 5 })
      .expect(200);
    const body = responseBody<ListTransactionsResponseBody>(response);
    expect({ page: body.page, limit: body.limit, total: body.total }).toStrictEqual({
      page: 2,
      limit: 5,
      total: 11,
    });
    expect(externalIds(body.items)).toStrictEqual(externalIds(records.toReversed().slice(5, 10)));
  });
});
