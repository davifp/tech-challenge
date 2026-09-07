import { randomUUID } from 'node:crypto';

import {
  failedKafkaMessageV1Schema,
  TRANSACTION_STATUS_UPDATED_TOPIC,
} from '@tech-challenge/event-contracts';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { APPROVED_STATUS_ID } from '../../src/domain/transaction/transaction-status';
import { nextOffset } from '../../src/infrastructure/kafka/shared/kafka-record';
import { prismaTest } from '../helpers/prisma-test';
import { transactionStatusEvent } from '../helpers/transaction-status-event.fixture';
import { createTransactionStatusKafkaTestContext } from '../helpers/transaction-status-kafka-test-context';
import { createTransaction } from '../helpers/transaction.factory';

describe('TI-06 transaction status Kafka dead letter flow', () => {
  let context: Awaited<ReturnType<typeof createTransactionStatusKafkaTestContext>>;

  beforeAll(async () => {
    context = await createTransactionStatusKafkaTestContext();
  });

  afterAll(async () => {
    await context.close();
  });

  it('dead letters invalid input before committing the source offset', async () => {
    const key = randomUUID();
    const metadata = await context.harness.publish(
      TRANSACTION_STATUS_UPDATED_TOPIC,
      key,
      '{invalid-json',
    );
    const received = await context.probe.waitForKey(key);
    const failed = failedKafkaMessageV1Schema.parse(JSON.parse(received.value) as unknown);
    expect(failed).toMatchObject({ originalKey: key, originalValue: '{invalid-json', attempts: 1 });
    expect(failed.error.code).toBe('INVALID_EVENT');
    await expect
      .poll(() => committedOffset(context, metadata.partition))
      .toBe(nextOffset(metadata.baseOffset));
  });

  it('dead letters a conflicting decision and preserves the final state', async () => {
    const transaction = await createTransaction({ transactionStatusId: APPROVED_STATUS_ID });
    const event = transactionStatusEvent({
      transactionExternalId: transaction.transactionExternalId,
      status: 'rejected',
    });
    const metadata = await context.harness.publish(
      TRANSACTION_STATUS_UPDATED_TOPIC,
      transaction.transactionExternalId,
      JSON.stringify(event),
    );
    const received = await context.probe.waitForKey(transaction.transactionExternalId);
    const failed = failedKafkaMessageV1Schema.parse(JSON.parse(received.value) as unknown);
    expect(failed.error.code).toBe('TRANSACTION_DECISION_CONFLICT');
    await expect
      .poll(() => committedOffset(context, metadata.partition))
      .toBe(nextOffset(metadata.baseOffset));
    const persisted = await prismaTest.transaction.findUniqueOrThrow({
      where: { transactionExternalId: transaction.transactionExternalId },
    });
    expect(persisted.transactionStatusId).toBe(APPROVED_STATUS_ID);
    await expect(
      prismaTest.inboxEvent.findUnique({ where: { eventId: event.eventId } }),
    ).resolves.toBeNull();
  });
});

function committedOffset(
  context: Awaited<ReturnType<typeof createTransactionStatusKafkaTestContext>>,
  partition: number,
): Promise<string> {
  return context.harness.committedOffset(
    context.config.groupId,
    TRANSACTION_STATUS_UPDATED_TOPIC,
    partition,
  );
}
