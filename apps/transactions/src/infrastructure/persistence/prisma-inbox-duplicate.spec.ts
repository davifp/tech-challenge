import { describe, expect, it } from 'vitest';

import { type ApplyTransactionDecisionInput } from '../../application/ports/transaction-decision-store.port';
import { Prisma } from '../../generated/prisma/client';

import { resolvePrismaInboxConflict } from './prisma-inbox-duplicate';

const CLIENT_VERSION = '7.10.0';
const input: ApplyTransactionDecisionInput = {
  eventId: 'd9428888-122b-5e56-8e67-849d6e8fc5c1',
  transactionExternalId: '0199f9c2-1a2b-7c8d-9e0f-1234567890ab',
  status: 'approved',
};

function inboxConflict(): unknown {
  return new Prisma.PrismaClientKnownRequestError('Unique constraint failed', {
    code: 'P2002',
    clientVersion: CLIENT_VERSION,
    meta: { target: ['eventId'] },
  });
}

function inboxRecord(transactionExternalId: string = input.transactionExternalId) {
  return {
    eventId: input.eventId,
    eventName: 'transaction.status.updated',
    transactionExternalId,
    processedAt: new Date(),
  };
}

describe('resolvePrismaInboxConflict', () => {
  it('recognizes a repeated event for the same transaction', async () => {
    const findInboxEvent = async () => inboxRecord();
    await expect(resolvePrismaInboxConflict(findInboxEvent, input, inboxConflict())).resolves.toBe(
      'duplicate',
    );
  });

  it('rejects an event id reused for another transaction', async () => {
    const findInboxEvent = async () => inboxRecord(crypto.randomUUID());
    await expect(resolvePrismaInboxConflict(findInboxEvent, input, inboxConflict())).resolves.toBe(
      'conflict',
    );
  });
});
