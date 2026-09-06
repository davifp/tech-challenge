import { z } from 'zod';

import { TRANSACTION_STATUS_UPDATED_TOPIC } from './event-topics';
import { integrationEventV1Fields } from './integration-event-v1.fields';

export const FINAL_TRANSACTION_STATUSES = ['approved', 'rejected'] as const;
export const finalTransactionStatusSchema = z.enum(FINAL_TRANSACTION_STATUSES);

export const transactionStatusUpdatedDataV1Schema = z.strictObject({
  transactionExternalId: z.uuid(),
  status: finalTransactionStatusSchema,
});

export const transactionStatusUpdatedV1Schema = z.strictObject({
  ...integrationEventV1Fields,
  eventName: z.literal(TRANSACTION_STATUS_UPDATED_TOPIC),
  causationId: z.uuid(),
  data: transactionStatusUpdatedDataV1Schema,
});

export type FinalTransactionStatus = z.infer<typeof finalTransactionStatusSchema>;
export type TransactionStatusUpdatedDataV1 = z.infer<typeof transactionStatusUpdatedDataV1Schema>;
export type TransactionStatusUpdatedV1 = z.infer<typeof transactionStatusUpdatedV1Schema>;
