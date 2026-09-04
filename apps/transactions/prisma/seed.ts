import { PrismaPg } from '@prisma/adapter-pg';

import { PrismaClient } from '../src/generated/prisma/client';

const TRANSACTION_STATUSES = [
  { id: 1, name: 'pending' },
  { id: 2, name: 'approved' },
  { id: 3, name: 'rejected' },
] as const;

const TRANSACTION_TYPES = [{ id: 1, name: 'transfer' }] as const;

function createPrisma(): PrismaClient {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error('DATABASE_URL is required to run the seed');
  }
  const adapter = new PrismaPg({ connectionString });
  return new PrismaClient({ adapter });
}

async function seedCatalogs(prisma: PrismaClient): Promise<void> {
  for (const status of TRANSACTION_STATUSES) {
    await prisma.transactionStatus.upsert({
      where: { id: status.id },
      update: { name: status.name },
      create: status,
    });
  }
  for (const type of TRANSACTION_TYPES) {
    await prisma.transactionType.upsert({
      where: { id: type.id },
      update: { name: type.name },
      create: type,
    });
  }
}

async function main(): Promise<void> {
  const prisma = createPrisma();
  try {
    await seedCatalogs(prisma);
  } finally {
    await prisma.$disconnect();
  }
}

void main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
