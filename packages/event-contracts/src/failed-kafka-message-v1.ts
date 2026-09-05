import { z } from 'zod';

import { EVENT_TOPICS } from './event-topics';
import { INTEGRATION_EVENT_VERSION } from './integration-event-v1.fields';

export const failedKafkaMessageErrorV1Schema = z.strictObject({
  code: z.string().trim().min(1),
  message: z.string().trim().min(1),
});

export const failedKafkaMessageV1Schema = z.strictObject({
  version: z.literal(INTEGRATION_EVENT_VERSION),
  sourceTopic: z.enum(EVENT_TOPICS),
  partition: z.int().nonnegative(),
  offset: z.string().regex(/^\d+$/),
  originalKey: z.string().nullable(),
  originalValue: z.string(),
  attempts: z.int().positive(),
  failedAt: z.iso.datetime(),
  error: failedKafkaMessageErrorV1Schema,
});

export type FailedKafkaMessageErrorV1 = z.infer<typeof failedKafkaMessageErrorV1Schema>;
export type FailedKafkaMessageV1 = z.infer<typeof failedKafkaMessageV1Schema>;
