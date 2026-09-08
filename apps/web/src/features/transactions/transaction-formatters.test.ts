import { describe, expect, it } from 'vitest';

import { formatCurrency, formatDateTime } from './transaction-formatters';

describe('web/transaction-formatters', () => {
  it('formata valores em reais', () => {
    expect(formatCurrency(1000.01)).toBe('R$\u00a01.000,01');
  });

  it('apresenta o instante no Horário de Brasília', () => {
    expect(formatDateTime('2026-09-06T03:00:00.000Z')).toMatch(/^06\/09\/2026,? 00:00$/);
  });
});
