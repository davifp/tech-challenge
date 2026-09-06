import { describe, expect, it } from 'vitest';

import { decideTerminalStatusTransition } from './terminal-status-transition.policy';
import { APPROVED_STATUS_ID, PENDING_STATUS_ID, REJECTED_STATUS_ID } from './transaction-status';

const FINAL_STATUS_IDS = [APPROVED_STATUS_ID, REJECTED_STATUS_ID] as const;

describe('terminal transaction status transition', () => {
  it.each(FINAL_STATUS_IDS)(
    'allows a pending transaction to transition to final status %s',
    (requestedStatusId) => {
      expect(decideTerminalStatusTransition(PENDING_STATUS_ID, requestedStatusId)).toBe('apply');
    },
  );

  it.each(FINAL_STATUS_IDS)('treats final status %s reapplied as a duplicate', (statusId) => {
    expect(decideTerminalStatusTransition(statusId, statusId)).toBe('duplicate');
  });

  it('rejects an attempt to replace an approved decision with rejection', () => {
    expect(decideTerminalStatusTransition(APPROVED_STATUS_ID, REJECTED_STATUS_ID)).toBe('conflict');
  });

  it('rejects an attempt to replace a rejected decision with approval', () => {
    expect(decideTerminalStatusTransition(REJECTED_STATUS_ID, APPROVED_STATUS_ID)).toBe('conflict');
  });
});
