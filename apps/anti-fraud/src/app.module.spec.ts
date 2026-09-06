import { Test } from '@nestjs/testing';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { AnalyzeTransactionUseCase } from './application/use-cases/analyze-transaction.use-case';
import { TransactionCreatedConsumer } from './infrastructure/kafka/transaction-created.consumer';

afterEach(() => {
  vi.unstubAllEnvs();
});

describe('AppModule', () => {
  it('composes the anti-fraud use case and Kafka inbound adapter', async () => {
    vi.stubEnv('NODE_ENV', 'test');
    vi.stubEnv('KAFKA_BROKERS', 'localhost:9092');
    vi.stubEnv('KAFKA_CLIENT_ID', 'anti-fraud-unit-test');
    vi.stubEnv('KAFKA_GROUP_ID_ANTI_FRAUD', 'anti-fraud-unit-test');
    const { AppModule } = await import('./app.module');
    const module = await Test.createTestingModule({ imports: [AppModule] }).compile();
    expect(module.get(AnalyzeTransactionUseCase)).toBeInstanceOf(AnalyzeTransactionUseCase);
    expect(module.get(TransactionCreatedConsumer)).toBeInstanceOf(TransactionCreatedConsumer);
    await module.close();
  });
});
