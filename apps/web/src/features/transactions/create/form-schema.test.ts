import { describe, expect, it } from 'vitest';

import { createTransactionFormSchema } from './form-schema';

const DEBIT_UUID = '0199f9c2-1a2b-7c8d-9e0f-100000000001';
const CREDIT_UUID = '0199f9c2-1a2b-7c8d-9e0f-200000000002';

function parse(input: Record<string, unknown>) {
  return createTransactionFormSchema.safeParse(input);
}

function validInput(overrides: Record<string, unknown> = {}) {
  return {
    accountExternalIdDebit: DEBIT_UUID,
    accountExternalIdCredit: CREDIT_UUID,
    transferTypeId: '1',
    value: '1000,01',
    ...overrides,
  };
}

describe('web/createTransactionFormSchema — transferTypeId', () => {
  it('aceita transferTypeId "1", "2" e "3" e converte para número', () => {
    for (const [raw, expected] of [
      ['1', 1],
      ['2', 2],
      ['3', 3],
    ] as const) {
      const result = parse(validInput({ transferTypeId: raw }));
      expect(result.success).toBe(true);
      if (result.success) expect(result.data.transferTypeId).toBe(expected);
    }
  });

  it('rejeita transferTypeId ausente', () => {
    const result = parse({
      accountExternalIdDebit: DEBIT_UUID,
      accountExternalIdCredit: CREDIT_UUID,
      value: '1000,01',
    });
    expect(result.success).toBe(false);
  });

  it('rejeita valor vazio', () => {
    expect(parse(validInput({ transferTypeId: '' })).success).toBe(false);
  });

  it('rejeita valor fora do conjunto {1,2,3}', () => {
    expect(parse(validInput({ transferTypeId: '4' })).success).toBe(false);
  });
});

describe('web/createTransactionFormSchema — TU-01', () => {
  describe('entrada monetária', () => {
    it('aceita formato com vírgula decimal simples', () => {
      const result = parse(validInput({ value: '1000,01' }));
      expect(result.success).toBe(true);
      if (result.success) expect(result.data.value).toBe(1000.01);
    });

    it('aceita formato com ponto como separador de milhar e vírgula decimal', () => {
      const result = parse(validInput({ value: '1.000,01' }));
      expect(result.success).toBe(true);
      if (result.success) expect(result.data.value).toBe(1000.01);
    });

    it('aceita inteiro sem decimais', () => {
      const result = parse(validInput({ value: '1000' }));
      expect(result.success).toBe(true);
      if (result.success) expect(result.data.value).toBe(1000);
    });

    it('aceita fração menor que um', () => {
      const result = parse(validInput({ value: '0,50' }));
      expect(result.success).toBe(true);
      if (result.success) expect(result.data.value).toBe(0.5);
    });

    it('preserva 1000,01 sem arredondamento', () => {
      const result = parse(validInput({ value: '1000,01' }));
      expect(result.success).toBe(true);
      if (result.success) expect(result.data.value).toBe(1000.01);
    });

    it('rejeita mais de duas casas decimais sem arredondamento', () => {
      expect(parse(validInput({ value: '1000,011' })).success).toBe(false);
    });

    it('rejeita valor zero', () => {
      expect(parse(validInput({ value: '0' })).success).toBe(false);
    });

    it('rejeita valor zero com casas decimais', () => {
      expect(parse(validInput({ value: '0,00' })).success).toBe(false);
    });

    it('rejeita valor negativo', () => {
      expect(parse(validInput({ value: '-100' })).success).toBe(false);
    });

    it('rejeita campo vazio', () => {
      expect(parse(validInput({ value: '' })).success).toBe(false);
    });

    it('rejeita texto não numérico', () => {
      expect(parse(validInput({ value: 'abc' })).success).toBe(false);
    });
  });

  describe('contas UUID', () => {
    it('aceita UUIDs válidos e distintos', () => {
      const result = parse(validInput());
      expect(result.success).toBe(true);
    });

    it('normaliza UUIDs para minúsculas', () => {
      const result = parse(
        validInput({
          accountExternalIdDebit: DEBIT_UUID.toUpperCase(),
          accountExternalIdCredit: CREDIT_UUID.toUpperCase(),
        }),
      );
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.accountExternalIdDebit).toBe(DEBIT_UUID.toLowerCase());
        expect(result.data.accountExternalIdCredit).toBe(CREDIT_UUID.toLowerCase());
      }
    });

    it('rejeita UUIDs iguais após normalização para minúsculas', () => {
      const result = parse(
        validInput({
          accountExternalIdDebit: DEBIT_UUID.toUpperCase(),
          accountExternalIdCredit: DEBIT_UUID.toLowerCase(),
        }),
      );
      expect(result.success).toBe(false);
    });

    it('rejeita UUID inválido na conta de débito', () => {
      expect(parse(validInput({ accountExternalIdDebit: 'nao-e-um-uuid' })).success).toBe(false);
    });

    it('rejeita UUID inválido na conta de crédito', () => {
      expect(parse(validInput({ accountExternalIdCredit: 'nao-e-um-uuid' })).success).toBe(false);
    });

    it('rejeita campo de débito vazio', () => {
      expect(parse(validInput({ accountExternalIdDebit: '' })).success).toBe(false);
    });
  });
});
