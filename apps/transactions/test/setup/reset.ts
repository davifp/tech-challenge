import { afterAll, beforeEach } from 'vitest';

import { prismaTest } from '../helpers/prisma-test';

const TRUNCATE_TRANSACTION = 'TRUNCATE TABLE "Transaction" RESTART IDENTITY CASCADE';

beforeEach(async () => {
  await prismaTest.$executeRawUnsafe(TRUNCATE_TRANSACTION);
});

afterAll(async () => {
  await prismaTest.$disconnect();
});
