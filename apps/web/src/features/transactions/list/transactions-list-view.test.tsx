import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Suspense } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type * as TransactionsApiModule from '../api/transactions-api';
import { TransactionsApiError } from '../api/transactions-api';
import type {
  TransactionPage,
  TransactionResponse,
  TransactionStatus,
} from '../transaction-schemas';

const routerMock = vi.hoisted(() => ({ push: vi.fn(), replace: vi.fn(), refresh: vi.fn() }));

const searchParamsRef = vi.hoisted(() => ({ current: new URLSearchParams() }));

vi.mock('next/navigation', () => ({
  useRouter: () => routerMock,
  usePathname: () => '/transactions',
  useSearchParams: () => searchParamsRef.current,
  redirect: (path: string) => {
    throw new Error(`REDIRECT:${path}`);
  },
}));

const listSpy = vi.hoisted(() => vi.fn());

vi.mock('../api/transactions-api', async () => {
  const actual = await vi.importActual<typeof TransactionsApiModule>('../api/transactions-api');
  return {
    ...actual,
    transactionsApi: {
      list: listSpy,
      get: vi.fn(),
      create: vi.fn(),
    },
  };
});

import { TransactionsListView } from './transactions-list-view';

function buildTransaction(index: number, status: TransactionStatus): TransactionResponse {
  const suffix = String(index).padStart(12, '0');
  return {
    transactionExternalId: `01999900-0000-7000-8000-${suffix}`,
    transactionType: { name: 'pix' },
    transactionStatus: { name: status },
    value: 100 + index,
    createdAt: '2026-09-06T03:00:00.000Z',
    updatedAt: '2026-09-06T03:00:00.000Z',
    accountExternalIdDebit: '0199f9c2-1a2b-7c8d-9e0f-100000000001',
    accountExternalIdCredit: '0199f9c2-1a2b-7c8d-9e0f-200000000002',
  };
}

function buildPage(pageNumber: number, items: TransactionResponse[], total = 21): TransactionPage {
  return { items, page: pageNumber, limit: 20, total };
}

function renderScreen() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, staleTime: Infinity } },
  });
  const result = render(
    <QueryClientProvider client={queryClient}>
      <Suspense fallback={<div>fallback</div>}>
        <TransactionsListView />
      </Suspense>
    </QueryClientProvider>,
  );
  return { ...result, queryClient };
}

beforeEach(() => {
  searchParamsRef.current = new URLSearchParams();
  routerMock.push.mockReset();
  routerMock.replace.mockReset();
  routerMock.refresh.mockReset();
  listSpy.mockReset();
});

afterEach(() => {
  vi.useRealTimers();
});

describe('web/TransactionsListView — TI-01', () => {
  it('consulta a primeira página com filtros vazios e navega para a segunda página', async () => {
    const user = userEvent.setup();
    const firstPage = buildPage(
      1,
      Array.from({ length: 20 }, (_, index) => buildTransaction(index + 1, 'approved')),
    );
    const secondPage = buildPage(2, [buildTransaction(21, 'pending')]);
    listSpy.mockImplementation((query) =>
      Promise.resolve(query.page === 1 ? firstPage : secondPage),
    );
    renderScreen();
    await screen.findByRole('table');
    expect(listSpy).toHaveBeenCalledWith({ page: 1, limit: 20 }, expect.anything());
    const table = screen.getByRole('table');
    expect(within(table).getAllByRole('row')).toHaveLength(21);
    expect(screen.getByRole('navigation', { name: /paginação/i })).toHaveTextContent(
      'Mostrando 1 a 20 de 21 transações',
    );
    await user.click(screen.getByRole('button', { name: 'Próxima' }));
    expect(routerMock.push).toHaveBeenCalledWith('/transactions?page=2', { scroll: false });
  });

  it('aplica filtros combinados normalizados e reinicia a página em Brasília', async () => {
    const user = userEvent.setup();
    searchParamsRef.current = new URLSearchParams('page=3');
    listSpy.mockResolvedValue(buildPage(3, [buildTransaction(41, 'pending')], 41));
    renderScreen();
    await screen.findByRole('table');
    await user.selectOptions(screen.getByLabelText('Status'), 'pending');
    await user.type(screen.getByLabelText(/^Início/), '2026-09-05');
    await user.type(screen.getByLabelText(/^Fim/), '2026-09-10');
    await user.click(screen.getByRole('button', { name: 'Aplicar' }));
    expect(routerMock.push).toHaveBeenCalledWith(
      '/transactions?status=pending&from=2026-09-05&to=2026-09-10',
      { scroll: false },
    );
  });

  it('bloqueia o envio quando o intervalo é invertido e mantém a página atual', async () => {
    const user = userEvent.setup();
    listSpy.mockResolvedValue(buildPage(1, [buildTransaction(1, 'approved')]));
    renderScreen();
    await screen.findByRole('table');
    await user.type(screen.getByLabelText(/^Início/), '2026-09-10');
    await user.type(screen.getByLabelText(/^Fim/), '2026-09-05');
    await user.click(screen.getByRole('button', { name: 'Aplicar' }));
    expect(routerMock.push).not.toHaveBeenCalled();
    expect(screen.getByRole('alert')).toHaveTextContent(
      'A data final deve ser igual ou posterior à data inicial.',
    );
    expect(screen.getByLabelText(/^Início/)).toHaveFocus();
  });

  it('não consulta a API quando a própria URL contém um intervalo invertido', async () => {
    searchParamsRef.current = new URLSearchParams('from=2026-09-10&to=2026-09-05');
    renderScreen();
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'A data final deve ser igual ou posterior à data inicial.',
    );
    expect(listSpy).not.toHaveBeenCalled();
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
  });

  it('substitui uma página fora do total pela última página existente', async () => {
    searchParamsRef.current = new URLSearchParams('page=999');
    listSpy.mockResolvedValue(buildPage(999, []));
    renderScreen();
    await waitFor(() => {
      expect(routerMock.replace).toHaveBeenCalledWith('/transactions?page=2', { scroll: false });
    });
    expect(screen.queryByText('Mostrando 19961 a 21 de 21 transações')).not.toBeInTheDocument();
  });

  it('substitui por página 1 quando uma página avançada consulta uma base vazia', async () => {
    searchParamsRef.current = new URLSearchParams('page=999');
    listSpy.mockResolvedValue({ items: [], page: 999, limit: 20, total: 0 });
    renderScreen();
    await waitFor(() => {
      expect(routerMock.replace).toHaveBeenCalledWith('/transactions', { scroll: false });
    });
    expect(screen.queryByText('Nenhuma transação por aqui')).not.toBeInTheDocument();
  });
});

