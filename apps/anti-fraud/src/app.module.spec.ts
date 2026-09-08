import { Test } from '@nestjs/testing';
import { describe, expect, it } from 'vitest';

import { AppModule } from './app.module';
import { AnalyzeTransactionUseCase } from './application/use-cases/analyze-transaction.use-case';
import { TransactionCreatedConsumer } from './infrastructure/kafka/transaction-created/transaction-created.consumer';

describe('AppModule', () => {
  it('composes the anti-fraud use case and Kafka inbound adapter', async () => {
    const module = await Test.createTestingModule({ imports: [AppModule] }).compile();
    expect(module.get(AnalyzeTransactionUseCase)).toBeInstanceOf(AnalyzeTransactionUseCase);
    expect(module.get(TransactionCreatedConsumer)).toBeInstanceOf(TransactionCreatedConsumer);
    await module.close();
  });
});
