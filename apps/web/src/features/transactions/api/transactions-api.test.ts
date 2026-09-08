import { afterEach, describe, expect, it, vi } from 'vitest';

import type { ListQuery, SubmissionAttempt } from '../transaction-schemas';

import { createTransactionsApi, TransactionsApiError } from './transactions-api';

const API_ORIGIN = 'http://localhost:3001';
const TRANSACTION = {
  transactionExternalId: '0199f9d2-1a2b-7c8d-9e0f-1234567890ab',
  transactionType: { name: 'pix' as const },
  transactionStatus: { name: 'pending' as const },
  value: 1000.01,
  createdAt: '2026-09-06T03:00:00.000Z',
  updatedAt: '2026-09-06T03:00:00.000Z',
  accountExternalIdDebit: '0199f9c2-1a2b-7c8d-9e0f-1234567890ab',
  accountExternalIdCredit: '0299f9c2-1a2b-7c8d-9e0f-1234567890ab',
};

const LIST_QUERY: ListQuery = {
  status: 'pending',
  transferTypeId: 1,
  createdAtFrom: '2026-09-06T03:00:00.000Z',
  createdAtTo: '2026-09-07T02:59:59.999Z',
  page: 2,
  limit: 20,
};

const ATTEMPT: SubmissionAttempt = {
  key: '0399f9c2-1a2b-4c8d-9e0f-1234567890ab',
  body: {
    accountExternalIdDebit: TRANSACTION.accountExternalIdDebit,
    accountExternalIdCredit: TRANSACTION.accountExternalIdCredit,
    transferTypeId: 1,
    value: 1000.01,
  },
  state: 'sending',
};

function jsonResponse(payload: unknown, status = 200): Response {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

function abortablePendingFetch(): typeof fetch {
  return vi.fn((_input: RequestInfo | URL, init?: RequestInit) => {
    return new Promise<Response>((_resolve, reject) => {
      init?.signal?.addEventListener('abort', () => {
        reject(new DOMException('Aborted', 'AbortError'));
      });
    });
  });
}

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllEnvs();
});

describe('web/transactionsApi', () => {
  it('lista diretamente pela API pública, sem credenciais e sem cache', async () => {
    vi.stubEnv('NEXT_PUBLIC_API_URL', API_ORIGIN);
    const fetcher = vi
      .fn<typeof fetch>()
      .mockResolvedValue(jsonResponse({ items: [TRANSACTION], page: 2, limit: 20, total: 21 }));
    const api = createTransactionsApi({ fetcher });
    await expect(api.list(LIST_QUERY)).resolves.toMatchObject({ total: 21 });
    expect(fetcher).toHaveBeenCalledWith(
      'http://localhost:3001/transactions?status=pending&transferTypeId=1&createdAtFrom=2026-09-06T03%3A00%3A00.000Z&createdAtTo=2026-09-07T02%3A59%3A59.999Z&page=2&limit=20',
      expect.objectContaining({ cache: 'no-store', credentials: 'omit' }),
    );
  });

  it('rejeita uma origem pública malformada antes da chamada HTTP', async () => {
    const fetcher = vi.fn<typeof fetch>();
    const api = createTransactionsApi({
      apiOrigin: 'endereco-invalido',
      fetcher,
    });
    await expect(api.list(LIST_QUERY)).rejects.toThrow(
      'NEXT_PUBLIC_API_URL deve ser uma origem HTTP(S) válida',
    );
    expect(fetcher).not.toHaveBeenCalled();
  });

  it('envia criação com corpo e chave de idempotência', async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(jsonResponse(TRANSACTION, 201));
    const api = createTransactionsApi({
      apiOrigin: API_ORIGIN,
      fetcher,
    });
    await expect(api.create(ATTEMPT)).resolves.toEqual(TRANSACTION);
    expect(fetcher).toHaveBeenCalledWith(
      'http://localhost:3001/transactions',
      expect.objectContaining({
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Idempotency-Key': ATTEMPT.key,
        },
        body: JSON.stringify(ATTEMPT.body),
      }),
    );
  });

  it('preserva o código e os detalhes do envelope de erro', async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(
      jsonResponse(
        {
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Invalid request payload',
            details: [{ path: 'value', message: 'must be positive' }],
          },
        },
        400,
      ),
    );
    const api = createTransactionsApi({
      apiOrigin: API_ORIGIN,
      fetcher,
    });
    const error = await api.list(LIST_QUERY).catch((cause: unknown) => cause);
    expect(error).toBeInstanceOf(TransactionsApiError);
    expect(error).toMatchObject({
      code: 'VALIDATION_ERROR',
      status: 400,
      details: [{ path: 'value', message: 'must be positive' }],
    });
  });

  it('rejeita resposta incompatível com o contrato', async () => {
    const fetcher = vi
      .fn<typeof fetch>()
      .mockResolvedValue(
        jsonResponse({ ...TRANSACTION, transactionStatus: { name: 'processing' } }),
      );
    const api = createTransactionsApi({
      apiOrigin: API_ORIGIN,
      fetcher,
    });
    await expect(api.get(TRANSACTION.transactionExternalId)).rejects.toMatchObject({
      code: 'INVALID_RESPONSE',
    });
  });

  it('distingue timeout de falha de rede', async () => {
    vi.useFakeTimers();
    const api = createTransactionsApi({
      apiOrigin: API_ORIGIN,
      fetcher: abortablePendingFetch(),
      timeoutMs: 50,
    });
    const request = expect(api.list(LIST_QUERY)).rejects.toMatchObject({ code: 'TIMEOUT' });
    await vi.advanceTimersByTimeAsync(50);
    await request;
  });

  it('propaga o cancelamento do chamador como erro tipado', async () => {
    const controller = new AbortController();
    const api = createTransactionsApi({
      apiOrigin: API_ORIGIN,
      fetcher: abortablePendingFetch(),
    });
    const request = expect(api.list(LIST_QUERY, controller.signal)).rejects.toMatchObject({
      code: 'CANCELLED',
    });
    controller.abort();
    await request;
  });
});
