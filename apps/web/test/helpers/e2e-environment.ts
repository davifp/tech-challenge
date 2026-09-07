import { randomUUID } from 'node:crypto';

import { config as loadDotenv } from 'dotenv';

const ROOT_ENV_FILE = new URL('../../../../.env', import.meta.url);
const DEFAULT_API_PORT = 3001;
const DEFAULT_WEB_PORT = 5191;
const DEFAULT_CONNECTION_TIMEOUT_MS = '3000';
const DEFAULT_REQUEST_TIMEOUT_MS = '30000';
const DEFAULT_RETRY_INITIAL_TIME_MS = '300';
const DEFAULT_RETRY_COUNT = '5';
const DEFAULT_SESSION_TIMEOUT_MS = '30000';
const DEFAULT_CONSUMER_MAX_ATTEMPTS = '3';
const DEFAULT_CONSUMER_RETRY_DELAY_MS = '50';
const DEFAULT_OUTBOX_POLL_INTERVAL_MS = '50';
const DEFAULT_OUTBOX_BATCH_SIZE = '50';
const DEFAULT_OUTBOX_RETRY_BASE_DELAY_MS = '100';
const DEFAULT_OUTBOX_RETRY_MAX_DELAY_MS = '1000';

loadDotenv({ path: ROOT_ENV_FILE, override: false, quiet: true });

function requiredEnvironment(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is required for Playwright E2E tests`);
  return value;
}

function configuredPort(name: string, fallback: number): number {
  const value = process.env[name];
  if (!value) return fallback;
  const port = Number(value);
  if (!Number.isInteger(port) || port < 1 || port > 65_535) {
    throw new Error(`${name} must be a valid TCP port`);
  }
  return port;
}

function environmentValue(name: string, fallback: string): string {
  return process.env[name] ?? fallback;
}

export function readE2eEnvironment() {
  const apiPort = configuredPort('E2E_TRANSACTIONS_PORT', DEFAULT_API_PORT);
  const webPort = configuredPort('E2E_WEB_PORT', DEFAULT_WEB_PORT);
  const runId = process.env.PLAYWRIGHT_RUN_ID ?? randomUUID();
  process.env.PLAYWRIGHT_RUN_ID = runId;
  const apiOrigin = `http://localhost:${apiPort}`;
  const webOrigin = `http://localhost:${webPort}`;
  const databaseUrl = requiredEnvironment('DATABASE_URL_TEST');
  const kafkaBrokers = requiredEnvironment('KAFKA_BROKERS');
  const kafkaClientId = `tech-challenge-playwright-${runId}`;
  return {
    apiOrigin,
    webOrigin,
    webPort,
    backend: {
      NODE_ENV: 'test' as const,
      DATABASE_URL: databaseUrl,
      DATABASE_URL_TEST: databaseUrl,
      TRANSACTIONS_PORT: String(apiPort),
      DASHBOARD_ORIGIN: webOrigin,
      KAFKA_BROKERS: kafkaBrokers,
      KAFKA_CLIENT_ID: kafkaClientId,
      KAFKA_GROUP_ID_TRANSACTIONS: `transactions-playwright-${runId}`,
      KAFKA_GROUP_ID_ANTI_FRAUD: `anti-fraud-playwright-${runId}`,
      KAFKA_CONNECTION_TIMEOUT_MS: environmentValue(
        'KAFKA_CONNECTION_TIMEOUT_MS',
        DEFAULT_CONNECTION_TIMEOUT_MS,
      ),
      KAFKA_REQUEST_TIMEOUT_MS: environmentValue(
        'KAFKA_REQUEST_TIMEOUT_MS',
        DEFAULT_REQUEST_TIMEOUT_MS,
      ),
      KAFKA_RETRY_INITIAL_TIME_MS: environmentValue(
        'KAFKA_RETRY_INITIAL_TIME_MS',
        DEFAULT_RETRY_INITIAL_TIME_MS,
      ),
      KAFKA_RETRY_COUNT: environmentValue('KAFKA_RETRY_COUNT', DEFAULT_RETRY_COUNT),
      KAFKA_SESSION_TIMEOUT_MS: environmentValue(
        'KAFKA_SESSION_TIMEOUT_MS',
        DEFAULT_SESSION_TIMEOUT_MS,
      ),
      KAFKA_CONSUMER_MAX_ATTEMPTS: environmentValue(
        'KAFKA_CONSUMER_MAX_ATTEMPTS',
        DEFAULT_CONSUMER_MAX_ATTEMPTS,
      ),
      KAFKA_CONSUMER_RETRY_DELAY_MS: environmentValue(
        'KAFKA_CONSUMER_RETRY_DELAY_MS',
        DEFAULT_CONSUMER_RETRY_DELAY_MS,
      ),
      KAFKA_CONSUMER_ENABLED: 'true',
      OUTBOX_DISPATCH_ENABLED: 'true',
      OUTBOX_POLL_INTERVAL_MS: DEFAULT_OUTBOX_POLL_INTERVAL_MS,
      OUTBOX_BATCH_SIZE: environmentValue('OUTBOX_BATCH_SIZE', DEFAULT_OUTBOX_BATCH_SIZE),
      OUTBOX_RETRY_BASE_DELAY_MS: DEFAULT_OUTBOX_RETRY_BASE_DELAY_MS,
      OUTBOX_RETRY_MAX_DELAY_MS: DEFAULT_OUTBOX_RETRY_MAX_DELAY_MS,
    },
  };
}
