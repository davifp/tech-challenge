import { type TransactionCreatedV1 } from '@tech-challenge/event-contracts';

import { type Prisma } from '../../../generated/prisma/client';

export function toOutboxEventCreateInput(
  event: TransactionCreatedV1,
): Prisma.OutboxEventUncheckedCreateInput {
  return {
    eventId: event.eventId,
    aggregateId: event.data.transactionExternalId,
    eventName: event.eventName,
    payload: {
      eventId: event.eventId,
      eventName: event.eventName,
      version: event.version,
      correlationId: event.correlationId,
      causationId: event.causationId,
      data: {
        transactionExternalId: event.data.transactionExternalId,
        value: event.data.value,
      },
    },
  };
}
