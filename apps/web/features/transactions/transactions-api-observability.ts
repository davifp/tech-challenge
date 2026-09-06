export type TransactionsApiOperation = 'create' | 'detail' | 'list';

type ApiLogContext = {
  component: 'transactions_api';
  operation: TransactionsApiOperation;
  outcome: 'failed' | 'recovered';
  durationMs: number;
  status?: number;
  code?: string;
  transactionExternalId?: string;
};

type ApiLogSink = {
  info(context: ApiLogContext): void;
  warn(context: ApiLogContext): void;
};

type RequestObservation = {
  operation: TransactionsApiOperation;
  durationMs: number;
  requestIdentity?: string;
  transactionExternalId?: string;
};

type FailedRequestObservation = RequestObservation & {
  error: {
    code: string;
    status?: number;
  };
};

type RecoveredRequestObservation = RequestObservation & {
  status: number;
};

export type TransactionsApiObservability = {
  recordFailure(observation: FailedRequestObservation): void;
  recordRecovery(observation: RecoveredRequestObservation): void;
};

function requestKey(observation: RequestObservation): string {
  return `${observation.operation}:${observation.requestIdentity ?? ''}`;
}

export function createTransactionsApiObservability(
  sink: ApiLogSink = console,
): TransactionsApiObservability {
  const failedRequests = new Set<string>();
  return {
    recordFailure(observation) {
      const key = requestKey(observation);
      if (failedRequests.has(key)) return;
      failedRequests.add(key);
      sink.warn({
        component: 'transactions_api',
        operation: observation.operation,
        outcome: 'failed',
        durationMs: observation.durationMs,
        status: observation.error.status,
        code: observation.error.code,
        transactionExternalId: observation.transactionExternalId,
      });
    },
    recordRecovery(observation) {
      const key = requestKey(observation);
      if (!failedRequests.delete(key)) return;
      sink.info({
        component: 'transactions_api',
        operation: observation.operation,
        outcome: 'recovered',
        durationMs: observation.durationMs,
        status: observation.status,
        transactionExternalId: observation.transactionExternalId,
      });
    },
  };
}
