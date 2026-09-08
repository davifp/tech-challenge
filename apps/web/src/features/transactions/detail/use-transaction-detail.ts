'use client';

import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';

import { isTerminalStatus } from '../reconcile';
import { transactionDetailQueryOptions, transactionQueryKeys } from '../transaction-query-options';

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function useTransactionDetail(transactionExternalId: string) {
  const queryClient = useQueryClient();
  const isValidId = UUID_PATTERN.test(transactionExternalId);
  const query = useQuery({
    ...transactionDetailQueryOptions(transactionExternalId),
    enabled: isValidId,
  });
  const decisionVersion =
    query.data && isTerminalStatus(query.data.transactionStatus.name)
      ? `${query.data.transactionExternalId}:${query.data.transactionStatus.name}:${query.data.updatedAt}`
      : undefined;
  useEffect(() => {
    if (!decisionVersion) return;
    queryClient.removeQueries({ queryKey: transactionQueryKeys.lists, type: 'inactive' });
    void queryClient.invalidateQueries({ queryKey: transactionQueryKeys.lists, type: 'active' });
  }, [decisionVersion, queryClient]);
  return { isValidId, query };
}
