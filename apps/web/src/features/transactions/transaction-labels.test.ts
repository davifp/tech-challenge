import { describe, expect, it } from 'vitest';

import { transactionStatusLabel, transactionTypeLabel } from './transaction-labels';

describe('web/transaction-labels', () => {
  it('traduz status e tipos de transação', () => {
    expect(transactionStatusLabel('pending')).toBe('Pendente');
    expect(transactionStatusLabel('approved')).toBe('Aprovada');
    expect(transactionStatusLabel('rejected')).toBe('Rejeitada');
    expect(transactionTypeLabel('pix')).toBe('Pix');
    expect(transactionTypeLabel('ted')).toBe('TED');
    expect(transactionTypeLabel('book_transfer')).toBe('Book Transfer');
  });

  it('usa labels seguras para valores desconhecidos', () => {
    expect(transactionStatusLabel('unknown')).toBe('Status desconhecido');
    expect(transactionTypeLabel('unknown')).toBe('Tipo desconhecido');
  });
});
