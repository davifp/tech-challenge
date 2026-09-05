import { validate as isUuid, version as uuidVersion } from 'uuid';
import { describe, expect, it } from 'vitest';

import {
  createTransactionStatusEventId,
  deadLetterTopicFor,
  failedKafkaMessageV1Schema,
  integrationEventV1Schema,
  transactionCreatedV1Schema,
  transactionStatusUpdatedV1Schema,
  TRANSACTION_CREATED_TOPIC,
  TRANSACTION_STATUS_UPDATED_TOPIC,
} from './index';

const TRANSACTION_ID = '0199f9c2-1a2b-7c8d-9e0f-1234567890ab';
const CREATED_EVENT_ID = '0199f9c3-4a2b-7c8d-9e0f-1234567890ab';

function transactionCreated(value = 1000): Record<string, unknown> {
  return {
    eventId: CREATED_EVENT_ID,
    eventName: TRANSACTION_CREATED_TOPIC,
    version: 1,
    correlationId: TRANSACTION_ID,
    causationId: null,
    data: { transactionExternalId: TRANSACTION_ID, value },
  };
}

function transactionStatusUpdated(): Record<string, unknown> {
  return {
    eventId: createTransactionStatusEventId(CREATED_EVENT_ID),
    eventName: TRANSACTION_STATUS_UPDATED_TOPIC,
    version: 1,
    correlationId: TRANSACTION_ID,
    causationId: CREATED_EVENT_ID,
    data: { transactionExternalId: TRANSACTION_ID, status: 'approved' },
  };
}

describe('shared event contracts', () => {
  it('accepts both versioned integration events', () => {
    expect(integrationEventV1Schema.safeParse(transactionCreated()).success).toBe(true);
    expect(integrationEventV1Schema.safeParse(transactionStatusUpdated()).success).toBe(true);
  });

  it('rejects incompatible event envelopes and payloads', () => {
    expect(transactionCreatedV1Schema.safeParse(transactionCreated(1000.001)).success).toBe(false);
    expect(
      transactionCreatedV1Schema.safeParse({ ...transactionCreated(), extra: true }).success,
    ).toBe(false);
    expect(
      transactionStatusUpdatedV1Schema.safeParse({
        ...transactionStatusUpdated(),
        data: { transactionExternalId: TRANSACTION_ID, status: 'pending' },
      }).success,
    ).toBe(false);
  });

  it('derives the same UUID v5 for the same creation event', () => {
    const firstDecisionId = createTransactionStatusEventId(CREATED_EVENT_ID);
    const secondDecisionId = createTransactionStatusEventId(CREATED_EVENT_ID);
    expect(secondDecisionId).toBe(firstDecisionId);
    expect(isUuid(firstDecisionId)).toBe(true);
    expect(uuidVersion(firstDecisionId)).toBe(5);
  });

  it('derives source-specific dead-letter topics', () => {
    expect(deadLetterTopicFor(TRANSACTION_CREATED_TOPIC)).toBe('transaction.created.dlq');
    expect(deadLetterTopicFor(TRANSACTION_STATUS_UPDATED_TOPIC)).toBe(
      'transaction.status.updated.dlq',
    );
  });

  it('validates recoverable dead-letter messages', () => {
    const failedMessage = {
      version: 1,
      sourceTopic: TRANSACTION_CREATED_TOPIC,
      partition: 0,
      offset: '42',
      originalKey: TRANSACTION_ID,
      originalValue: JSON.stringify(transactionCreated()),
      attempts: 3,
      failedAt: '2026-09-05T14:00:00.000Z',
      error: { code: 'INVALID_EVENT', message: 'Event contract is invalid' },
    };
    expect(failedKafkaMessageV1Schema.safeParse(failedMessage).success).toBe(true);
    expect(failedKafkaMessageV1Schema.safeParse({ ...failedMessage, attempts: 0 }).success).toBe(
      false,
    );
  });
});
