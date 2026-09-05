import '../helpers/load-env';
import { spawnSync } from 'node:child_process';

import { PrismaPg } from '@prisma/adapter-pg';

import { seedCatalogs } from '../../prisma/seed-catalogs';
import { PrismaClient } from '../../src/generated/prisma/client';

const PRISMA_CLI = 'prisma';
const MIGRATE_RESET_ARGS = ['migrate', 'reset', '--force', '--config', 'prisma.test.config.ts'];

function ensureTestDatabaseUrl(): string {
  const url = process.env.DATABASE_URL_TEST;
  if (!url) {
    throw new Error('DATABASE_URL_TEST is required to run integration tests');
  }
  return url;
}

function runMigrateReset(): void {
  const result = spawnSync(PRISMA_CLI, MIGRATE_RESET_ARGS, {
    stdio: 'inherit',
    env: process.env,
  });
  if (result.status !== 0) {
    throw new Error(`prisma migrate reset failed with exit code ${result.status ?? 'unknown'}`);
  }
}

async function seedTestCatalogs(connectionString: string): Promise<void> {
  const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString }) });
  try {
    await seedCatalogs(prisma);
  } finally {
    await prisma.$disconnect();
  }
}

export async function setup(): Promise<void> {
  const connectionString = ensureTestDatabaseUrl();
  runMigrateReset();
  await seedTestCatalogs(connectionString);
}

export function teardown(): void {}
