import { TRANSACTION_STATUS_UPDATED_TOPIC } from '@tech-challenge/event-contracts';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { APPROVED_STATUS_ID } from '../../src/domain/transaction/transaction-status';
import { nextOffset } from '../../src/infrastructure/kafka/kafka-record';
import { prismaTest } from '../helpers/prisma-test';
import { createPendingDecisionTarget } from '../helpers/transaction-decision.fixtures';
import { transactionStatusEvent } from '../helpers/transaction-status-event.fixture';
import { createTransactionStatusKafkaTestContext } from '../helpers/transaction-status-kafka-test-context';

describe('transaction status Kafka flow', () => {
  let context: Awaited<ReturnType<typeof createTransactionStatusKafkaTestContext>>;

  beforeAll(async () => {
    context = await createTransactionStatusKafkaTestContext();
  });

  afterAll(async () => {
    await context.close();
  });

  it('applies one decision and treats its repeated delivery as a no-op', async () => {
    const transaction = await createPendingDecisionTarget();
    const event = transactionStatusEvent({
      transactionExternalId: transaction.transactionExternalId,
      status: 'approved',
    });
    const first = await context.harness.publish(
      TRANSACTION_STATUS_UPDATED_TOPIC,
      transaction.transactionExternalId,
      JSON.stringify(event),
    );
    await expect
      .poll(() => committedOffset(context, first.partition))
      .toBe(nextOffset(first.baseOffset));
    const applied = await prismaTest.transaction.findUniqueOrThrow({
      where: { transactionExternalId: transaction.transactionExternalId },
    });
    expect(applied.transactionStatusId).toBe(APPROVED_STATUS_ID);
    const repeated = await context.harness.publish(
      TRANSACTION_STATUS_UPDATED_TOPIC,
      transaction.transactionExternalId,
      JSON.stringify(event),
    );
    await expect
      .poll(() => committedOffset(context, repeated.partition))
      .toBe(nextOffset(repeated.baseOffset));
    const duplicated = await prismaTest.transaction.findUniqueOrThrow({
      where: { transactionExternalId: transaction.transactionExternalId },
    });
    expect(duplicated.updatedAt).toEqual(applied.updatedAt);
    await expect(prismaTest.inboxEvent.count({ where: { eventId: event.eventId } })).resolves.toBe(
      1,
    );
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