describe('web/TransactionsListView — TI-02', () => {
  it('mostra o esqueleto durante o carregamento inicial', () => {
    listSpy.mockImplementation(
      () => new Promise<TransactionPage>(() => undefined) as Promise<TransactionPage>,
    );
    renderScreen();
    expect(screen.getByRole('status')).toHaveAttribute('aria-busy', 'true');
    expect(screen.getAllByRole('heading', { name: 'Transações' })).toHaveLength(1);
  });

  it('mostra falha com tentativa manual, sem apresentar como lista vazia', async () => {
    const user = userEvent.setup();
    listSpy
      .mockRejectedValueOnce(
        new TransactionsApiError({ code: 'NETWORK_ERROR', message: 'ignorada' }),
      )
      .mockResolvedValueOnce(buildPage(1, [buildTransaction(1, 'approved')]));
    renderScreen();
    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent('Não foi possível carregar as transações');
    expect(alert).toHaveTextContent(
      'Não foi possível conectar à API. Verifique a conexão e tente novamente.',
    );
    await user.click(screen.getByRole('button', { name: 'Tentar novamente' }));
    await screen.findByRole('table');
  });

  it('oferece criar transação quando a base está vazia', async () => {
    listSpy.mockResolvedValue({
      items: [],
      page: 1,
      limit: 20,
      total: 0,
    } satisfies TransactionPage);
    renderScreen();
    await screen.findByRole('link', { name: /criar primeira transação/i });
    expect(screen.getByText('Nenhuma transação por aqui')).toBeInTheDocument();
  });

  it('oferece limpar filtros quando os filtros não têm correspondência', async () => {
    const user = userEvent.setup();
    searchParamsRef.current = new URLSearchParams('status=rejected');
    listSpy.mockResolvedValue({
      items: [],
      page: 1,
      limit: 20,
      total: 0,
    } satisfies TransactionPage);
    renderScreen();
    const clearButton = await screen.findByRole('button', { name: 'Limpar filtros' });
    await user.click(clearButton);
    expect(routerMock.push).toHaveBeenCalledWith('/transactions', { scroll: false });
  });
});

describe('web/TransactionsListView — TI-07', () => {
  it('apresenta rótulos, moeda, datas e semântica de tabela na desktop', async () => {
    const transaction = buildTransaction(1, 'approved');
    transaction.value = 1000.01;
    listSpy.mockResolvedValue(buildPage(1, [transaction]));
    renderScreen();
    const table = await screen.findByRole('table');
    const columnHeaders = within(table).getAllByRole('columnheader');
    expect(columnHeaders.map((header) => header.textContent)).toEqual([
      'Identificador',
      'Data e hora',
      'Valor',
      'Status',
      'Tipo',
    ]);
    expect(within(table).getByText(/R\$\s*1\.000,01/)).toBeInTheDocument();
    expect(within(table).getAllByText('Aprovada').length).toBeGreaterThan(0);
    expect(screen.getByRole('form', { name: /filtros da listagem/i })).toBeInTheDocument();
    expect(screen.getByRole('navigation', { name: /paginação/i })).toBeInTheDocument();
    const links = within(table).getAllByRole('link');
    expect(links[0]?.getAttribute('href')).toContain(
      `/transactions/${transaction.transactionExternalId}`,
    );
  });
});

