import { describe, expect, it } from 'vitest';

import { classifyKafkaFailure } from './kafka-retry-policy';
import { PermanentKafkaMessageError } from './permanent-kafka-message.error';

describe('TU-06 Kafka retry classification', () => {
  it('retries transient failures until the configured attempt limit', () => {
    const transientError = new Error('broker unavailable');
    expect(classifyKafkaFailure(transientError, 1, 3)).toBe('retry');
    expect(classifyKafkaFailure(transientError, 2, 3)).toBe('retry');
    expect(classifyKafkaFailure(transientError, 3, 3)).toBe('dead-letter');
  });

  it('sends permanent failures directly to the dead letter topic', () => {
    const permanentError = new PermanentKafkaMessageError('INVALID_EVENT', 'invalid contract');
    expect(classifyKafkaFailure(permanentError, 1, 3)).toBe('dead-letter');
  });
});
