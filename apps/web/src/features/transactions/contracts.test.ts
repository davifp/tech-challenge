import { describe, expect, it } from 'vitest';

import { createTransactionInputSchema, transactionResponseSchema } from './contracts';

const TRANSACTION = {
  transactionExternalId: '0199f9d2-1a2b-7c8d-9e0f-1234567890ab',
  transactionType: { name: 'transfer' },
  transactionStatus: { name: 'pending' },
  value: 1000.01,
  createdAt: '2026-09-06T03:00:00.000Z',
  updatedAt: '2026-09-06T03:00:00.000Z',
  accountExternalIdDebit: '0199f9c2-1a2b-7c8d-9e0f-1234567890ab',
  accountExternalIdCredit: '0299f9c2-1a2b-7c8d-9e0f-1234567890ab',
};

describe('web/transactionContracts', () => {
  it('aceita uma resposta completa da API', () => {
    expect(transactionResponseSchema.parse(TRANSACTION)).toEqual(TRANSACTION);
  });

  it('rejeita enum desconhecido e resposta parcial', () => {
    expect(
      transactionResponseSchema.safeParse({
        ...TRANSACTION,
        transactionStatus: { name: 'processing' },
      }).success,
    ).toBe(false);
    expect(
      transactionResponseSchema.safeParse({
        transactionExternalId: TRANSACTION.transactionExternalId,
        transactionType: TRANSACTION.transactionType,
        transactionStatus: TRANSACTION.transactionStatus,
        value: TRANSACTION.value,
        createdAt: TRANSACTION.createdAt,
        accountExternalIdDebit: TRANSACTION.accountExternalIdDebit,
        accountExternalIdCredit: TRANSACTION.accountExternalIdCredit,
      }).success,
    ).toBe(false);
  });

  it('normaliza contas e rejeita contas iguais', () => {
    const input = {
      accountExternalIdDebit: '0199F9C2-1A2B-7C8D-9E0F-1234567890AB',
      accountExternalIdCredit: '0199F9C2-1A2B-7C8D-9E0F-1234567890AB',
      transferTypeId: 1,
      value: 1000.01,
    };
    expect(createTransactionInputSchema.safeParse(input).success).toBe(false);
  });
});
