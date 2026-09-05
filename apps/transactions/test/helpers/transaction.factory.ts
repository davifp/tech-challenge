import { randomUUID } from 'node:crypto';

import { type Transaction as TransactionRecord } from '../../src/generated/prisma/client';

import { prismaTest } from './prisma-test';

const DEFAULT_TRANSFER_TYPE_ID = 1;
const DEFAULT_STATUS_ID = 1;
const DEFAULT_VALUE = 100.5;

export type TransactionOverrides = Partial<{
  transactionExternalId: string;
  transactionStatusId: number;
  transferTypeId: number;
  createdAt: Date;
  value: number | string;
  accountExternalIdDebit: string;
  accountExternalIdCredit: string;
  idempotencyKey: string;
  bodyHash: string;
}>;

export function createTransaction(
  overrides: TransactionOverrides = {},
): Promise<TransactionRecord> {
  return prismaTest.transaction.create({
    data: {
      ...(overrides.transactionExternalId && {
        transactionExternalId: overrides.transactionExternalId,
      }),
      accountExternalIdDebit: overrides.accountExternalIdDebit ?? randomUUID(),
      accountExternalIdCredit: overrides.accountExternalIdCredit ?? randomUUID(),
      value: overrides.value ?? DEFAULT_VALUE,
      transferTypeId: overrides.transferTypeId ?? DEFAULT_TRANSFER_TYPE_ID,
      transactionStatusId: overrides.transactionStatusId ?? DEFAULT_STATUS_ID,
      ...(overrides.createdAt && { createdAt: overrides.createdAt }),
      ...(overrides.idempotencyKey && { idempotencyKey: overrides.idempotencyKey }),
      ...(overrides.bodyHash && { bodyHash: overrides.bodyHash }),
    },
  });
}
