import { afterAll, beforeEach } from 'vitest';

import { prismaTest } from '../helpers/prisma-test';

const RESET_PERSISTED_TRANSACTIONS =
  'TRUNCATE TABLE "InboxEvent", "OutboxEvent", "Transaction" RESTART IDENTITY CASCADE';

beforeEach(async () => {
  await prismaTest.$executeRawUnsafe(RESET_PERSISTED_TRANSACTIONS);
});

afterAll(async () => {
  await prismaTest.$disconnect();
});
