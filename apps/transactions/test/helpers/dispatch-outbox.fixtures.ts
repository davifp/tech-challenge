import { randomUUID } from 'node:crypto';

import {
  TRANSACTION_CREATED_TOPIC,
  type TransactionCreatedV1,
} from '@tech-challenge/event-contracts';
import { vi } from 'vitest';

import { type EventPublisher } from '../../src/application/ports/event-publisher.port';
import { type OutboxDispatchLogger } from '../../src/application/ports/outbox-dispatch-logger.port';
import { type OutboxEventRepository } from '../../src/application/ports/outbox-event.repository.port';

export function buildOutboxEvent(): TransactionCreatedV1 {
  const transactionExternalId = randomUUID();
  return {
    eventId: randomUUID(),
    eventName: TRANSACTION_CREATED_TOPIC,
    version: 1,
    correlationId: transactionExternalId,
    causationId: null,
    data: { transactionExternalId, value: 120 },
  };
}

export function buildOutboxDependencies(): {
  outbox: OutboxEventRepository;
  publisher: EventPublisher;
  logger: OutboxDispatchLogger;
} {
  return {
    outbox: {
      findDue: vi.fn().mockResolvedValue([]),
      markPublished: vi.fn().mockResolvedValue(undefined),
      scheduleRetry: vi.fn().mockResolvedValue(undefined),
    },
    publisher: {
      publish: vi.fn().mockResolvedValue({
        topic: TRANSACTION_CREATED_TOPIC,
        partition: 0,
        offset: '1',
      }),
    },
    logger: {
      published: vi.fn(),
      possibleDuplicate: vi.fn(),
      publicationFailed: vi.fn(),
      retryScheduled: vi.fn(),
      dispatcherFailed: vi.fn(),
    },
  };
}
