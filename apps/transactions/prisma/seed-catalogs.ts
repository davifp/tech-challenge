import { type PrismaClient } from '../src/generated/prisma/client';

export const TRANSACTION_STATUSES = [
  { id: 1, name: 'pending' },
  { id: 2, name: 'approved' },
  { id: 3, name: 'rejected' },
] as const;

export const TRANSACTION_TYPES = [
  { id: 1, name: 'pix' },
  { id: 2, name: 'ted' },
  { id: 3, name: 'book_transfer' },
] as const;

export async function seedCatalogs(prisma: PrismaClient): Promise<void> {
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
