import './load-env';
import { randomUUID } from 'node:crypto';

const DEFAULT_CONNECTION_TIMEOUT_MS = 3000;
const DEFAULT_REQUEST_TIMEOUT_MS = 30000;
const DEFAULT_RETRY_INITIAL_TIME_MS = 300;
const DEFAULT_RETRY_COUNT = 5;
const DEFAULT_SESSION_TIMEOUT_MS = 30000;
const DEFAULT_CONSUMER_ATTEMPTS = 3;
const E2E_RETRY_DELAY_MS = 10;
const E2E_OUTBOX_POLL_INTERVAL_MS = 20;

export type KafkaE2eEnvironment = ReturnType<typeof configureKafkaE2eEnvironment>;

export function configureKafkaE2eEnvironment() {
  const runId = randomUUID();
  const previous = captureMutableEnvironment();
  const clientId = `${requiredEnvironment('KAFKA_CLIENT_ID')}-e2e-${runId}`;
  const transactionsGroupId = `transactions-e2e-${runId}`;
  const antiFraudGroupId = `anti-fraud-e2e-${runId}`;
  const probeGroupId = `${clientId}-probe`;
  process.env.KAFKA_CLIENT_ID = clientId;
  process.env.KAFKA_GROUP_ID_TRANSACTIONS = transactionsGroupId;
  process.env.KAFKA_CONSUMER_ENABLED = 'true';
  process.env.OUTBOX_DISPATCH_ENABLED = 'true';
  process.env.OUTBOX_POLL_INTERVAL_MS = String(E2E_OUTBOX_POLL_INTERVAL_MS);
  return {
    brokers: requiredEnvironment('KAFKA_BROKERS')
      .split(',')
      .map((broker) => broker.trim()),
    clientId,
    transactionsGroupId,
    antiFraudGroupId,
    probeGroupId,
    activeGroupIds: [transactionsGroupId, antiFraudGroupId, probeGroupId],
    connectionTimeoutMs: numericEnvironment(
      'KAFKA_CONNECTION_TIMEOUT_MS',
      DEFAULT_CONNECTION_TIMEOUT_MS,
    ),
    requestTimeoutMs: numericEnvironment('KAFKA_REQUEST_TIMEOUT_MS', DEFAULT_REQUEST_TIMEOUT_MS),
    retryInitialTimeMs: numericEnvironment(
      'KAFKA_RETRY_INITIAL_TIME_MS',
      DEFAULT_RETRY_INITIAL_TIME_MS,
    ),
    retryCount: numericEnvironment('KAFKA_RETRY_COUNT', DEFAULT_RETRY_COUNT),
    sessionTimeoutMs: numericEnvironment('KAFKA_SESSION_TIMEOUT_MS', DEFAULT_SESSION_TIMEOUT_MS),
    maxAttempts: numericEnvironment('KAFKA_CONSUMER_MAX_ATTEMPTS', DEFAULT_CONSUMER_ATTEMPTS),
    retryDelayMs: E2E_RETRY_DELAY_MS,
    restore: () => restoreEnvironment(previous),
  };
}

function requiredEnvironment(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is required for Kafka E2E tests`);
  return value;
}

function numericEnvironment(name: string, fallback: number): number {
  const value = process.env[name];
  return value ? Number(value) : fallback;
}

function captureMutableEnvironment(): Record<string, string | undefined> {
  return Object.fromEntries(
    [
      'KAFKA_CLIENT_ID',
      'KAFKA_GROUP_ID_TRANSACTIONS',
      'KAFKA_CONSUMER_ENABLED',
      'OUTBOX_DISPATCH_ENABLED',
      'OUTBOX_POLL_INTERVAL_MS',
    ].map((name) => [name, process.env[name]]),
  );
}

function restoreEnvironment(previous: Record<string, string | undefined>): void {
  for (const [name, value] of Object.entries(previous)) {
    if (value === undefined) delete process.env[name];
    else process.env[name] = value;
  }
}
