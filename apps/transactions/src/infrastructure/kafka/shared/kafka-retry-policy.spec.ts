import { describe, expect, it } from 'vitest';

import { TransactionNotFoundError } from '../../../application/errors/transaction-not-found.error';

import { classifyKafkaFailure } from './kafka-retry-policy';
import { PermanentKafkaMessageError } from './permanent-kafka-message.error';

describe('TU-06 status consumer retry classification', () => {
  it('retries missing transactions and transient failures up to the limit', () => {
    const missingTransaction = new TransactionNotFoundError('0199f9c2-1a2b-7c8d-9e0f-1234567890ab');
    expect(classifyKafkaFailure(missingTransaction, 1, 3)).toBe('retry');
    expect(classifyKafkaFailure(new Error('database unavailable'), 2, 3)).toBe('retry');
    expect(classifyKafkaFailure(missingTransaction, 3, 3)).toBe('dead-letter');
  });

  it('sends permanent failures directly to dead letter', () => {
    const invalidEvent = new PermanentKafkaMessageError('INVALID_EVENT', 'invalid contract');
    expect(classifyKafkaFailure(invalidEvent, 1, 3)).toBe('dead-letter');
  });
});
