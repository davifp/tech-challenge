import { Module, type Provider } from '@nestjs/common';

import {
  TRANSACTION_CATALOG_REPOSITORY,
  type TransactionCatalogRepository,
} from './application/ports/transaction-catalog-repository.port';
import {
  TRANSACTION_REPOSITORY,
  type TransactionRepository,
} from './application/ports/transaction-repository.port';
import { CreateTransactionUseCase } from './application/use-cases/create-transaction.use-case';
import { GetTransactionByExternalIdUseCase } from './application/use-cases/get-transaction-by-external-id.use-case';
import { ListTransactionsUseCase } from './application/use-cases/list-transactions.use-case';
import { TransactionsController } from './infrastructure/http/transactions.controller';
import { PrismaTransactionCatalogRepository } from './infrastructure/persistence/prisma-transaction-catalog.repository';
import { PrismaTransactionRepository } from './infrastructure/persistence/prisma-transaction.repository';
import { PrismaService } from './infrastructure/persistence/prisma.service';

const repositoryProviders: Provider[] = [
  { provide: TRANSACTION_REPOSITORY, useClass: PrismaTransactionRepository },
  { provide: TRANSACTION_CATALOG_REPOSITORY, useClass: PrismaTransactionCatalogRepository },
];

const useCaseProviders: Provider[] = [
  {
    provide: CreateTransactionUseCase,
    useFactory: (repo: TransactionRepository, catalog: TransactionCatalogRepository) =>
      new CreateTransactionUseCase(repo, catalog),
    inject: [TRANSACTION_REPOSITORY, TRANSACTION_CATALOG_REPOSITORY],
  },
  {
    provide: GetTransactionByExternalIdUseCase,
    useFactory: (repo: TransactionRepository) => new GetTransactionByExternalIdUseCase(repo),
    inject: [TRANSACTION_REPOSITORY],
  },
  {
    provide: ListTransactionsUseCase,
    useFactory: (repo: TransactionRepository) => new ListTransactionsUseCase(repo),
    inject: [TRANSACTION_REPOSITORY],
  },
];

@Module({
  controllers: [TransactionsController],
  providers: [PrismaService, ...repositoryProviders, ...useCaseProviders],
})
export class TransactionsModule {}
