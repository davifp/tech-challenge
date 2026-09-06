import { type Provider } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import { type DeadLetterPublisher } from './application/ports/dead-letter-publisher.port';
import { ApplyTransactionStatusUseCase } from './application/use-cases/apply-transaction-status.use-case';
import { type Env } from './infrastructure/config/env.schema';
import { KafkaJsDeadLetterPublisher } from './infrastructure/kafka/kafkajs-dead-letter.publisher';
import { transactionStatusConsumerConfig } from './infrastructure/kafka/transaction-status-consumer.config';
import { TransactionStatusMessageProcessor } from './infrastructure/kafka/transaction-status-message.processor';
import { TransactionStatusConsumer } from './infrastructure/kafka/transaction-status.consumer';

const deadLetterPublisherProvider: Provider = {
  provide: KafkaJsDeadLetterPublisher,
  useFactory: (config: ConfigService<Env, true>) =>
    new KafkaJsDeadLetterPublisher(transactionStatusConsumerConfig(config)),
  inject: [ConfigService],
};

const processorProvider: Provider = {
  provide: TransactionStatusMessageProcessor,
  useFactory: (
    applyTransactionStatus: ApplyTransactionStatusUseCase,
    deadLetterPublisher: DeadLetterPublisher,
    config: ConfigService<Env, true>,
  ) => {
    const consumerConfig = transactionStatusConsumerConfig(config);
    return new TransactionStatusMessageProcessor(
      { applyTransactionStatus, deadLetterPublisher },
      { maxAttempts: consumerConfig.maxAttempts, retryDelayMs: consumerConfig.retryDelayMs },
    );
  },
  inject: [ApplyTransactionStatusUseCase, KafkaJsDeadLetterPublisher, ConfigService],
};

const consumerProvider: Provider = {
  provide: TransactionStatusConsumer,
  useFactory: (config: ConfigService<Env, true>, processor: TransactionStatusMessageProcessor) =>
    new TransactionStatusConsumer(transactionStatusConsumerConfig(config), processor),
  inject: [ConfigService, TransactionStatusMessageProcessor],
};

export const transactionStatusConsumerProviders: Provider[] = [
  deadLetterPublisherProvider,
  processorProvider,
  consumerProvider,
];
