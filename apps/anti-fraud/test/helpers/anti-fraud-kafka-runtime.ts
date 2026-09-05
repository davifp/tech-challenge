import { AnalyzeTransactionUseCase } from '../../src/application/use-cases/analyze-transaction.use-case';
import { AntiFraudPolicy } from '../../src/domain/anti-fraud/anti-fraud-policy';
import {
  type KafkaClientConfig,
  type TransactionCreatedConsumerConfig,
} from '../../src/infrastructure/kafka/kafka.config';
import { KafkaJsEventPublisher } from '../../src/infrastructure/kafka/kafkajs-event.publisher';
import { TransactionCreatedMessageProcessor } from '../../src/infrastructure/kafka/transaction-created-message.processor';
import { TransactionCreatedConsumer } from '../../src/infrastructure/kafka/transaction-created.consumer';

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
