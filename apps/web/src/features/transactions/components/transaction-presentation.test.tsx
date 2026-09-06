import { render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import type { TransactionResponse } from '../contracts';

import { FeedbackMessage } from './feedback-message';
import { TransactionPresentation } from './transaction-presentation';

const TRANSACTION: TransactionResponse = {
  transactionExternalId: '0199f9d2-1a2b-7c8d-9e0f-1234567890ab',
  transactionType: { name: 'transfer' },
  transactionStatus: { name: 'approved' },
  value: 1000.01,
  createdAt: '2026-09-06T03:00:00.000Z',
  updatedAt: '2026-09-06T03:00:00.000Z',
  accountExternalIdDebit: '0199f9c2-1a2b-7c8d-9e0f-1234567890ab',
  accountExternalIdCredit: '0299f9c2-1a2b-7c8d-9e0f-1234567890ab',
};

describe('web/TransactionPresentation', () => {
  it('apresenta rótulos, moeda, status e data com semântica', () => {
    const { container } = render(<TransactionPresentation transaction={TRANSACTION} />);
    const facts = container.querySelector('dl');
    expect(facts).not.toBeNull();
    expect(within(facts as HTMLElement).getByText('Transferência')).toBeInTheDocument();
    expect(within(facts as HTMLElement).getByText('R$ 1.000,01')).toBeInTheDocument();
    expect(within(facts as HTMLElement).getByText('Aprovada')).toBeInTheDocument();
    expect(within(facts as HTMLElement).getByText('Horário de Brasília')).toBeInTheDocument();
    expect(container.querySelector('time')).toHaveAttribute('datetime', TRANSACTION.createdAt);
  });

  it('comunica uma falha assíncrona como alerta', () => {
    render(
      <FeedbackMessage title="Falha na consulta" tone="error">
        Verifique a conexão e tente novamente.
      </FeedbackMessage>,
    );
    expect(screen.getByRole('alert', { name: 'Falha na consulta' })).toHaveTextContent(
      'Verifique a conexão e tente novamente.',
    );
  });
});
