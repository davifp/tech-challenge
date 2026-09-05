import { z } from 'zod';

const DEFAULT_TRANSACTIONS_PORT = 3001;
const MIN_PORT = 1;
const MAX_PORT = 65535;
const TEST_NODE_ENV = 'test';
const POSTGRES_PROTOCOL_PATTERN = /^postgres(ql)?$/;
const DEFAULT_KAFKA_CONNECTION_TIMEOUT_MS = 3000;
const DEFAULT_KAFKA_REQUEST_TIMEOUT_MS = 30000;
const DEFAULT_KAFKA_RETRY_INITIAL_TIME_MS = 300;
const DEFAULT_KAFKA_RETRY_COUNT = 5;
const DEFAULT_OUTBOX_POLL_INTERVAL_MS = 1000;
const DEFAULT_OUTBOX_BATCH_SIZE = 50;
const DEFAULT_OUTBOX_RETRY_BASE_DELAY_MS = 1000;
const DEFAULT_OUTBOX_RETRY_MAX_DELAY_MS = 60000;

const nodeEnvSchema = z.enum(['development', 'test', 'production']).default('development');

const postgresUrlSchema = z.url({
  protocol: POSTGRES_PROTOCOL_PATTERN,
  error: 'must be a Postgres URL (postgres:// or postgresql://)',
});

const portSchema = z.coerce
  .number()
  .int()
  .min(MIN_PORT)
  .max(MAX_PORT)
  .default(DEFAULT_TRANSACTIONS_PORT);

const positiveInteger = (defaultValue: number) =>
  z.coerce.number().int().positive().default(defaultValue);
const nonNegativeInteger = (defaultValue: number) =>
  z.coerce.number().int().nonnegative().default(defaultValue);
const nonEmptyString = z.string().trim().min(1);
const brokersSchema = nonEmptyString
  .transform((brokers) =>
    brokers
      .split(',')
      .map((broker) => broker.trim())
      .filter(Boolean),
  )
  .pipe(z.array(nonEmptyString).min(1));
const optionalBooleanSchema = z
  .enum(['true', 'false'])
  .transform((value) => value === 'true')
  .optional();

export const envSchema = z
  .object({
    NODE_ENV: nodeEnvSchema,
    DATABASE_URL: postgresUrlSchema,
    DATABASE_URL_TEST: postgresUrlSchema.optional(),
    TRANSACTIONS_PORT: portSchema,
    KAFKA_BROKERS: brokersSchema,
    KAFKA_CLIENT_ID: nonEmptyString,
    KAFKA_GROUP_ID_TRANSACTIONS: nonEmptyString,
    KAFKA_CONNECTION_TIMEOUT_MS: positiveInteger(DEFAULT_KAFKA_CONNECTION_TIMEOUT_MS),
    KAFKA_REQUEST_TIMEOUT_MS: positiveInteger(DEFAULT_KAFKA_REQUEST_TIMEOUT_MS),
    KAFKA_RETRY_INITIAL_TIME_MS: positiveInteger(DEFAULT_KAFKA_RETRY_INITIAL_TIME_MS),
    KAFKA_RETRY_COUNT: nonNegativeInteger(DEFAULT_KAFKA_RETRY_COUNT),
    OUTBOX_DISPATCH_ENABLED: optionalBooleanSchema,
    OUTBOX_POLL_INTERVAL_MS: positiveInteger(DEFAULT_OUTBOX_POLL_INTERVAL_MS),
    OUTBOX_BATCH_SIZE: positiveInteger(DEFAULT_OUTBOX_BATCH_SIZE),
    OUTBOX_RETRY_BASE_DELAY_MS: positiveInteger(DEFAULT_OUTBOX_RETRY_BASE_DELAY_MS),
    OUTBOX_RETRY_MAX_DELAY_MS: positiveInteger(DEFAULT_OUTBOX_RETRY_MAX_DELAY_MS),
  })
  .superRefine((data, ctx) => {
    if (data.NODE_ENV === TEST_NODE_ENV && !data.DATABASE_URL_TEST) {
      ctx.addIssue({
        code: 'custom',
        path: ['DATABASE_URL_TEST'],
        message: 'is required when NODE_ENV=test',
      });
    }
  });

export type Env = z.infer<typeof envSchema>;
