import { describe, expect, it } from 'vitest';

import type { ListQuery } from './contracts';
import { transactionQueryKeys } from './queries';

const QUERY: ListQuery = { page: 1, limit: 20 };

describe('web/transactionQueryKeys', () => {
  it('produz chaves estáveis sem depender do contexto do método', () => {
    const { detail, list } = transactionQueryKeys;
    expect(list(QUERY)).toEqual(['transactions', 'list', QUERY]);
    expect(detail('transaction-id')).toEqual(['transactions', 'detail', 'transaction-id']);
  });
});
