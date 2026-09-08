import { AnalyzeTransactionUseCase } from '../../src/application/use-cases/analyze-transaction.use-case';
import { AntiFraudPolicy } from '../../src/domain/anti-fraud/anti-fraud-policy';
import { KafkaJsEventPublisher } from '../../src/infrastructure/kafka/publishing/kafkajs-event.publisher';
import {
  type KafkaClientConfig,
  type TransactionCreatedConsumerConfig,
} from '../../src/infrastructure/kafka/shared/kafka.config';
import { TransactionCreatedMessageProcessor } from '../../src/infrastructure/kafka/transaction-created/transaction-created-message.processor';
import { TransactionCreatedConsumer } from '../../src/infrastructure/kafka/transaction-created/transaction-created.consumer';

export function createAntiFraudKafkaRuntime(
  clientConfig: KafkaClientConfig,
  consumerConfig: TransactionCreatedConsumerConfig,
) {
  const publisher = new KafkaJsEventPublisher(clientConfig);
  const analyzeTransaction = new AnalyzeTransactionUseCase(new AntiFraudPolicy(), publisher);
  const processor = new TransactionCreatedMessageProcessor(
    { analyzeTransaction, deadLetterPublisher: publisher },
    { maxAttempts: consumerConfig.maxAttempts, retryDelayMs: consumerConfig.retryDelayMs },
  );
  const consumer = new TransactionCreatedConsumer(consumerConfig, processor);
  return { publisher, consumer };
}
