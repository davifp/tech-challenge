import { randomUUID } from 'node:crypto';

import { type INestApplication } from '@nestjs/common';
import request, { type Test } from 'supertest';

export type CreateTransactionBody = {
  accountExternalIdDebit: string;
  accountExternalIdCredit: string;
  transferTypeId: number;
  value: number;
};

export function buildTransactionBody(value = 120): CreateTransactionBody {
  return {
    accountExternalIdDebit: randomUUID(),
    accountExternalIdCredit: randomUUID(),
    transferTypeId: 1,
    value,
  };
}

export function postTransaction(
  app: INestApplication,
  body: CreateTransactionBody,
  idempotencyKey?: string,
): Test {
  const test = request(app.getHttpServer()).post('/transactions').send(body);
  return idempotencyKey ? test.set('Idempotency-Key', idempotencyKey) : test;
}

export function transactionExternalId(response: { body: unknown }): string {
  const payload = response.body;
  if (!payload || typeof payload !== 'object' || !('transactionExternalId' in payload)) {
    throw new Error('Transaction response does not include transactionExternalId');
  }
  const externalId = payload.transactionExternalId;
  if (typeof externalId !== 'string') throw new Error('transactionExternalId must be a string');
  return externalId;
}
