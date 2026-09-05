import { Injectable } from '@nestjs/common';

import {
  type IdempotentTransaction,
  type ListTransactionsFilters,
  type ListTransactionsResult,
  type SaveTransactionResult,
  type TransactionIdempotency,
  type TransactionRepository,
} from '../../application/ports/transaction-repository.port';
import { type Transaction } from '../../domain/transaction/transaction';
import {
  APPROVED_STATUS_ID,
  PENDING_STATUS_ID,
  REJECTED_STATUS_ID,
  type TransactionStatusId,
  type TransactionStatusName,
} from '../../domain/transaction/transaction-status';
import { Prisma } from '../../generated/prisma/client';

import {
  toIdempotentTransaction,
  toTransactionCreateInput,
  toTransactionEntity,
} from './mappers/transaction-record.mapper';
import { isPrismaUniqueConflictOn } from './prisma-unique-conflict';
import { PrismaService } from './prisma.service';

const IDEMPOTENCY_KEY_COLUMN = 'idempotencyKey';

const STATUS_ID_BY_NAME: Record<TransactionStatusName, TransactionStatusId> = {
  pending: PENDING_STATUS_ID,
  approved: APPROVED_STATUS_ID,
  rejected: REJECTED_STATUS_ID,
};

function buildWhere(filters: ListTransactionsFilters): Prisma.TransactionWhereInput {
  return {
    ...(filters.status && { transactionStatusId: STATUS_ID_BY_NAME[filters.status] }),
    ...(filters.transferTypeId && { transferTypeId: filters.transferTypeId }),
    ...((filters.createdAtFrom || filters.createdAtTo) && {
      createdAt: {
        ...(filters.createdAtFrom && { gte: filters.createdAtFrom }),
        ...(filters.createdAtTo && { lte: filters.createdAtTo }),
      },
    }),
  };
}

@Injectable()
export class PrismaTransactionRepository implements TransactionRepository {
  constructor(private readonly prisma: PrismaService) {}

  async save(
    transaction: Transaction,
    idempotency?: TransactionIdempotency,
  ): Promise<SaveTransactionResult> {
    const extras = idempotency
      ? { idempotencyKey: idempotency.key, bodyHash: idempotency.bodyHash }
      : undefined;
    try {
      const record = await this.prisma.transaction.create({
        data: toTransactionCreateInput(transaction, extras),
      });
      return { outcome: 'created', transaction: toTransactionEntity(record) };
    } catch (error) {
      if (idempotency && isPrismaUniqueConflictOn(error, IDEMPOTENCY_KEY_COLUMN)) {
        const existing = await this.findByIdempotencyKey(idempotency.key);
        if (existing) return { outcome: 'replayed', ...existing };
      }
      throw error;
    }
  }

  async findByExternalId(externalId: string): Promise<Transaction | null> {
    const record = await this.prisma.transaction.findUnique({
      where: { transactionExternalId: externalId },
    });
    return record ? toTransactionEntity(record) : null;
  }

  async findByIdempotencyKey(idempotencyKey: string): Promise<IdempotentTransaction | null> {
    const record = await this.prisma.transaction.findUnique({ where: { idempotencyKey } });
    return record ? toIdempotentTransaction(record) : null;
  }

  async list(filters: ListTransactionsFilters): Promise<ListTransactionsResult> {
    const where = buildWhere(filters);
    const [items, total] = await this.prisma.$transaction([
      this.prisma.transaction.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (filters.page - 1) * filters.limit,
        take: filters.limit,
      }),
      this.prisma.transaction.count({ where }),
    ]);
    return { items: items.map(toTransactionEntity), total };
  }
}
