import { type Provider } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import {
  DEAD_LETTER_PUBLISHER,
  type DeadLetterPublisher,
} from './application/ports/dead-letter-publisher.port';
import {
  TRANSACTION_STATUS_PUBLISHER,
  type TransactionStatusPublisher,
} from './application/ports/transaction-status-publisher.port';
import { AnalyzeTransactionUseCase } from './application/use-cases/analyze-transaction.use-case';
import { AntiFraudPolicy } from './domain/anti-fraud/anti-fraud-policy';
import { type Env } from './infrastructure/config/env.schema';
import { KafkaJsEventPublisher } from './infrastructure/kafka/publishing/kafkajs-event.publisher';
import { consumerConfig, kafkaClientConfig } from './infrastructure/kafka/shared/kafka.config';
import { TransactionCreatedMessageProcessor } from './infrastructure/kafka/transaction-created/transaction-created-message.processor';
import { TransactionCreatedConsumer } from './infrastructure/kafka/transaction-created/transaction-created.consumer';

const publisherProvider: Provider = {
  provide: KafkaJsEventPublisher,
  useFactory: (config: ConfigService<Env, true>) =>
    new KafkaJsEventPublisher(kafkaClientConfig(config)),
  inject: [ConfigService],
};

const analyzeTransactionProvider: Provider = {
  provide: AnalyzeTransactionUseCase,
  useFactory: (policy: AntiFraudPolicy, publisher: TransactionStatusPublisher) =>
    new AnalyzeTransactionUseCase(policy, publisher),
  inject: [AntiFraudPolicy, TRANSACTION_STATUS_PUBLISHER],
};

const processorProvider: Provider = {
  provide: TransactionCreatedMessageProcessor,
  useFactory: (
    analyzeTransaction: AnalyzeTransactionUseCase,
    deadLetterPublisher: DeadLetterPublisher,
    config: ConfigService<Env, true>,
  ) => {
    const kafkaConfig = consumerConfig(config);
    return new TransactionCreatedMessageProcessor(
      { analyzeTransaction, deadLetterPublisher },
      { maxAttempts: kafkaConfig.maxAttempts, retryDelayMs: kafkaConfig.retryDelayMs },
    );
  },
  inject: [AnalyzeTransactionUseCase, DEAD_LETTER_PUBLISHER, ConfigService],
};

const consumerProvider: Provider = {
  provide: TransactionCreatedConsumer,
  useFactory: (processor: TransactionCreatedMessageProcessor, config: ConfigService<Env, true>) =>
    new TransactionCreatedConsumer(consumerConfig(config), processor),
  inject: [TransactionCreatedMessageProcessor, ConfigService],
};

export const antiFraudProviders: Provider[] = [
  AntiFraudPolicy,
  publisherProvider,
  { provide: TRANSACTION_STATUS_PUBLISHER, useExisting: KafkaJsEventPublisher },
  { provide: DEAD_LETTER_PUBLISHER, useExisting: KafkaJsEventPublisher },
  analyzeTransactionProvider,
  processorProvider,
  consumerProvider,
];
