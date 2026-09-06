import './load-env';
import { type INestApplication } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Test, type TestingModuleBuilder } from '@nestjs/testing';

import {
  TRANSACTION_REPOSITORY,
  type TransactionRepository,
} from '../../src/application/ports/transaction-repository.port';
import { type Env } from '../../src/infrastructure/config/env.schema';
import { enableDashboardCors } from '../../src/infrastructure/http/dashboard-cors';

export type TransactionsTestApp = {
  app: INestApplication;
};

type TestAppOptions = {
  transactionRepository?: TransactionRepository;
  enableKafkaRuntime?: boolean;
};

function applyOverrides(
  builder: TestingModuleBuilder,
  options: TestAppOptions,
): TestingModuleBuilder {
  if (!options.transactionRepository) return builder;
  return builder.overrideProvider(TRANSACTION_REPOSITORY).useValue(options.transactionRepository);
}

export async function createTransactionsTestApp(
  options: TestAppOptions = {},
): Promise<TransactionsTestApp> {
  const databaseUrlTest = process.env.DATABASE_URL_TEST;
  if (!databaseUrlTest) throw new Error('DATABASE_URL_TEST is required for HTTP tests');
  process.env.DATABASE_URL = databaseUrlTest;
  if (!options.enableKafkaRuntime) {
    process.env.KAFKA_CONSUMER_ENABLED = 'false';
    process.env.OUTBOX_DISPATCH_ENABLED = 'false';
  }
  const [{ AppModule }, { HttpExceptionFilter }] = await Promise.all([
    import('../../src/app.module'),
    import('../../src/infrastructure/http/filters/http-exception.filter'),
  ]);
  const builder = Test.createTestingModule({ imports: [AppModule] });
  const moduleRef = await applyOverrides(builder, options).compile();
  const app = moduleRef.createNestApplication({ logger: false });
  const config = app.get<ConfigService<Env, true>>(ConfigService);
  enableDashboardCors(app, config.get('DASHBOARD_ORIGIN', { infer: true }));
  app.useGlobalFilters(new HttpExceptionFilter());
  await app.init();
  return { app };
}
