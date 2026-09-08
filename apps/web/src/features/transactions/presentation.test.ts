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
    expect(transactionTypeLabel('pix')).toBe('Pix');
    expect(transactionTypeLabel('ted')).toBe('TED');
    expect(transactionTypeLabel('book_transfer')).toBe('Book Transfer');
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

describe('web/presentation — TU-04 (recorte de criação)', () => {
  it('traduz erros de criação para português', () => {
    expect(apiErrorMessage('VALIDATION_ERROR')).toBe(
      'Revise os campos informados e tente novamente.',
    );
    expect(apiErrorMessage('TRANSFER_TYPE_NOT_FOUND')).toBe(
      'Selecione um tipo de transferência disponível.',
    );
    expect(apiErrorMessage('INVALID_TRANSACTION')).toBe(
      'Revise os dados da transação e tente novamente.',
    );
    expect(apiErrorMessage('IDEMPOTENCY_KEY_CONFLICT')).toBe(
      'Esta tentativa já foi usada com outros dados. Inicie uma nova tentativa.',
    );
    expect(apiErrorMessage('TIMEOUT')).toBe('A API demorou para responder. Tente novamente.');
  });

  it('traduz erros de campo de criação para português', () => {
    expect(apiFieldErrorMessage({ path: 'accountExternalIdDebit', message: 'raw' })).toBe(
      'Informe uma conta de débito válida.',
    );
    expect(apiFieldErrorMessage({ path: 'accountExternalIdCredit', message: 'raw' })).toBe(
      'Informe uma conta de crédito válida e diferente da conta de débito.',
    );
    expect(apiFieldErrorMessage({ path: 'transferTypeId', message: 'raw' })).toBe(
      'Selecione um tipo de transferência disponível.',
    );
  });

  it('retorna fallback em português para código desconhecido', () => {
    expect(apiErrorMessage('CODIGO_INEXISTENTE')).toBe(
      'Não foi possível concluir a operação. Tente novamente.',
    );
    expect(apiFieldErrorMessage({ path: 'campo_desconhecido', message: 'raw' })).toBe(
      'Um campo informado não é válido. Revise o formulário e tente novamente.',
    );
  });
});
