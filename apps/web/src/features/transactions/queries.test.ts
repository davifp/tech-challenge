import { focusManager, onlineManager, QueryClient, QueryObserver } from '@tanstack/react-query';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { TransactionsApiError, type TransactionsApi } from './api/client';
import type { ListQuery, TransactionPage, TransactionResponse } from './contracts';
import {
  listTransactionsQueryOptions,
  POLL_INTERVAL_MS,
  transactionDetailQueryOptions,
  transactionQueryKeys,
} from './queries';

const QUERY: ListQuery = { page: 1, limit: 20 };
const TRANSACTION_ID = '01999900-0000-7000-8000-aaa000000001';
const DEBIT_UUID = '0199f9c2-1a2b-7c8d-9e0f-100000000001';
const CREDIT_UUID = '0199f9c2-1a2b-7c8d-9e0f-200000000002';
const observerCleanups: Array<() => void> = [];

function buildTransaction(
  status: TransactionResponse['transactionStatus']['name'],
  updatedAt = '2026-09-07T03:00:00.000Z',
): TransactionResponse {
  return {
    transactionExternalId: TRANSACTION_ID,
    transactionType: { name: 'pix' },
    transactionStatus: { name: status },
    value: 100,
    createdAt: '2026-09-07T03:00:00.000Z',
    updatedAt,
    accountExternalIdDebit: DEBIT_UUID,
    accountExternalIdCredit: CREDIT_UUID,
  };
}

function buildPage(transaction: TransactionResponse): TransactionPage {
  return { items: [transaction], page: 1, limit: 20, total: 1 };
}

function buildApi(
  get: TransactionsApi['get'],
  list: TransactionsApi['list'] = vi.fn<TransactionsApi['list']>(),
): TransactionsApi {
  return {
    list,
    get,
    create: vi.fn<TransactionsApi['create']>(),
  };
}

function createObservedDetail(api: TransactionsApi) {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
        staleTime: 0,
        refetchOnMount: 'always',
        refetchOnReconnect: 'always',
        refetchOnWindowFocus: 'always',
      },
    },
  });
  queryClient.mount();
  const observer = new QueryObserver(
    queryClient,
    transactionDetailQueryOptions(TRANSACTION_ID, api),
  );
  const unsubscribe = observer.subscribe(() => undefined);
  observerCleanups.push(() => {
    unsubscribe();
    queryClient.clear();
    queryClient.unmount();
  });
  return { observer, queryClient };
}

afterEach(() => {
  for (const cleanup of observerCleanups.splice(0).reverse()) cleanup();
  focusManager.setFocused(undefined);
  onlineManager.setOnline(true);
  vi.useRealTimers();
});

describe('web/transactionQueryKeys', () => {
  it('produz chaves estáveis sem depender do contexto do método', () => {
    const { detail, list } = transactionQueryKeys;
    expect(list(QUERY)).toEqual(['transactions', 'list', QUERY]);
    expect(detail('transaction-id')).toEqual(['transactions', 'detail', 'transaction-id']);
  });
});

