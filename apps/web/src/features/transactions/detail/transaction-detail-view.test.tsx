import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type * as TransactionsApiModule from '../api/transactions-api';
import { TransactionsApiError } from '../api/transactions-api';
import { transactionQueryKeys } from '../transaction-query-options';
import type { TransactionResponse } from '../transaction-schemas';

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
  usePathname: () => '/transactions',
  useSearchParams: () => new URLSearchParams(),
}));

const getSpy = vi.hoisted(() => vi.fn());

vi.mock('../api/transactions-api', async () => {
  const actual = await vi.importActual<typeof TransactionsApiModule>('../api/transactions-api');
  return {
    ...actual,
    transactionsApi: {
      list: vi.fn(),
      get: getSpy,
      create: vi.fn(),
    },
  };
});

import { TransactionDetailView } from './transaction-detail-view';

const VALID_ID = '01999900-0000-7000-8000-000000000001';
const BACK_HREF = '/transactions?status=pending&page=2';

function buildTransaction(overrides: Partial<TransactionResponse> = {}): TransactionResponse {
  return {
    transactionExternalId: VALID_ID,
    transactionType: { name: 'pix' },
    transactionStatus: { name: 'approved' },
    value: 1000.01,
    createdAt: '2026-09-06T03:00:00.000Z',
    updatedAt: '2026-09-07T03:00:00.000Z',
    accountExternalIdDebit: '0199f9c2-1a2b-7c8d-9e0f-100000000001',
    accountExternalIdCredit: '0199f9c2-1a2b-7c8d-9e0f-200000000002',
    ...overrides,
  };
}

function renderView(id = VALID_ID, backHref = BACK_HREF) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, staleTime: Infinity } },
  });
  const result = render(
    <QueryClientProvider client={queryClient}>
      <TransactionDetailView backHref={backHref} transactionExternalId={id} />
    </QueryClientProvider>,
  );
  return { ...result, queryClient };
}

beforeEach(() => {
  getSpy.mockReset();
});

afterEach(() => {
  vi.useRealTimers();
});

describe('web/TransactionDetailView — TI-03', () => {
  it('exibe o esqueleto enquanto carrega e depois apresenta o detalhe', async () => {
    let resolve!: (t: TransactionResponse) => void;
    getSpy.mockImplementation(
      () =>
        new Promise<TransactionResponse>((res) => {
          resolve = res;
        }),
    );
    renderView();
    expect(screen.getByRole('status')).toHaveAttribute('aria-busy', 'true');
    resolve(buildTransaction());
    await screen.findByRole('heading', { name: /detalhe da transação/i });
  });

  it('apresenta todos os campos do recurso formatados', async () => {
    getSpy.mockResolvedValue(buildTransaction());
    renderView();
    await screen.findByRole('heading', { name: /detalhe da transação/i });
    expect(screen.getByText('Identificador')).toBeInTheDocument();
    expect(screen.getByText('Tipo')).toBeInTheDocument();
    expect(screen.getByText('Status')).toBeInTheDocument();
    expect(screen.getByText('Valor')).toBeInTheDocument();
    expect(screen.getByText('Criada em')).toBeInTheDocument();
    expect(screen.getByText('Atualizada em')).toBeInTheDocument();
    expect(screen.getByText('Conta de débito')).toBeInTheDocument();
    expect(screen.getByText('Conta de crédito')).toBeInTheDocument();
    expect(screen.getByText('Pix')).toBeInTheDocument();
    expect(screen.getByText('Aprovada')).toBeInTheDocument();
    expect(screen.getByText(/R\$\s*1\.000,01/)).toBeInTheDocument();
  });

  it('recusa identificador inválido sem chamar a API', () => {
    renderView('nao-e-um-uuid');
    expect(getSpy).not.toHaveBeenCalled();
    expect(screen.getByRole('alert')).toHaveTextContent(/identificador.*inválido/i);
    expect(screen.getByRole('alert')).not.toHaveTextContent(/não encontrada/i);
  });

  it('apresenta ausência quando a API retorna TRANSACTION_NOT_FOUND', async () => {
    getSpy.mockRejectedValue(
      new TransactionsApiError({ code: 'TRANSACTION_NOT_FOUND', message: 'ignorada', status: 404 }),
    );
    renderView();
    await screen.findByText(/transação não encontrada/i);
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /tentar novamente/i })).not.toBeInTheDocument();
  });

  it('apresenta erro recuperável com botão de retry para falhas genéricas', async () => {
    const user = userEvent.setup();
    getSpy
      .mockRejectedValueOnce(
        new TransactionsApiError({ code: 'NETWORK_ERROR', message: 'ignorada' }),
      )
      .mockResolvedValueOnce(buildTransaction());
    renderView();
    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent(/não foi possível carregar o detalhe/i);
    expect(alert).toHaveTextContent(
      'Não foi possível conectar à API. Verifique a conexão e tente novamente.',
    );
    const retryButton = screen.getByRole('button', { name: /tentar novamente/i });
    await user.click(retryButton);
    await screen.findByRole('heading', { name: /detalhe da transação/i });
  });
});

