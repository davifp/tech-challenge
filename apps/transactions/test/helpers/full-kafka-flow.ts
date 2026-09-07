import {
  transactionCreatedV1Schema,
  transactionStatusUpdatedV1Schema,
  TRANSACTION_CREATED_TOPIC,
  TRANSACTION_STATUS_UPDATED_TOPIC,
  type TransactionStatusUpdatedV1,
} from '@tech-challenge/event-contracts';
import { expect } from 'vitest';

import { nextOffset } from '../../src/infrastructure/kafka/shared/kafka-record';

import { type FullKafkaFlowContext } from './full-kafka-flow.context';
import { responseBody, type TransactionResponseBody } from './http-contracts';
import { type ProbedKafkaMessage } from './kafka-event.probe';
import {
  buildTransactionBody,
  getTransaction,
  postTransaction,
  transactionExternalId,
} from './transactions-http';

export type ObservedTransactionCycle = {
  transactionExternalId: string;
  createdRecord: ProbedKafkaMessage;
  statusRecord: ProbedKafkaMessage;
  decision: TransactionStatusUpdatedV1;
  transaction: TransactionResponseBody;
};

export async function createAndObserveTransaction(
  context: FullKafkaFlowContext,
  value: number,
  expectedStatus: 'approved' | 'rejected',
): Promise<ObservedTransactionCycle> {
  const response = await postTransaction(context.app, buildTransactionBody(value)).expect(201);
  const initial = responseBody<TransactionResponseBody>(response);
  expect(initial.transactionStatus.name).toBe('pending');
  const externalId = transactionExternalId(response);
  const createdRecord = await context.probe.waitFor(TRANSACTION_CREATED_TOPIC, externalId);
  const statusRecord = await context.probe.waitFor(TRANSACTION_STATUS_UPDATED_TOPIC, externalId);
  const transaction = await waitForFinalStatus(context, externalId, expectedStatus);
  await waitForStatusCommit(context, statusRecord);
  const created = transactionCreatedV1Schema.parse(JSON.parse(createdRecord.value) as unknown);
  const decision = transactionStatusUpdatedV1Schema.parse(
    JSON.parse(statusRecord.value) as unknown,
  );
  expect(created.correlationId).toBe(externalId);
  expect(decision).toMatchObject({ correlationId: externalId, causationId: created.eventId });
  expect(decision.data).toEqual({ transactionExternalId: externalId, status: expectedStatus });
  return { transactionExternalId: externalId, createdRecord, statusRecord, decision, transaction };
}

export async function waitForStatusCommit(
  context: FullKafkaFlowContext,
  record: ProbedKafkaMessage,
): Promise<void> {
  await context.harness.waitForCommittedOffset({
    groupId: context.environment.transactionsGroupId,
    topic: record.topic,
    partition: record.partition,
    offset: nextOffset(record.offset),
  });
}

async function waitForFinalStatus(
  context: FullKafkaFlowContext,
  externalId: string,
  expectedStatus: 'approved' | 'rejected',
): Promise<TransactionResponseBody> {
  await expect
    .poll(
      async () => {
        const response = await getTransaction(context.app, externalId).expect(200);
        return responseBody<TransactionResponseBody>(response).transactionStatus.name;
      },
      { timeout: 10000, interval: 50 },
    )
    .toBe(expectedStatus);
  const response = await getTransaction(context.app, externalId).expect(200);
  return responseBody<TransactionResponseBody>(response);
}
