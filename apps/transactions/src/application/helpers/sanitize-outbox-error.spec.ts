import { describe, expect, it } from 'vitest';

import { sanitizeOutboxError } from './sanitize-outbox-error';

describe('sanitizeOutboxError', () => {
  it('removes credentials and control whitespace from error messages', () => {
    const error = new Error('failed postgresql://user:secret@db:5432/name\nnext attempt');
    expect(sanitizeOutboxError(error)).toEqual({
      code: 'Error',
      message: 'failed postgresql://[redacted]@db:5432/name next attempt',
    });
  });
});
