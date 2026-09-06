import { describe, expect, it } from 'vitest';

import {
  apiErrorMessage,
  apiFieldErrorMessage,
  formatCurrency,
  formatDateTime,
  transactionStatusLabel,
  transactionTypeLabel,
} from './presentation';

describe('web/presentation', () => {
  it('traduz status, tipo e valor para português do Brasil', () => {
    expect(transactionStatusLabel('pending')).toBe('Pendente');
    expect(transactionStatusLabel('approved')).toBe('Aprovada');
    expect(transactionStatusLabel('rejected')).toBe('Rejeitada');
    expect(transactionTypeLabel('transfer')).toBe('Transferência');
    expect(formatCurrency(1000.01)).toBe('R$\u00a01.000,01');
  });

  it('apresenta o instante no Horário de Brasília', () => {
    expect(formatDateTime('2026-09-06T03:00:00.000Z')).toMatch(/^06\/09\/2026,? 00:00$/);
  });

  it('usa orientação segura para códigos e campos desconhecidos', () => {
    expect(apiErrorMessage('UNKNOWN_ERROR')).toBe(
      'Não foi possível concluir a operação. Tente novamente.',
    );
    expect(apiFieldErrorMessage({ path: 'unknown', message: 'raw external message' })).toBe(
      'Um campo informado não é válido. Revise o formulário e tente novamente.',
    );
    expect(transactionStatusLabel('unknown')).toBe('Status desconhecido');
    expect(transactionTypeLabel('unknown')).toBe('Tipo desconhecido');
  });

  it('traduz erros conhecidos sem expor a mensagem externa', () => {
    expect(apiErrorMessage('TRANSACTION_NOT_FOUND')).toBe(
      'A transação informada não foi encontrada.',
    );
    expect(apiFieldErrorMessage({ path: 'value', message: 'must be positive' })).toBe(
      'Informe um valor positivo com até duas casas decimais.',
    );
  });
});
