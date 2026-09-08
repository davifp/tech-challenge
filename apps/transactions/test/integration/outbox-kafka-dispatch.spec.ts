import { randomUUID } from 'node:crypto';

import { ConfigService } from '@nestjs/config';
import {
  transactionCreatedV1Schema,
  TRANSACTION_CREATED_TOPIC,
} from '@tech-challenge/event-contracts';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

import { createTransactionCreatedEvent } from '../../src/application/helpers/create-transaction-created-event';
import {
  EVENT_PUBLISHER,
  type EventPublisher,
} from '../../src/application/ports/event-publisher.port';
import {
  OUTBOX_DISPATCH_LOGGER,
  type OutboxDispatchLogger,
} from '../../src/application/ports/outbox-dispatch-logger.port';
import {
  OUTBOX_EVENT_REPOSITORY,
  type OutboxEventRepository,
} from '../../src/application/ports/outbox-event.repository.port';
import {
  TRANSACTION_EVENT_STORE,
  type TransactionEventStore,
} from '../../src/application/ports/transaction-event-store.port';
import { DispatchOutboxEventsUseCase } from '../../src/application/use-cases/dispatch-outbox-events.use-case';
import { Transaction } from '../../src/domain/transaction/transaction';
import { PENDING_STATUS_ID } from '../../src/domain/transaction/transaction-status';
import { PIX_TYPE_ID } from '../../src/domain/transaction/transaction-type';
import { type Env } from '../../src/infrastructure/config/env.schema';
import { KafkaEventProbe } from '../helpers/kafka-event.probe';
import { prismaTest } from '../helpers/prisma-test';
import { createTransactionsTestApp, type TransactionsTestApp } from '../helpers/test-app';

const DISPATCH_CONFIG = { batchSize: 10, retryBaseDelayMs: 1000, retryMaxDelayMs: 5000 };

describe('TI-03 durable outbox publication recovery', () => {
  let testApp: TransactionsTestApp;
  let eventStore: TransactionEventStore;
  let outbox: OutboxEventRepository;
  let publisher: EventPublisher;
  let logger: OutboxDispatchLogger;
  let probe: KafkaEventProbe;

  beforeAll(async () => {
    testApp = await createTransactionsTestApp();
    eventStore = testApp.app.get(TRANSACTION_EVENT_STORE);
    outbox = testApp.app.get(OUTBOX_EVENT_REPOSITORY);
    publisher = testApp.app.get(EVENT_PUBLISHER);
    logger = testApp.app.get(OUTBOX_DISPATCH_LOGGER);
    const config = testApp.app.get<ConfigService<Env, true>>(ConfigService);
    probe = new KafkaEventProbe({
      brokers: config.get('KAFKA_BROKERS', { infer: true }),
      clientId: `${config.get('KAFKA_CLIENT_ID', { infer: true })}-probe`,
    });
    await probe.start(TRANSACTION_CREATED_TOPIC);
  });

  afterAll(async () => {
    await probe.disconnect();
    await testApp.app.close();
  });

  it('persists a failed attempt and later publishes the same logical event', async () => {
    const transaction = Transaction.createPending({
      accountExternalIdDebit: randomUUID(),
      accountExternalIdCredit: randomUUID(),
      value: 120,
      transferTypeId: PIX_TYPE_ID,
    });
    const event = createTransactionCreatedEvent(transaction);
    await eventStore.savePending({ transaction, event });
    const unavailablePublisher: EventPublisher = {
      publish: vi.fn().mockRejectedValue(new Error('broker unavailable')),
    };
    const failingDispatch = new DispatchOutboxEventsUseCase(outbox, unavailablePublisher, logger);
    await failingDispatch.execute({ now: new Date(), ...DISPATCH_CONFIG });
    const retry = await prismaTest.outboxEvent.findUniqueOrThrow({
      where: { eventId: event.eventId },
    });
    expect(retry).toMatchObject({ attemptCount: 1, publishedAt: null });
    expect(retry.lastError).toBe(JSON.stringify({ code: 'Error', message: 'broker unavailable' }));
    const messagePromise = probe.waitForKey(transaction.transactionExternalId);
    const recoveredDispatch = new DispatchOutboxEventsUseCase(outbox, publisher, logger);
    await recoveredDispatch.execute({ now: retry.nextAttemptAt, ...DISPATCH_CONFIG });
    const message = await messagePromise;
    const publishedEvent = transactionCreatedV1Schema.parse(JSON.parse(message.value) as unknown);
    expect(message.key).toBe(transaction.transactionExternalId);
    expect(publishedEvent).toEqual(event);
    const persisted = await prismaTest.outboxEvent.findUniqueOrThrow({
      where: { eventId: event.eventId },
    });
    expect(persisted.publishedAt).toEqual(retry.nextAttemptAt);
    expect(persisted.lastError).toBeNull();
    expect(transaction.transactionStatusId).toBe(PENDING_STATUS_ID);
  });
});
