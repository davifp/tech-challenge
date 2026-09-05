import './load-env';
import { PrismaPg } from '@prisma/adapter-pg';

import { PrismaClient } from '../../src/generated/prisma/client';

function createTestPrisma(): PrismaClient {
  const connectionString = process.env.DATABASE_URL_TEST;
  if (!connectionString) {
    throw new Error('DATABASE_URL_TEST is required for integration tests');
  }
  return new PrismaClient({ adapter: new PrismaPg({ connectionString }) });
}

export const prismaTest = createTestPrisma();
