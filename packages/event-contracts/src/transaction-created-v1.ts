import { z } from 'zod';

import { TRANSACTION_CREATED_TOPIC } from './event-topics';
import { integrationEventV1Fields } from './integration-event-v1.fields';
import { monetaryValueSchema } from './monetary-value.schema';

export const transactionCreatedDataV1Schema = z.strictObject({
  transactionExternalId: z.uuid(),
  value: monetaryValueSchema,
});

export const transactionCreatedV1Schema = z.strictObject({
  ...integrationEventV1Fields,
  eventName: z.literal(TRANSACTION_CREATED_TOPIC),
  causationId: z.null(),
  data: transactionCreatedDataV1Schema,
});

export type TransactionCreatedDataV1 = z.infer<typeof transactionCreatedDataV1Schema>;
export type TransactionCreatedV1 = z.infer<typeof transactionCreatedV1Schema>;
