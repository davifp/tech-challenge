import { z } from 'zod';

export const INTEGRATION_EVENT_VERSION = 1 as const;

export const integrationEventV1Fields = {
  eventId: z.uuid(),
  version: z.literal(INTEGRATION_EVENT_VERSION),
  correlationId: z.uuid(),
  causationId: z.uuid().nullable(),
};
