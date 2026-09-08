import { randomUUID } from 'node:crypto';

import { describe, expect, it, vi } from 'vitest';

import { createTransactionCreatedEvent } from '../../application/helpers/create-transaction-created-event';
import { hashBody } from '../../application/helpers/hash-body';
import { Transaction } from '../../domain/transaction/transaction';
import { PIX_TYPE_ID } from '../../domain/transaction/transaction-type';
import { Prisma } from '../../generated/prisma/client';

import { PrismaTransactionEventStore } from './prisma-transaction-event.store';
import { type PrismaService } from './prisma.service';

const CLIENT_VERSION = '7.10.0';

function buildTransaction(): Transaction {
  return Transaction.createPending({
    accountExternalIdDebit: randomUUID(),
    accountExternalIdCredit: randomUUID(),
    value: 120,
    transferTypeId: PIX_TYPE_ID,
  });
}

function recordFor(transaction: Transaction) {
  return {
    ...transaction,
    idempotencyKey: 'idem-1',
    bodyHash: hashBody(transaction),
    value: new Prisma.Decimal(transaction.value),
  } as never;
}

function buildPrisma() {
  const database = {
    transaction: { create: vi.fn() },
    outboxEvent: { create: vi.fn() },
  };
  const prisma = {
    transaction: { findUnique: vi.fn() },
    $transaction: vi.fn(async (operation: (client: typeof database) => Promise<unknown>) =>
      operation(database),
    ),
  } as unknown as PrismaService;
  return { prisma, database };
}

function uniqueError(target: string): unknown {
  return new Prisma.PrismaClientKnownRequestError('Unique constraint failed', {
    code: 'P2002',
    clientVersion: CLIENT_VERSION,
    meta: { target: [target] },
  });
}

describe('PrismaTransactionEventStore', () => {
  it('creates the transaction and outbox event in the same database transaction', async () => {
    const { prisma, database } = buildPrisma();
    const transaction = buildTransaction();
    const event = createTransactionCreatedEvent(transaction);
    database.transaction.create.mockResolvedValue(recordFor(transaction));
    const store = new PrismaTransactionEventStore(prisma);
    await expect(store.savePending({ transaction, event })).resolves.toMatchObject({
      outcome: 'created',
      transaction: { transactionExternalId: transaction.transactionExternalId },
    });
    expect(database.outboxEvent.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ eventId: event.eventId, payload: event }),
    });
  });

  it('returns the winner when a concurrent idempotency key insert loses', async () => {
    const { prisma, database } = buildPrisma();
    const transaction = buildTransaction();
    const idempotency = { key: 'idem-1', bodyHash: hashBody(transaction) };
    database.transaction.create.mockRejectedValue(uniqueError('idempotencyKey'));
    vi.mocked(prisma.transaction.findUnique).mockResolvedValue(recordFor(transaction));
    const store = new PrismaTransactionEventStore(prisma);
    await expect(
      store.savePending({
        transaction,
        event: createTransactionCreatedEvent(transaction),
        idempotency,
      }),
    ).resolves.toMatchObject({ outcome: 'replayed', bodyHash: idempotency.bodyHash });
  });

  it('propagates an outbox failure so the database transaction can roll back', async () => {
    const { prisma, database } = buildPrisma();
    const transaction = buildTransaction();
    database.transaction.create.mockResolvedValue(recordFor(transaction));
    database.outboxEvent.create.mockRejectedValue(uniqueError('eventId'));
    const store = new PrismaTransactionEventStore(prisma);
    await expect(
      store.savePending({ transaction, event: createTransactionCreatedEvent(transaction) }),
    ).rejects.toBeInstanceOf(Prisma.PrismaClientKnownRequestError);
  });
});
