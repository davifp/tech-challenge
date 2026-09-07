import { type KafkaClientConfig } from '../../../anti-fraud/src/infrastructure/kafka/shared/kafka.config';
import { createAntiFraudKafkaRuntime } from '../../../anti-fraud/test/helpers/anti-fraud-kafka-runtime';

import { type KafkaE2eEnvironment } from './kafka-e2e-environment';

export type AntiFraudE2eRuntime = ReturnType<typeof createAntiFraudKafkaRuntime>;

export function createAntiFraudE2eRuntime(environment: KafkaE2eEnvironment): AntiFraudE2eRuntime {
  const clientConfig: KafkaClientConfig = {
    brokers: environment.brokers,
    clientId: `${environment.clientId}-anti-fraud`,
    connectionTimeoutMs: environment.connectionTimeoutMs,
    requestTimeoutMs: environment.requestTimeoutMs,
    retryInitialTimeMs: environment.retryInitialTimeMs,
    retryCount: environment.retryCount,
  };
  return createAntiFraudKafkaRuntime(clientConfig, {
    ...clientConfig,
    groupId: environment.antiFraudGroupId,
    sessionTimeoutMs: environment.sessionTimeoutMs,
    maxAttempts: environment.maxAttempts,
    retryDelayMs: environment.retryDelayMs,
  });
}
