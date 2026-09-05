import { describe, expect, it } from 'vitest';

import { Prisma } from '../../generated/prisma/client';

import { isPrismaUniqueConflictOn } from './prisma-unique-conflict';

const CLIENT_VERSION = '7.10.0';

function driverUniqueError(index: string): unknown {
  return new Prisma.PrismaClientKnownRequestError('Unique constraint failed', {
    code: 'P2002',
    clientVersion: CLIENT_VERSION,
    meta: {
      driverAdapterError: {
        name: 'DriverAdapterError',
        cause: {
          kind: 'UniqueConstraintViolation',
          constraint: { index },
        },
      },
    },
  });
}

describe('isPrismaUniqueConflictOn', () => {
  it('recognizes the metadata emitted by the PostgreSQL driver adapter', () => {
    const error = driverUniqueError('Transaction_idempotencyKey_key');
    expect(isPrismaUniqueConflictOn(error, 'idempotencyKey')).toBe(true);
  });

  it('does not accept a constraint for another column', () => {
    const error = driverUniqueError('Transaction_pkey');
    expect(isPrismaUniqueConflictOn(error, 'idempotencyKey')).toBe(false);
  });
});
