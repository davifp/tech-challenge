import { Module, type Provider } from '@nestjs/common';

import {
  TRANSACTION_CATALOG_REPOSITORY,
  type TransactionCatalogRepository,
} from './application/ports/transaction-catalog-repository.port';
import {
  TRANSACTION_EVENT_STORE,
  type TransactionEventStore,
} from './application/ports/transaction-event-store.port';
import {
  TRANSACTION_REPOSITORY,
  type TransactionRepository,
} from './application/ports/transaction-repository.port';
import { CreateTransactionUseCase } from './application/use-cases/create-transaction.use-case';
import { GetTransactionByExternalIdUseCase } from './application/use-cases/get-transaction-by-external-id.use-case';
import { ListTransactionsUseCase } from './application/use-cases/list-transactions.use-case';
import { TransactionsController } from './infrastructure/http/transactions.controller';
import { PrismaTransactionCatalogRepository } from './infrastructure/persistence/prisma-transaction-catalog.repository';
import { PrismaTransactionEventStore } from './infrastructure/persistence/prisma-transaction-event.store';
import { PrismaTransactionRepository } from './infrastructure/persistence/prisma-transaction.repository';
import { PrismaService } from './infrastructure/persistence/prisma.service';

const repositoryProviders: Provider[] = [
  { provide: TRANSACTION_EVENT_STORE, useClass: PrismaTransactionEventStore },
  { provide: TRANSACTION_REPOSITORY, useClass: PrismaTransactionRepository },
  { provide: TRANSACTION_CATALOG_REPOSITORY, useClass: PrismaTransactionCatalogRepository },
];

const useCaseProviders: Provider[] = [
  {
    provide: CreateTransactionUseCase,
    useFactory: (store: TransactionEventStore, catalog: TransactionCatalogRepository) =>
      new CreateTransactionUseCase(store, catalog),
    inject: [TRANSACTION_EVENT_STORE, TRANSACTION_CATALOG_REPOSITORY],
  },
  {
    provide: GetTransactionByExternalIdUseCase,
    useFactory: (repo: TransactionRepository) => new GetTransactionByExternalIdUseCase(repo),
    inject: [TRANSACTION_REPOSITORY],
  },
  {
    provide: ListTransactionsUseCase,
    useFactory: (repo: TransactionRepository, catalog: TransactionCatalogRepository) =>
      new ListTransactionsUseCase(repo, catalog),
    inject: [TRANSACTION_REPOSITORY, TRANSACTION_CATALOG_REPOSITORY],
  },
];

@Module({
  controllers: [TransactionsController],
  providers: [PrismaService, ...repositoryProviders, ...useCaseProviders],
})
export class TransactionsModule {}
