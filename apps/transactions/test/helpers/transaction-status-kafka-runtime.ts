import { type ApplyTransactionStatusUseCase } from '../../src/application/use-cases/apply-transaction-status.use-case';
import { KafkaJsDeadLetterPublisher } from '../../src/infrastructure/kafka/kafkajs-dead-letter.publisher';
import { type TransactionStatusConsumerConfig } from '../../src/infrastructure/kafka/transaction-status-consumer.config';
import { TransactionStatusMessageProcessor } from '../../src/infrastructure/kafka/transaction-status-message.processor';
import { TransactionStatusConsumer } from '../../src/infrastructure/kafka/transaction-status.consumer';

export function createTransactionStatusKafkaRuntime(
  config: TransactionStatusConsumerConfig,
  applyTransactionStatus: ApplyTransactionStatusUseCase,
) {
  const deadLetterPublisher = new KafkaJsDeadLetterPublisher(config);
  const processor = new TransactionStatusMessageProcessor(
    { applyTransactionStatus, deadLetterPublisher },
    { maxAttempts: config.maxAttempts, retryDelayMs: config.retryDelayMs },
  );
  const consumer = new TransactionStatusConsumer(config, processor);
  return { consumer, deadLetterPublisher };
}
