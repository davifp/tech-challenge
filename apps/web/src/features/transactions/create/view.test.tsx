import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type * as TransactionsApiModule from '../api/client';
import { TransactionsApiError } from '../api/client';
import type { TransactionResponse } from '../contracts';

const createSpy = vi.hoisted(() => vi.fn());
const pushSpy = vi.hoisted(() => vi.fn());

vi.mock('../api/client', async () => {
  const actual = await vi.importActual<typeof TransactionsApiModule>('../api/client');
  return {
    ...actual,
    transactionsApi: { list: vi.fn(), get: vi.fn(), create: createSpy },
  };
});

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: pushSpy }),
}));

import { CreateTransactionView } from './view';

const DEBIT_UUID = '0199f9c2-1a2b-7c8d-9e0f-100000000001';
const CREDIT_UUID = '0199f9c2-1a2b-7c8d-9e0f-200000000002';
const TX_ID = '0199f9d2-1a2b-7c8d-9e0f-aabbccdd1234';

function buildTransaction(overrides: Partial<TransactionResponse> = {}): TransactionResponse {
  return {
    transactionExternalId: TX_ID,
    transactionType: { name: 'transfer' },
    transactionStatus: { name: 'pending' },
    value: 1000,
    createdAt: '2026-09-07T03:00:00.000Z',
    updatedAt: '2026-09-07T03:00:00.000Z',
    accountExternalIdDebit: DEBIT_UUID,
    accountExternalIdCredit: CREDIT_UUID,
    ...overrides,
  };
}

