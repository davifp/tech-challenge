import { describe, expect, it } from 'vitest';

import { prismaTest } from '../helpers/prisma-test';

const EXPECTED_STATUSES = ['pending', 'approved', 'rejected'] as const;
const EXPECTED_TRANSFER_TYPE = 'transfer';
const INIT_MIGRATION_SUFFIX = '_init';

type MigrationRow = { migration_name: string; finished_at: Date | null };

describe('migrations and catalog seed', () => {
  it('applied the initial migration successfully', async () => {
    const rows = await prismaTest.$queryRawUnsafe<MigrationRow[]>(
      'SELECT migration_name, finished_at FROM "_prisma_migrations" ORDER BY started_at ASC',
    );
    expect(rows.length).toBeGreaterThan(0);
    const init = rows.find((row) => row.migration_name.endsWith(INIT_MIGRATION_SUFFIX));
    expect(init).toBeDefined();
    expect(init?.finished_at).not.toBeNull();
  });

  it('seeds TransactionStatus with pending, approved and rejected', async () => {
    const statuses = await prismaTest.transactionStatus.findMany({ orderBy: { id: 'asc' } });
    expect(statuses).toHaveLength(EXPECTED_STATUSES.length);
    expect(statuses.map((row) => row.name)).toEqual([...EXPECTED_STATUSES]);
  });

  it('seeds TransactionType with at least the transfer entry', async () => {
    const types = await prismaTest.transactionType.findMany({ orderBy: { id: 'asc' } });
    expect(types.length).toBeGreaterThanOrEqual(1);
    expect(types[0]).toMatchObject({ id: 1, name: EXPECTED_TRANSFER_TYPE });
  });
});
