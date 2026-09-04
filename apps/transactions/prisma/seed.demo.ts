import { randomUUID } from 'node:crypto';

import { PrismaPg } from '@prisma/adapter-pg';

import { PrismaClient, type Prisma } from '../src/generated/prisma/client';

const DEMO_ENV = 'development';
const DEMO_TRANSACTION_COUNT = 25;
const TRANSFER_TYPE_ID = 1;
const PENDING_STATUS_ID = 1;
const APPROVED_STATUS_ID = 2;
const REJECTED_STATUS_ID = 3;
const DECIMAL_SCALE = 2;
const DEMO_VALUES = [12.5, 199.9, 850, 1500.75, 4999.99, 32.4, 780.5, 12000] as const;
const MILLIS_PER_DAY = 86_400_000;

function pickStatus(index: number): number {
  if (index % 3 === 0) return APPROVED_STATUS_ID;
  if (index % 3 === 1) return REJECTED_STATUS_ID;
  return PENDING_STATUS_ID;
}

function buildDemoTransaction(index: number): Prisma.TransactionCreateInput {
  const value = DEMO_VALUES[index % DEMO_VALUES.length];
  const daysAgo = index % 30;
  const createdAt = new Date(Date.now() - daysAgo * MILLIS_PER_DAY);
  return {
    accountExternalIdDebit: randomUUID(),
    accountExternalIdCredit: randomUUID(),
    value: value.toFixed(DECIMAL_SCALE),
    transferType: { connect: { id: TRANSFER_TYPE_ID } },
    transactionStatus: { connect: { id: pickStatus(index) } },
    createdAt,
    // Override @updatedAt so historical demo rows do not look freshly touched.
    updatedAt: createdAt,
  };
}

function createPrisma(): PrismaClient {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error('DATABASE_URL is required to run the demo seed');
  }
  const adapter = new PrismaPg({ connectionString });
  return new PrismaClient({ adapter });
}

async function seedDemoTransactions(prisma: PrismaClient): Promise<void> {
  for (let index = 0; index < DEMO_TRANSACTION_COUNT; index += 1) {
    await prisma.transaction.create({ data: buildDemoTransaction(index) });
  }
}

async function main(): Promise<void> {
  if (process.env.NODE_ENV !== DEMO_ENV) {
    throw new Error(`seed.demo requires NODE_ENV=${DEMO_ENV}`);
  }
  const prisma = createPrisma();
  try {
    await seedDemoTransactions(prisma);
  } finally {
    await prisma.$disconnect();
  }
}

void main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
