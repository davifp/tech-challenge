import { describe, expect, it } from 'vitest';

import { hashBody, type HashableBody } from './hash-body';

const BASE_BODY: HashableBody = {
  accountExternalIdDebit: '5f9a8b1e-3c2d-4f6a-8e9b-1a2b3c4d5e6f',
  accountExternalIdCredit: 'aa11bb22-cc33-4d44-8e55-ff66aa77bb88',
  transferTypeId: 1,
  value: 120,
};

describe('hashBody', () => {
  it('is deterministic for the same body', () => {
    expect(hashBody(BASE_BODY)).toBe(hashBody(BASE_BODY));
  });

  it('normalizes numeric formatting (120 == 120.00)', () => {
    expect(hashBody({ ...BASE_BODY, value: 120 })).toBe(hashBody({ ...BASE_BODY, value: 120.0 }));
    expect(hashBody({ ...BASE_BODY, value: 120 })).toBe(hashBody({ ...BASE_BODY, value: 120.005 }));
  });

  it('changes when any semantic field changes', () => {
    const base = hashBody(BASE_BODY);
    expect(hashBody({ ...BASE_BODY, value: 121 })).not.toBe(base);
    expect(hashBody({ ...BASE_BODY, transferTypeId: 2 })).not.toBe(base);
    expect(hashBody({ ...BASE_BODY, accountExternalIdDebit: 'other' })).not.toBe(base);
    expect(hashBody({ ...BASE_BODY, accountExternalIdCredit: 'other' })).not.toBe(base);
  });

  it('produces a 64-character hex digest', () => {
    expect(hashBody(BASE_BODY)).toMatch(/^[0-9a-f]{64}$/);
  });
});
