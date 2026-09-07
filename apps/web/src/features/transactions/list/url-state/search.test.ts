import { describe, expect, it } from 'vitest';

import { totalPages } from '../pagination';

import {
  buildTransactionDetailHref,
  buildTransactionsHref,
  changePage,
  clearFilters,
  hasActiveFilters,
  parseTransactionsSearchParams,
  replaceFilters,
  sanitizeReturnTo,
  serializeTransactionsSearch,
  toListQuery,
  type TransactionsSearch,
} from './search';

const EMPTY_SEARCH: TransactionsSearch = { page: 1 };

describe('web/transactions-search', () => {
  it('normaliza os filtros e a página vindos da URL, descartando valores inválidos', () => {
    const params = new URLSearchParams(
      'status=pending&transferTypeId=1&from=2026-09-05&to=2026-09-10&page=3',
    );
    expect(parseTransactionsSearchParams(params)).toEqual({
      status: 'pending',
      transferTypeId: 1,
      from: '2026-09-05',
      to: '2026-09-10',
      page: 3,
    });
    const invalid = new URLSearchParams(
      'status=processing&transferTypeId=2&from=ontem&to=&page=-3',
    );
    expect(parseTransactionsSearchParams(invalid)).toEqual({ page: 1 });
    expect(parseTransactionsSearchParams(new URLSearchParams('page=2.5'))).toEqual({ page: 1 });
    expect(parseTransactionsSearchParams(new URLSearchParams('page=2abc'))).toEqual({ page: 1 });
  });

  it('reinicia a página ao alterar ou limpar filtros', () => {
    const previous: TransactionsSearch = {
      status: 'pending',
      transferTypeId: 1,
      from: '2026-09-05',
      to: '2026-09-10',
      page: 4,
    };
    expect(replaceFilters(previous, { status: 'approved' })).toEqual({
      status: 'approved',
      transferTypeId: 1,
      from: '2026-09-05',
      to: '2026-09-10',
      page: 1,
    });
    expect(replaceFilters(previous, { from: undefined })).toEqual({
      status: 'pending',
      transferTypeId: 1,
      from: undefined,
      to: '2026-09-10',
      page: 1,
    });
    expect(clearFilters()).toEqual({ page: 1 });
    expect(changePage(previous, 2)).toEqual({ ...previous, page: 2 });
    expect(changePage(previous, 0)).toEqual({ ...previous, page: 1 });
  });

  it('serializa apenas o que precisa aparecer na URL, omitindo a primeira página', () => {
    expect(serializeTransactionsSearch(EMPTY_SEARCH).toString()).toBe('');
    expect(
      serializeTransactionsSearch({
        status: 'pending',
        transferTypeId: 1,
        from: '2026-09-05',
        to: '2026-09-10',
        page: 2,
      }).toString(),
    ).toBe('status=pending&transferTypeId=1&from=2026-09-05&to=2026-09-10&page=2');
    expect(buildTransactionsHref(EMPTY_SEARCH)).toBe('/transactions');
    expect(buildTransactionsHref({ status: 'pending', page: 1 })).toBe(
      '/transactions?status=pending',
    );
  });

  it('transporta o contexto de retorno somente com destino permitido', () => {
    const href = buildTransactionDetailHref('0199f9d2-1a2b-7c8d-9e0f-1234567890ab', {
      status: 'pending',
      page: 2,
    });
    expect(href).toBe(
      '/transactions/0199f9d2-1a2b-7c8d-9e0f-1234567890ab?returnTo=%2Ftransactions%3Fstatus%3Dpending%26page%3D2',
    );
    expect(buildTransactionDetailHref('id-teste', EMPTY_SEARCH)).toBe('/transactions/id-teste');
    expect(sanitizeReturnTo('/transactions?status=pending&page=2')).toBe(
      '/transactions?status=pending&page=2',
    );
    expect(sanitizeReturnTo('/transactions?malicioso=true&status=pending')).toBe(
      '/transactions?status=pending',
    );
    expect(sanitizeReturnTo('https://exemplo.com/transactions')).toBe('/transactions');
    expect(sanitizeReturnTo(undefined)).toBe('/transactions');
  });

  it('converte a busca da tela em consulta da API preservando o intervalo em Brasília', () => {
    expect(toListQuery(EMPTY_SEARCH)).toEqual({ page: 1, limit: 20 });
    expect(
      toListQuery({
        status: 'pending',
        transferTypeId: 1,
        from: '2026-09-06',
        to: '2026-09-06',
        page: 2,
      }),
    ).toEqual({
      status: 'pending',
      transferTypeId: 1,
      createdAtFrom: '2026-09-06T03:00:00.000Z',
      createdAtTo: '2026-09-07T02:59:59.999Z',
      page: 2,
      limit: 20,
    });
  });

  it('reconhece quando há filtros ativos para exibir a limpeza no estado vazio', () => {
    expect(hasActiveFilters(EMPTY_SEARCH)).toBe(false);
    expect(hasActiveFilters({ status: 'approved', page: 1 })).toBe(true);
  });

  it('calcula a última página para canonicalizar URLs fora do total', () => {
    expect(totalPages(0)).toBe(1);
    expect(totalPages(20)).toBe(1);
    expect(totalPages(21)).toBe(2);
  });
});
