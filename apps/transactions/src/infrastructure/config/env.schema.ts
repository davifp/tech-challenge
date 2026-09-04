import { z } from 'zod';

const DEFAULT_TRANSACTIONS_PORT = 3001;
const MIN_PORT = 1;
const MAX_PORT = 65535;
const TEST_NODE_ENV = 'test';
const POSTGRES_PROTOCOL_PATTERN = /^postgres(ql)?$/;

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

export const envSchema = z
  .object({
    NODE_ENV: nodeEnvSchema,
    DATABASE_URL: postgresUrlSchema,
    DATABASE_URL_TEST: postgresUrlSchema.optional(),
    TRANSACTIONS_PORT: portSchema,
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