describe('web/TransactionsListView — TI-06 (acompanhamento)', () => {
  it('re-consulta e atualiza status de pendente para aprovado', async () => {
    const pendingTx = buildTransaction(1, 'pending');
    const approvedTx: TransactionResponse = {
      ...pendingTx,
      transactionStatus: { name: 'approved' },
      updatedAt: '2026-09-07T04:00:00.000Z',
    };
    listSpy
      .mockResolvedValueOnce(buildPage(1, [pendingTx]))
      .mockResolvedValueOnce(buildPage(1, [approvedTx]));
    const { queryClient } = renderScreen();
    expect(within(await screen.findByRole('table')).getByText('Pendente')).toBeInTheDocument();
    void queryClient.refetchQueries({ queryKey: ['transactions', 'list'] });
    await within(screen.getByRole('table')).findByText('Aprovada');
  });

  it('mantém dados visíveis e exibe aviso quando re-consulta falha', async () => {
    listSpy
      .mockResolvedValueOnce(buildPage(1, [buildTransaction(1, 'pending')]))
      .mockRejectedValueOnce(new TransactionsApiError({ code: 'NETWORK_ERROR', message: 'erro' }));
    const { queryClient } = renderScreen();
    expect(within(await screen.findByRole('table')).getByText('Pendente')).toBeInTheDocument();
    void queryClient.refetchQueries({ queryKey: ['transactions', 'list'] });
    const title = await screen.findByText('Falha na atualização automática');
    expect(within(screen.getByRole('table')).getByText('Pendente')).toBeInTheDocument();
    expect(title.closest('[role="status"]')).toHaveTextContent(/não foi possível conectar à API/i);
  });

  it('recupera após falha ao clicar em tentar novamente', async () => {
    const user = userEvent.setup();
    const approvedTx: TransactionResponse = {
      ...buildTransaction(1, 'pending'),
      transactionStatus: { name: 'approved' },
      updatedAt: '2026-09-07T04:00:00.000Z',
    };
    listSpy
      .mockResolvedValueOnce(buildPage(1, [buildTransaction(1, 'pending')]))
      .mockRejectedValueOnce(new TransactionsApiError({ code: 'NETWORK_ERROR', message: 'erro' }))
      .mockResolvedValueOnce(buildPage(1, [approvedTx]));
    const { queryClient } = renderScreen();
    expect(within(await screen.findByRole('table')).getByText('Pendente')).toBeInTheDocument();
    void queryClient.refetchQueries({ queryKey: ['transactions', 'list'] });
    await screen.findByText('Falha na atualização automática');
    await user.click(screen.getByRole('button', { name: /tentar novamente/i }));
    await waitFor(() =>
      expect(screen.queryByText('Falha na atualização automática')).not.toBeInTheDocument(),
    );
    expect(within(screen.getByRole('table')).getByText('Aprovada')).toBeInTheDocument();
  });

  it('substitui página inválida após re-consulta reduzir o total', async () => {
    searchParamsRef.current = new URLSearchParams('status=pending&page=2');
    listSpy
      .mockResolvedValueOnce(buildPage(2, [buildTransaction(21, 'pending')], 21))
      .mockResolvedValueOnce(buildPage(2, [], 0));
    const { queryClient } = renderScreen();
    await screen.findByRole('table');
    void queryClient.refetchQueries({ queryKey: ['transactions', 'list'] });
    await waitFor(() =>
      expect(routerMock.replace).toHaveBeenCalledWith('/transactions?status=pending', {
        scroll: false,
      }),
    );
  });
});

describe('web/TransactionsListView — TI-07 (recorte de polling)', () => {
  it('aviso de polling tem role=status e aria-live=polite', async () => {
    listSpy
      .mockResolvedValueOnce(buildPage(1, [buildTransaction(1, 'pending')]))
      .mockRejectedValueOnce(new TransactionsApiError({ code: 'TIMEOUT', message: 'timeout' }));
    const { queryClient } = renderScreen();
    expect(within(await screen.findByRole('table')).getByText('Pendente')).toBeInTheDocument();
    void queryClient.refetchQueries({ queryKey: ['transactions', 'list'], type: 'active' });
    const title = await screen.findByText('Falha na atualização automática');
    const banner = title.closest('[role="status"]');
    expect(banner).toHaveAttribute('aria-live', 'polite');
  });

  it('foco em elemento interativo é preservado quando o aviso de re-consulta aparece', async () => {
    listSpy
      .mockResolvedValueOnce(buildPage(1, [buildTransaction(1, 'pending')]))
      .mockRejectedValueOnce(new TransactionsApiError({ code: 'NETWORK_ERROR', message: 'erro' }));
    const { queryClient } = renderScreen();
    expect(within(await screen.findByRole('table')).getByText('Pendente')).toBeInTheDocument();
    const applyButton = screen.getByRole('button', { name: /aplicar/i });
    applyButton.focus();
    expect(applyButton).toHaveFocus();
    void queryClient.refetchQueries({ queryKey: ['transactions', 'list'], type: 'active' });
    await screen.findByText('Falha na atualização automática');
    expect(applyButton).toHaveFocus();
  });
});
