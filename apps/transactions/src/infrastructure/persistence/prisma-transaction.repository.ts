import { Injectable } from '@nestjs/common';

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

import { toTransactionEntity } from './mappers/transaction-record.mapper';
import { PrismaService } from './prisma.service';

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

  async findByExternalId(externalId: string): Promise<Transaction | null> {
    const record = await this.prisma.transaction.findUnique({
      where: { transactionExternalId: externalId },
    });
    return record ? toTransactionEntity(record) : null;
  }

  async list(filters: ListTransactionsFilters): Promise<ListTransactionsResult> {
    const where = buildWhere(filters);
    const [items, total] = await this.prisma.$transaction([
      this.prisma.transaction.findMany({
        where,
        orderBy: [{ createdAt: 'desc' }, { transactionExternalId: 'desc' }],
        skip: (filters.page - 1) * filters.limit,
        take: filters.limit,
      }),
      this.prisma.transaction.count({ where }),
    ]);
    return { items: items.map(toTransactionEntity), total };
  }
}