function renderView() {
  const client = new QueryClient({ defaultOptions: { mutations: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <CreateTransactionView />
    </QueryClientProvider>,
  );
}

async function fillForm(
  user: ReturnType<typeof userEvent.setup>,
  overrides: Record<string, string> = {},
) {
  const debit = overrides.debit ?? DEBIT_UUID;
  const credit = overrides.credit ?? CREDIT_UUID;
  const value = overrides.value ?? '1000';
  await user.clear(screen.getByRole('textbox', { name: /conta de débito/i }));
  await user.type(screen.getByRole('textbox', { name: /conta de débito/i }), debit);
  await user.clear(screen.getByRole('textbox', { name: /conta de crédito/i }));
  await user.type(screen.getByRole('textbox', { name: /conta de crédito/i }), credit);
  await user.clear(screen.getByRole('textbox', { name: /valor/i }));
  await user.type(screen.getByRole('textbox', { name: /valor/i }), value);
}

beforeEach(() => {
  createSpy.mockReset();
  pushSpy.mockReset();
  sessionStorage.clear();
});

afterEach(() => {
  sessionStorage.clear();
});

describe('web/CreateTransactionView — TI-04', () => {
  it('apresenta erros nos campos sem chamar a API quando o formulário é inválido', async () => {
    const user = userEvent.setup();
    renderView();
    await user.click(screen.getByRole('button', { name: /criar transação/i }));
    expect(createSpy).not.toHaveBeenCalled();
    const alerts = await screen.findAllByRole('alert');
    expect(alerts.length).toBeGreaterThanOrEqual(1);
  });

  it('rejeita UUID inválido na conta de débito', async () => {
    const user = userEvent.setup();
    renderView();
    await fillForm(user, { debit: 'nao-e-uuid' });
    await user.click(screen.getByRole('button', { name: /criar transação/i }));
    expect(createSpy).not.toHaveBeenCalled();
    await screen.findByRole('alert');
  });

  it('rejeita contas iguais', async () => {
    const user = userEvent.setup();
    renderView();
    await fillForm(user, { debit: DEBIT_UUID, credit: DEBIT_UUID });
    await user.click(screen.getByRole('button', { name: /criar transação/i }));
    expect(createSpy).not.toHaveBeenCalled();
    const alerts = await screen.findAllByRole('alert');
    expect(alerts.some((a) => /diferentes/i.test(a.textContent ?? ''))).toBe(true);
  });

  it('rejeita valor com mais de duas casas decimais', async () => {
    const user = userEvent.setup();
    renderView();
    await fillForm(user, { value: '1000,011' });
    await user.click(screen.getByRole('button', { name: /criar transação/i }));
    expect(createSpy).not.toHaveBeenCalled();
    await screen.findByRole('alert');
  });

  it('envia os dados corretos com chave de idempotência ao submeter formulário válido', async () => {
    const user = userEvent.setup();
    createSpy.mockResolvedValue(buildTransaction());
    renderView();
    await fillForm(user);
    await user.click(screen.getByRole('button', { name: /criar transação/i }));
    await waitFor(() => expect(createSpy).toHaveBeenCalledOnce());
    const [attempt] = createSpy.mock.calls[0] as [{ key: string; body: Record<string, unknown> }];
    expect(attempt.key).toMatch(/^[0-9a-f-]{36}$/);
    expect(attempt.body.accountExternalIdDebit).toBe(DEBIT_UUID);
    expect(attempt.body.accountExternalIdCredit).toBe(CREDIT_UUID);
    expect(attempt.body.value).toBe(1000);
    expect(attempt.body.transferTypeId).toBe(1);
  });

  it('navega para o detalhe após criação bem-sucedida', async () => {
    const user = userEvent.setup();
    createSpy.mockResolvedValue(buildTransaction());
    renderView();
    await fillForm(user);
    await user.click(screen.getByRole('button', { name: /criar transação/i }));
    await waitFor(() =>
      expect(pushSpy).toHaveBeenCalledWith(`/transactions/${TX_ID}?returnTo=/transactions`),
    );
  });

  it('mapeia erros de campo da API e preserva o preenchimento', async () => {
    const user = userEvent.setup();
    createSpy.mockRejectedValue(
      new TransactionsApiError({
        code: 'VALIDATION_ERROR',
        message: 'validação',
        status: 400,
        details: [{ path: 'value', message: 'must be positive' }],
      }),
    );
    renderView();
    await fillForm(user);
    await user.click(screen.getByRole('button', { name: /criar transação/i }));
    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent(/duas casas decimais/i);
    expect(screen.getByRole('textbox', { name: /conta de débito/i })).toHaveValue(DEBIT_UUID);
    expect(screen.getByRole('textbox', { name: /conta de crédito/i })).toHaveValue(CREDIT_UUID);
  });

  it('preserva a tentativa para recuperação quando a confirmação se perde na rede', async () => {
    const user = userEvent.setup();
    createSpy.mockRejectedValue(
      new TransactionsApiError({ code: 'NETWORK_ERROR', message: 'rede' }),
    );
    renderView();
    await fillForm(user);
    await user.click(screen.getByRole('button', { name: /criar transação/i }));
    await screen.findByText(/resultado desconhecido/i);
    expect(screen.getByRole('button', { name: /retomar tentativa/i })).toBeInTheDocument();
    expect(screen.getByRole('textbox', { name: /conta de débito/i })).toHaveValue(DEBIT_UUID);
    expect(sessionStorage.getItem('biud:submission-attempt')).toContain('"state":"uncertain"');
  });
});

describe('web/CreateTransactionView — TI-05', () => {
  it('impede cliques duplos durante o envio', async () => {
    const user = userEvent.setup();
    let resolveCreate!: (r: TransactionResponse) => void;
    createSpy.mockImplementation(
      () =>
        new Promise<TransactionResponse>((res) => {
          resolveCreate = res;
        }),
    );
    renderView();
    await fillForm(user);
    const submitButton = screen.getByRole('button', { name: /criar transação/i });
    await user.click(submitButton);
    expect(submitButton).toBeDisabled();
    await user.click(submitButton);
    resolveCreate(buildTransaction());
    await waitFor(() => expect(createSpy).toHaveBeenCalledOnce());
  });

  it('exibe recuperação após timeout e preserva os dados', async () => {
    const user = userEvent.setup();
    createSpy.mockRejectedValue(new TransactionsApiError({ code: 'TIMEOUT', message: 'timeout' }));
    renderView();
    await fillForm(user);
    await user.click(screen.getByRole('button', { name: /criar transação/i }));
    await screen.findByText(/resultado desconhecido/i);
    expect(screen.getByRole('textbox', { name: /conta de débito/i })).toHaveValue(DEBIT_UUID);
  });

  it('exibe UI de recuperação ao remontar com tentativa incerta no storage', async () => {
    sessionStorage.setItem(
      'biud:submission-attempt',
      JSON.stringify({
        key: '0199f9d2-0000-7000-8000-aabbccdd0001',
        body: {
          accountExternalIdDebit: DEBIT_UUID,
          accountExternalIdCredit: CREDIT_UUID,
          transferTypeId: 1,
          value: 1000,
        },
        state: 'uncertain',
      }),
    );
    renderView();
    await screen.findByText(/resultado desconhecido/i);
    expect(screen.getByRole('button', { name: /retomar tentativa/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /nova tentativa/i })).toBeInTheDocument();
  });

  it('retoma tentativa com a mesma chave e navega para o detalhe', async () => {
    const attemptKey = '0199f9d2-0000-7000-8000-aabbccdd0001';
    sessionStorage.setItem(
      'biud:submission-attempt',
      JSON.stringify({
        key: attemptKey,
        body: {
          accountExternalIdDebit: DEBIT_UUID,
          accountExternalIdCredit: CREDIT_UUID,
          transferTypeId: 1,
          value: 1000,
        },
        state: 'uncertain',
      }),
    );
    createSpy.mockResolvedValue(buildTransaction());
    const user = userEvent.setup();
    renderView();
    await screen.findByText(/resultado desconhecido/i);
    await user.click(screen.getByRole('button', { name: /retomar tentativa/i }));
    await waitFor(() => expect(createSpy).toHaveBeenCalledOnce());
    const [attempt] = createSpy.mock.calls[0] as [{ key: string }];
    expect(attempt.key).toBe(attemptKey);
    await waitFor(() =>
      expect(pushSpy).toHaveBeenCalledWith(`/transactions/${TX_ID}?returnTo=/transactions`),
    );
  });

  it('exibe mensagem de conflito e limpa tentativa quando a API retorna 422', async () => {
    const user = userEvent.setup();
    createSpy.mockRejectedValue(
      new TransactionsApiError({
        code: 'IDEMPOTENCY_KEY_CONFLICT',
        message: 'conflito',
        status: 422,
      }),
    );
    renderView();
    await fillForm(user);
    await user.click(screen.getByRole('button', { name: /criar transação/i }));
    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent(/outros dados/i);
    expect(sessionStorage.getItem('biud:submission-attempt')).toBeNull();
  });

  it('oculta a UI de recuperação ao clicar em nova tentativa', async () => {
    sessionStorage.setItem(
      'biud:submission-attempt',
      JSON.stringify({
        key: '0199f9d2-0000-7000-8000-aabbccdd0001',
        body: {
          accountExternalIdDebit: DEBIT_UUID,
          accountExternalIdCredit: CREDIT_UUID,
          transferTypeId: 1,
          value: 1000,
        },
        state: 'uncertain',
      }),
    );
    const user = userEvent.setup();
    renderView();
    await screen.findByText(/resultado desconhecido/i);
    await user.click(screen.getByRole('button', { name: /nova tentativa/i }));
    expect(screen.queryByText(/resultado desconhecido/i)).not.toBeInTheDocument();
    expect(sessionStorage.getItem('biud:submission-attempt')).toBeNull();
  });
});

describe('web/CreateTransactionView — TI-07 (recorte do formulário)', () => {
  it('campos têm rótulos acessíveis e aria-required', () => {
    renderView();
    const debit = screen.getByRole('textbox', { name: /conta de débito/i });
    const credit = screen.getByRole('textbox', { name: /conta de crédito/i });
    const value = screen.getByRole('textbox', { name: /valor/i });
    expect(debit).toHaveAttribute('aria-required', 'true');
    expect(credit).toHaveAttribute('aria-required', 'true');
    expect(value).toHaveAttribute('aria-required', 'true');
  });

  it('campos inválidos recebem aria-invalid=true', async () => {
    const user = userEvent.setup();
    renderView();
    await user.click(screen.getByRole('button', { name: /criar transação/i }));
    const debit = screen.getByRole('textbox', { name: /conta de débito/i });
    const value = screen.getByRole('textbox', { name: /valor/i });
    await waitFor(() => {
      expect(debit).toHaveAttribute('aria-invalid', 'true');
      expect(value).toHaveAttribute('aria-invalid', 'true');
      expect(debit).toHaveAccessibleDescription(/identificador UUID da conta de débito/i);
      expect(value).toHaveAccessibleDescription(/valor da transferência/i);
    });
  });

  it('botão de cancelar aponta para a listagem', () => {
    renderView();
    const cancel = screen.getByRole('link', { name: /cancelar/i });
    expect(cancel).toHaveAttribute('href', '/transactions');
  });

  it('link de retorno aponta para a listagem', () => {
    renderView();
    const back = screen.getByRole('link', { name: /transações/i });
    expect(back).toHaveAttribute('href', '/transactions');
  });
});
