import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { createAndObserveTransaction } from '../helpers/full-kafka-flow';
import { duplicateBothEventDirections } from '../helpers/full-kafka-flow-duplicates';
import {
  createFullKafkaFlowContext,
  type FullKafkaFlowContext,
} from '../helpers/full-kafka-flow.context';

describe('complete anti-fraud cycle with PostgreSQL and Kafka', () => {
  let context: FullKafkaFlowContext;

  beforeAll(async () => {
    context = await createFullKafkaFlowContext();
  }, 30000);

  afterAll(async () => {
    await context?.close();
  }, 30000);

  it.each([999.99, 1000])(
    'E2E-01 approves value %s and exposes both correlated events',
    async (value) => {
      const cycle = await createAndObserveTransaction(context, value, 'approved');
      expect(cycle.transaction.value).toBe(value);
      expect(cycle.createdRecord.key).toBe(cycle.transactionExternalId);
      expect(cycle.statusRecord.key).toBe(cycle.transactionExternalId);
    },
  );

  it('E2E-02 rejects a value above the anti-fraud limit', async () => {
    const cycle = await createAndObserveTransaction(context, 1000.01, 'rejected');
    expect(cycle.transaction.transactionStatus.name).toBe('rejected');
  });

  it('E2E-03 keeps one effect when both event directions are duplicated', async () => {
    const cycle = await createAndObserveTransaction(context, 500, 'approved');
    await duplicateBothEventDirections(context, cycle);
  });
});
