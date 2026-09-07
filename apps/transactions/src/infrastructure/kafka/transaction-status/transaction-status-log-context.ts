import { type TransactionStatusUpdatedV1 } from '@tech-challenge/event-contracts';

import { type KafkaRecord } from '../shared/kafka-record';

type EventLogContextInput = {
  record: KafkaRecord;
  event: TransactionStatusUpdatedV1;
  attempt: number;
};

export function transactionStatusEventContext(input: EventLogContextInput) {
  return {
    eventName: input.event.eventName,
    eventId: input.event.eventId,
    transactionExternalId: input.event.data.transactionExternalId,
    correlationId: input.event.correlationId,
    topic: input.record.topic,
    partition: input.record.partition,
    offset: input.record.offset,
    attempt: input.attempt,
  };
}
