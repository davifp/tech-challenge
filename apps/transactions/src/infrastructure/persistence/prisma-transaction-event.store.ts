import { Inject, Injectable } from '@nestjs/common';

import {
  type SavePendingTransactionInput,
  type SaveTransactionResult,
  type TransactionEventStore,
  type TransactionIdempotency,
} from '../../application/ports/transaction-event-store.port';
import type { Transaction as TransactionRecord } from '../../generated/prisma/client';

import { toOutboxEventCreateInput } from './mappers/outbox-event-record.mapper';
import {
  toIdempotentTransaction,
  toTransactionCreateInput,
  toTransactionEntity,
} from './mappers/transaction-record.mapper';
import { isPrismaUniqueConflictOn } from './prisma-unique-conflict';
import { PrismaService } from './prisma.service';

const IDEMPOTENCY_KEY_COLUMN = 'idempotencyKey';

@Injectable()
export class PrismaTransactionEventStore implements TransactionEventStore {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async savePending(input: SavePendingTransactionInput): Promise<SaveTransactionResult> {
    try {
      const record = await this.createAtomically(input);
      return { outcome: 'created', transaction: toTransactionEntity(record) };
    } catch (error) {
      return this.resolveConcurrentReplay(error, input.idempotency);
    }
  }

  async findByIdempotencyKey(idempotencyKey: string) {
    const record = await this.prisma.transaction.findUnique({ where: { idempotencyKey } });
    return record ? toIdempotentTransaction(record) : null;
  }

  private createAtomically(input: SavePendingTransactionInput): Promise<TransactionRecord> {
    const extras = input.idempotency
      ? { idempotencyKey: input.idempotency.key, bodyHash: input.idempotency.bodyHash }
      : undefined;
    return this.prisma.$transaction(async (database) => {
      const record = await database.transaction.create({
        data: toTransactionCreateInput(input.transaction, extras),
      });
      await database.outboxEvent.create({ data: toOutboxEventCreateInput(input.event) });
      return record;
    });
  }

  private async resolveConcurrentReplay(
    error: unknown,
    idempotency?: TransactionIdempotency,
  ): Promise<SaveTransactionResult> {
    if (idempotency && isPrismaUniqueConflictOn(error, IDEMPOTENCY_KEY_COLUMN)) {
      const existing = await this.findByIdempotencyKey(idempotency.key);
      if (existing) return { outcome: 'replayed', ...existing };
    }
    throw error;
  }
}
