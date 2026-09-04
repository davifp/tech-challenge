import { randomUUID } from 'node:crypto';

import { describe, expect, it, vi } from 'vitest';

import { Transaction } from '../../domain/transaction/transaction';
import { TRANSFER_TYPE_ID } from '../../domain/transaction/transaction-type';
import { Prisma } from '../../generated/prisma/client';

import { PrismaTransactionRepository } from './prisma-transaction.repository';
import { type PrismaService } from './prisma.service';

const CLIENT_VERSION = '7.10.0';

function buildTransaction(): Transaction {
  return Transaction.createPending({
    accountExternalIdDebit: randomUUID(),
    accountExternalIdCredit: randomUUID(),
    value: 120,
    transferTypeId: TRANSFER_TYPE_ID,
  });
}

function buildPrisma(): PrismaService {
  return {
    transaction: {
      create: vi.fn(),
      findUnique: vi.fn(),
    },
  } as unknown as PrismaService;
}

function knownRequestError(target: string[] | string, code = 'P2002'): unknown {
  return new Prisma.PrismaClientKnownRequestError('Unique constraint failed', {
    code,
    clientVersion: CLIENT_VERSION,
    meta: { target },
  });
}

describe('PrismaTransactionRepository.save', () => {
  it('returns the existing transaction when Prisma raises P2002 on idempotencyKey', async () => {
    const prisma = buildPrisma();
    const existing = buildTransaction();
    vi.mocked(prisma.transaction.create).mockRejectedValue(knownRequestError(['idempotencyKey']));
    vi.mocked(prisma.transaction.findUnique).mockResolvedValue({
      transactionExternalId: existing.transactionExternalId,
      idempotencyKey: 'idem-1',
      bodyHash: null,
      accountExternalIdDebit: existing.accountExternalIdDebit,
      accountExternalIdCredit: existing.accountExternalIdCredit,
      value: new Prisma.Decimal(existing.value),
      transferTypeId: existing.transferTypeId,
      transactionStatusId: existing.transactionStatusId,
      createdAt: existing.createdAt,
      updatedAt: existing.updatedAt,
    } as never);
    const repository = new PrismaTransactionRepository(prisma);
    const result = await repository.save(buildTransaction(), 'idem-1');
    expect(result.transactionExternalId).toBe(existing.transactionExternalId);
    expect(prisma.transaction.findUnique).toHaveBeenCalledWith({
      where: { idempotencyKey: 'idem-1' },
    });
  });

  it('propagates P2002 on a different column', async () => {
    const prisma = buildPrisma();
    vi.mocked(prisma.transaction.create).mockRejectedValue(
      knownRequestError(['transactionExternalId']),
    );
    const repository = new PrismaTransactionRepository(prisma);
    await expect(repository.save(buildTransaction(), 'idem-1')).rejects.toBeInstanceOf(
      Prisma.PrismaClientKnownRequestError,
    );
  });

  it('propagates unknown errors', async () => {
    const prisma = buildPrisma();
    vi.mocked(prisma.transaction.create).mockRejectedValue(new Error('boom'));
    const repository = new PrismaTransactionRepository(prisma);
    await expect(repository.save(buildTransaction(), 'idem-1')).rejects.toThrow('boom');
  });
});
