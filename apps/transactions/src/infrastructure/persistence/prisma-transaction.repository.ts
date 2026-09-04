import { Injectable } from '@nestjs/common';

import { hashBody } from '../../application/helpers/hash-body';
import {
  type ListTransactionsFilters,
  type ListTransactionsResult,
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

import { toTransactionCreateInput, toTransactionEntity } from './mappers/transaction-record.mapper';
import { PrismaService } from './prisma.service';

const PRISMA_UNIQUE_CONSTRAINT_CODE = 'P2002';
const IDEMPOTENCY_KEY_COLUMN = 'idempotencyKey';

const STATUS_ID_BY_NAME: Record<TransactionStatusName, TransactionStatusId> = {
  pending: PENDING_STATUS_ID,
  approved: APPROVED_STATUS_ID,
  rejected: REJECTED_STATUS_ID,
};

function isIdempotencyConflict(error: unknown): boolean {
  if (!(error instanceof Prisma.PrismaClientKnownRequestError)) return false;
  if (error.code !== PRISMA_UNIQUE_CONSTRAINT_CODE) return false;
  const target = error.meta?.target;
  if (Array.isArray(target)) return target.includes(IDEMPOTENCY_KEY_COLUMN);
  return typeof target === 'string' && target.includes(IDEMPOTENCY_KEY_COLUMN);
}

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

  async save(transaction: Transaction, idempotencyKey?: string): Promise<Transaction> {
    const extras = idempotencyKey ? { idempotencyKey, bodyHash: hashBody(transaction) } : undefined;
    try {
      const record = await this.prisma.transaction.create({
        data: toTransactionCreateInput(transaction, extras),
      });
      return toTransactionEntity(record);
    } catch (error) {
      if (idempotencyKey && isIdempotencyConflict(error)) {
        const existing = await this.findByIdempotencyKey(idempotencyKey);
        if (existing) return existing;
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

  async findByIdempotencyKey(idempotencyKey: string): Promise<Transaction | null> {
    const record = await this.prisma.transaction.findUnique({ where: { idempotencyKey } });
    return record ? toTransactionEntity(record) : null;
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
