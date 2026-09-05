import { z } from 'zod';

import { transactionCreatedV1Schema } from './transaction-created-v1';
import { transactionStatusUpdatedV1Schema } from './transaction-status-updated-v1';

export const integrationEventV1Schema = z.discriminatedUnion('eventName', [
  transactionCreatedV1Schema,
  transactionStatusUpdatedV1Schema,
]);

export type IntegrationEventV1 = z.infer<typeof integrationEventV1Schema>;
