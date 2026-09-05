import { z } from 'zod';

const DEFAULT_CONNECTION_TIMEOUT_MS = 3000;
const DEFAULT_REQUEST_TIMEOUT_MS = 30000;
const DEFAULT_RETRY_INITIAL_TIME_MS = 300;
const DEFAULT_RETRY_COUNT = 5;
const DEFAULT_SESSION_TIMEOUT_MS = 30000;
const DEFAULT_CONSUMER_MAX_ATTEMPTS = 3;
const DEFAULT_CONSUMER_RETRY_DELAY_MS = 300;
const MAX_CONSUMER_ATTEMPTS = 3;

const nonEmptyString = z.string().trim().min(1);
const positiveInteger = (defaultValue: number) =>
  z.coerce.number().int().positive().default(defaultValue);
const nonNegativeInteger = (defaultValue: number) =>
  z.coerce.number().int().nonnegative().default(defaultValue);
const brokersSchema = nonEmptyString
  .transform((brokers) =>
    brokers
      .split(',')
      .map((broker) => broker.trim())
      .filter(Boolean),
  )
  .pipe(z.array(nonEmptyString).min(1));

export const envSchema = z
  .object({
    NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
    KAFKA_BROKERS: brokersSchema,
    KAFKA_CLIENT_ID: nonEmptyString,
    KAFKA_GROUP_ID_ANTI_FRAUD: nonEmptyString,
    KAFKA_CONNECTION_TIMEOUT_MS: positiveInteger(DEFAULT_CONNECTION_TIMEOUT_MS),
    KAFKA_REQUEST_TIMEOUT_MS: positiveInteger(DEFAULT_REQUEST_TIMEOUT_MS),
    KAFKA_RETRY_INITIAL_TIME_MS: positiveInteger(DEFAULT_RETRY_INITIAL_TIME_MS),
    KAFKA_RETRY_COUNT: nonNegativeInteger(DEFAULT_RETRY_COUNT),
    KAFKA_SESSION_TIMEOUT_MS: positiveInteger(DEFAULT_SESSION_TIMEOUT_MS),
    KAFKA_CONSUMER_MAX_ATTEMPTS: z.coerce
      .number()
      .int()
      .positive()
      .max(MAX_CONSUMER_ATTEMPTS)
      .default(DEFAULT_CONSUMER_MAX_ATTEMPTS),
    KAFKA_CONSUMER_RETRY_DELAY_MS: positiveInteger(DEFAULT_CONSUMER_RETRY_DELAY_MS),
  })
  .refine((env) => env.KAFKA_CONSUMER_RETRY_DELAY_MS < env.KAFKA_SESSION_TIMEOUT_MS, {
    path: ['KAFKA_CONSUMER_RETRY_DELAY_MS'],
    message: 'must be shorter than KAFKA_SESSION_TIMEOUT_MS',
  });

export type Env = z.infer<typeof envSchema>;
