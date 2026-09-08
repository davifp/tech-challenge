import { describe, expect, it } from 'vitest';

import { apiErrorMessage, apiFieldErrorMessage } from './transaction-error-messages';

describe('web/transaction-error-messages', () => {
  it('traduz erros conhecidos sem expor a mensagem externa', () => {
    expect(apiErrorMessage('TRANSACTION_NOT_FOUND')).toBe(
      'A transação informada não foi encontrada.',
    );
    expect(apiFieldErrorMessage({ path: 'value', message: 'must be positive' })).toBe(
      'Informe um valor positivo com até duas casas decimais.',
    );
  });

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

  it('usa orientação segura para códigos e campos desconhecidos', () => {
    expect(apiErrorMessage('UNKNOWN_ERROR')).toBe(
      'Não foi possível concluir a operação. Tente novamente.',
    );
    expect(apiFieldErrorMessage({ path: 'unknown', message: 'raw external message' })).toBe(
      'Um campo informado não é válido. Revise o formulário e tente novamente.',
    );
  });
});
