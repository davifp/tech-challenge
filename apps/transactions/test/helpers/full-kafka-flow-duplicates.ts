import {
  transactionStatusUpdatedV1Schema,
  TRANSACTION_CREATED_TOPIC,
  TRANSACTION_STATUS_UPDATED_TOPIC,
} from '@tech-challenge/event-contracts';
import { expect } from 'vitest';

import { type ObservedTransactionCycle, waitForStatusCommit } from './full-kafka-flow';
import { type FullKafkaFlowContext } from './full-kafka-flow.context';
import { prismaTest } from './prisma-test';

export async function duplicateBothEventDirections(
  context: FullKafkaFlowContext,
  cycle: ObservedTransactionCycle,
): Promise<void> {
  const persisted = await findTransaction(cycle.transactionExternalId);
  const repeatedDecision = await duplicateCreatedEvent(context, cycle);
  expect(repeatedDecision).toEqual(cycle.decision);
  await duplicateStatusEvent(context, cycle);
  const afterDuplicates = await findTransaction(cycle.transactionExternalId);
  expect(afterDuplicates.updatedAt).toEqual(persisted.updatedAt);
  await expect(prismaTest.transaction.count()).resolves.toBe(1);
  await expect(
    prismaTest.inboxEvent.count({ where: { eventId: cycle.decision.eventId } }),
  ).resolves.toBe(1);
}

async function duplicateCreatedEvent(
  context: FullKafkaFlowContext,
  cycle: ObservedTransactionCycle,
) {
  await context.harness.publish(
    TRANSACTION_CREATED_TOPIC,
    cycle.transactionExternalId,
    cycle.createdRecord.value,
  );
  const repeatedStatus = await context.probe.waitFor(
    TRANSACTION_STATUS_UPDATED_TOPIC,
    cycle.transactionExternalId,
    2,
  );
  await waitForStatusCommit(context, repeatedStatus);
  return transactionStatusUpdatedV1Schema.parse(JSON.parse(repeatedStatus.value) as unknown);
}

async function duplicateStatusEvent(
  context: FullKafkaFlowContext,
  cycle: ObservedTransactionCycle,
): Promise<void> {
  const metadata = await context.harness.publish(
    TRANSACTION_STATUS_UPDATED_TOPIC,
    cycle.transactionExternalId,
    cycle.statusRecord.value,
  );
  await context.harness.waitForCommittedOffset({
    groupId: context.environment.transactionsGroupId,
    topic: TRANSACTION_STATUS_UPDATED_TOPIC,
    partition: metadata.partition,
    offset: (BigInt(metadata.baseOffset) + 1n).toString(),
  });
}

function findTransaction(transactionExternalId: string) {
  return prismaTest.transaction.findUniqueOrThrow({ where: { transactionExternalId } });
}
