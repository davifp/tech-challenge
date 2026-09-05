import { describe, expect, it } from 'vitest';

import { ANTI_FRAUD_APPROVAL_LIMIT, AntiFraudPolicy } from './anti-fraud-policy';

describe('AntiFraudPolicy', () => {
  const policy = new AntiFraudPolicy();

  it('approves a transaction below the limit', () => {
    expect(policy.decide(ANTI_FRAUD_APPROVAL_LIMIT - 0.01)).toBe('approved');
  });

  it('approves a transaction at the inclusive limit', () => {
    expect(policy.decide(ANTI_FRAUD_APPROVAL_LIMIT)).toBe('approved');
  });

  it('rejects a transaction above the limit', () => {
    expect(policy.decide(ANTI_FRAUD_APPROVAL_LIMIT + 0.01)).toBe('rejected');
  });
});