describe('web/TransactionDetailView — TU-04 (recorte)', () => {
  it('distingue identificador inválido, ausência e falha com mensagens diferentes', async () => {
    getSpy.mockRejectedValueOnce(
      new TransactionsApiError({ code: 'TRANSACTION_NOT_FOUND', message: 'ignorada', status: 404 }),
    );
    const { unmount } = renderView();
    await screen.findByText(/transação não encontrada/i);
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    unmount();

    renderView('uuid-invalido');
    expect(screen.getByRole('alert')).toHaveTextContent(/identificador.*inválido/i);
    expect(screen.queryByText(/transação não encontrada/i)).not.toBeInTheDocument();
  });

  it('oferece botão de retorno tanto no estado de erro quanto no de ausência', async () => {
    getSpy.mockRejectedValue(
      new TransactionsApiError({ code: 'NETWORK_ERROR', message: 'ignorada' }),
    );
    const { unmount } = renderView(VALID_ID, BACK_HREF);
    await screen.findByRole('alert');
    const links = screen.getAllByRole('link', { name: /voltar/i });
    expect(links.length).toBeGreaterThanOrEqual(1);
    expect(links[0]).toHaveAttribute('href', BACK_HREF);
    unmount();
  });
});

describe('web/TransactionDetailView — TI-07 (recorte do detalhe)', () => {
  it('apresenta rótulos, moeda, datas no fuso de Brasília e identificadores completos', async () => {
    getSpy.mockResolvedValue(buildTransaction());
    renderView();
    await screen.findByRole('heading', { name: /detalhe da transação/i });
    expect(screen.getByText(/R\$\s*1\.000,01/)).toBeInTheDocument();
    const times = document.querySelectorAll('time');
    expect(times.length).toBeGreaterThanOrEqual(2);
    const allText = document.body.textContent ?? '';
    expect(allText).toContain(VALID_ID);
    expect(allText).toContain('Horário de Brasília');
    const copyButtons = screen.getAllByRole('button', { name: /copiar/i });
    expect(copyButtons.length).toBeGreaterThanOrEqual(3);
  });

  it('oferece link de retorno acessível com href correto', async () => {
    getSpy.mockResolvedValue(buildTransaction());
    renderView(VALID_ID, BACK_HREF);
    await screen.findByRole('heading', { name: /detalhe da transação/i });
    const backLink = screen.getAllByRole('link', { name: /voltar/i })[0];
    expect(backLink).toHaveAttribute('href', BACK_HREF);
  });
});

describe('web/TransactionDetailView — TI-06 (acompanhamento)', () => {
  it('re-consulta e atualiza status de pendente para aprovado', async () => {
    getSpy
      .mockResolvedValueOnce(buildTransaction({ transactionStatus: { name: 'pending' } }))
      .mockResolvedValueOnce(
        buildTransaction({
          transactionStatus: { name: 'approved' },
          updatedAt: '2026-09-07T04:00:00.000Z',
        }),
      );
    const { queryClient } = renderView();
    await screen.findByText('Pendente');
    void queryClient.refetchQueries({ queryKey: ['transactions', 'detail'], type: 'active' });
    await screen.findByText('Aprovada');
  });

  it('descarta listas inativas quando o detalhe conhece uma decisão', async () => {
    let resolve!: (transaction: TransactionResponse) => void;
    getSpy.mockImplementation(
      () =>
        new Promise<TransactionResponse>((promiseResolve) => {
          resolve = promiseResolve;
        }),
    );
    const { queryClient } = renderView();
    const listKey = transactionQueryKeys.list({ page: 1, limit: 20 });
    queryClient.setQueryData(listKey, {
      items: [buildTransaction({ transactionStatus: { name: 'pending' } })],
      page: 1,
      limit: 20,
      total: 1,
    });
    resolve(buildTransaction({ transactionStatus: { name: 'approved' } }));
    await screen.findByText('Aprovada');
    await waitFor(() => expect(queryClient.getQueryData(listKey)).toBeUndefined());
  });

  it('mantém detalhe visível e exibe aviso quando re-consulta falha', async () => {
    getSpy
      .mockResolvedValueOnce(buildTransaction({ transactionStatus: { name: 'pending' } }))
      .mockRejectedValueOnce(new TransactionsApiError({ code: 'NETWORK_ERROR', message: 'erro' }));
    const { queryClient } = renderView();
    await screen.findByRole('heading', { name: /detalhe da transação/i });
    void queryClient.refetchQueries({ queryKey: ['transactions', 'detail'], type: 'active' });
    const title = await screen.findByText('Falha na atualização automática');
    expect(screen.getByRole('heading', { name: /detalhe da transação/i })).toBeInTheDocument();
    expect(title.closest('[role="status"]')).toHaveTextContent(/não foi possível conectar à API/i);
  });
});

describe('web/TransactionDetailView — TI-07 (recorte de polling)', () => {
  it('aviso de polling tem role=status e aria-live=polite', async () => {
    getSpy
      .mockResolvedValueOnce(buildTransaction({ transactionStatus: { name: 'pending' } }))
      .mockRejectedValueOnce(new TransactionsApiError({ code: 'TIMEOUT', message: 'timeout' }));
    const { queryClient } = renderView();
    await screen.findByText('Pendente');
    void queryClient.refetchQueries({ queryKey: ['transactions', 'detail'], type: 'active' });
    const title = await screen.findByText('Falha na atualização automática');
    const banner = title.closest('[role="status"]');
    expect(banner).toHaveAttribute('aria-live', 'polite');
  });
});
