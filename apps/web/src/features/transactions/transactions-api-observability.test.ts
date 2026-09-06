import { describe, expect, it, vi } from 'vitest';

import { TransactionsApiError } from './transactions-api';
import { createTransactionsApiObservability } from './transactions-api-observability';

const TRANSACTION_EXTERNAL_ID = '0199f9d2-1a2b-7c8d-9e0f-1234567890ab';

describe('web/transactionsApiObservability', () => {
  it('registra uma falha repetida uma vez e informa a recuperação sem dados sensíveis', () => {
    const sink = { info: vi.fn(), warn: vi.fn() };
    const observability = createTransactionsApiObservability(sink);
    const failure = {
      operation: 'detail' as const,
      durationMs: 120,
      requestIdentity: TRANSACTION_EXTERNAL_ID,
      transactionExternalId: TRANSACTION_EXTERNAL_ID,
      error: new TransactionsApiError({
        code: 'NETWORK_ERROR',
        message: 'Falha que não deve ir para o log',
      }),
    };
    observability.recordFailure(failure);
    observability.recordFailure(failure);
    observability.recordRecovery({
      operation: 'detail',
      durationMs: 80,
      status: 200,
      requestIdentity: TRANSACTION_EXTERNAL_ID,
      transactionExternalId: TRANSACTION_EXTERNAL_ID,
    });
    expect(sink.warn).toHaveBeenCalledOnce();
    expect(sink.warn).toHaveBeenCalledWith({
      component: 'transactions_api',
      operation: 'detail',
      outcome: 'failed',
      durationMs: 120,
      status: undefined,
      code: 'NETWORK_ERROR',
      transactionExternalId: TRANSACTION_EXTERNAL_ID,
    });
    expect(sink.warn).not.toHaveBeenCalledWith(
      expect.objectContaining({ message: expect.any(String) }),
    );
    expect(sink.info).toHaveBeenCalledWith({
      component: 'transactions_api',
      operation: 'detail',
      outcome: 'recovered',
      durationMs: 80,
      status: 200,
      transactionExternalId: TRANSACTION_EXTERNAL_ID,
    });
  });

  it('correlaciona a recuperação de criação antes de conhecer o UUID retornado', () => {
    const sink = { info: vi.fn(), warn: vi.fn() };
    const observability = createTransactionsApiObservability(sink);
    observability.recordFailure({
      operation: 'create',
      durationMs: 120,
      requestIdentity: 'submission-attempt',
      error: new TransactionsApiError({ code: 'TIMEOUT', message: 'Timeout' }),
    });
    observability.recordRecovery({
      operation: 'create',
      durationMs: 80,
      status: 200,
      requestIdentity: 'submission-attempt',
      transactionExternalId: TRANSACTION_EXTERNAL_ID,
    });
    expect(sink.info).toHaveBeenCalledWith(
      expect.objectContaining({
        outcome: 'recovered',
        transactionExternalId: TRANSACTION_EXTERNAL_ID,
      }),
    );
  });
});
