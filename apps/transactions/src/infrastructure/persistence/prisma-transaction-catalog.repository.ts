import { Injectable } from '@nestjs/common';

import {
  type TransactionCatalogRepository,
  type TransferTypeCatalogEntry,
} from '../../application/ports/transaction-catalog-repository.port';
import {
  type TransactionTypeId,
  type TransactionTypeName,
} from '../../domain/transaction/transaction-type';

import { PrismaService } from './prisma.service';

@Injectable()
export class PrismaTransactionCatalogRepository implements TransactionCatalogRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findTransferTypeById(id: number): Promise<TransferTypeCatalogEntry | null> {
    const record = await this.prisma.transactionType.findUnique({ where: { id } });
    if (!record) return null;
    return {
      id: record.id as TransactionTypeId,
      name: record.name as TransactionTypeName,
    };
  }
}