describe('web/transaction queries — TI-06', () => {
  it('consulta automaticamente uma pendente e para após a decisão', async () => {
    vi.useFakeTimers();
    const get = vi
      .fn<TransactionsApi['get']>()
      .mockResolvedValueOnce(buildTransaction('pending'))
      .mockResolvedValueOnce(buildTransaction('approved', '2026-09-07T04:00:00.000Z'));
    const list = vi
      .fn<TransactionsApi['list']>()
      .mockResolvedValueOnce(buildPage(buildTransaction('pending')))
      .mockResolvedValueOnce(buildPage(buildTransaction('approved', '2026-09-07T04:00:00.000Z')));
    const api = buildApi(get, list);
    const { queryClient } = createObservedDetail(api);
    const listObserver = new QueryObserver(queryClient, listTransactionsQueryOptions(QUERY, api));
    observerCleanups.push(listObserver.subscribe(() => undefined));
    await vi.waitFor(() => expect(get).toHaveBeenCalledTimes(1));
    await vi.waitFor(() => expect(list).toHaveBeenCalledTimes(1));
    await vi.advanceTimersByTimeAsync(POLL_INTERVAL_MS);
    await vi.waitFor(() => expect(get).toHaveBeenCalledTimes(2));
    await vi.waitFor(() => expect(list).toHaveBeenCalledTimes(2));
    await vi.advanceTimersByTimeAsync(POLL_INTERVAL_MS * 2);
    expect(get).toHaveBeenCalledTimes(2);
    expect(list).toHaveBeenCalledTimes(2);
  });

  it('mantém o polling após falha e recupera a decisão', async () => {
    vi.useFakeTimers();
    const get = vi
      .fn<TransactionsApi['get']>()
      .mockResolvedValueOnce(buildTransaction('pending'))
      .mockRejectedValueOnce(
        new TransactionsApiError({ code: 'NETWORK_ERROR', message: 'indisponível' }),
      )
      .mockResolvedValueOnce(buildTransaction('approved', '2026-09-07T04:00:00.000Z'));
    const { observer } = createObservedDetail(buildApi(get));
    await vi.waitFor(() => expect(get).toHaveBeenCalledTimes(1));
    await vi.advanceTimersByTimeAsync(POLL_INTERVAL_MS);
    await vi.waitFor(() => expect(observer.getCurrentResult().isRefetchError).toBe(true));
    expect(observer.getCurrentResult().data?.transactionStatus.name).toBe('pending');
    await vi.advanceTimersByTimeAsync(POLL_INTERVAL_MS);
    await vi.waitFor(() =>
      expect(observer.getCurrentResult().data?.transactionStatus.name).toBe('approved'),
    );
  });

  it('pausa o intervalo sem foco e reconsulta ao retomar', async () => {
    vi.useFakeTimers();
    const get = vi.fn<TransactionsApi['get']>().mockResolvedValue(buildTransaction('pending'));
    createObservedDetail(buildApi(get));
    await vi.waitFor(() => expect(get).toHaveBeenCalledTimes(1));
    focusManager.setFocused(false);
    await vi.advanceTimersByTimeAsync(POLL_INTERVAL_MS);
    expect(get).toHaveBeenCalledTimes(1);
    focusManager.setFocused(true);
    await vi.waitFor(() => expect(get).toHaveBeenCalledTimes(2));
  });

  it('reconsulta uma pendente quando a conexão retorna', async () => {
    vi.useFakeTimers();
    const get = vi.fn<TransactionsApi['get']>().mockResolvedValue(buildTransaction('pending'));
    createObservedDetail(buildApi(get));
    await vi.waitFor(() => expect(get).toHaveBeenCalledTimes(1));
    onlineManager.setOnline(false);
    onlineManager.setOnline(true);
    await vi.waitFor(() => expect(get).toHaveBeenCalledTimes(2));
  });

  it('cancela a consulta anterior ao iniciar uma nova atualização', async () => {
    let firstSignal: AbortSignal | undefined;
    const get = vi
      .fn<TransactionsApi['get']>()
      .mockImplementationOnce((_id, signal) => {
        firstSignal = signal;
        return new Promise<TransactionResponse>((_resolve, reject) => {
          signal?.addEventListener('abort', () => reject(signal.reason), { once: true });
        });
      })
      .mockResolvedValueOnce(buildTransaction('approved', '2026-09-07T04:00:00.000Z'));
    const { queryClient } = createObservedDetail(buildApi(get));
    queryClient.setQueryData(
      transactionQueryKeys.detail(TRANSACTION_ID),
      buildTransaction('pending'),
    );
    await vi.waitFor(() => expect(get).toHaveBeenCalledTimes(1));
    await queryClient.refetchQueries({ queryKey: transactionQueryKeys.detail(TRANSACTION_ID) });
    expect(firstSignal?.aborted).toBe(true);
    expect(get).toHaveBeenCalledTimes(2);
  });

  it('não deixa uma consulta em andamento reverter uma decisão conhecida', async () => {
    let resolve!: (transaction: TransactionResponse) => void;
    const get = vi.fn<TransactionsApi['get']>().mockImplementation(
      () =>
        new Promise<TransactionResponse>((promiseResolve) => {
          resolve = promiseResolve;
        }),
    );
    const { observer, queryClient } = createObservedDetail(buildApi(get));
    await vi.waitFor(() => expect(get).toHaveBeenCalledTimes(1));
    const key = transactionQueryKeys.detail(TRANSACTION_ID);
    queryClient.setQueryData(key, buildTransaction('approved', '2026-09-07T04:00:00.000Z'));
    resolve(buildTransaction('pending'));
    await vi.waitFor(() => expect(observer.getCurrentResult().isFetching).toBe(false));
    expect(queryClient.getQueryData<TransactionResponse>(key)?.transactionStatus.name).toBe(
      'approved',
    );
  });
});
