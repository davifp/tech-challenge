import { describe, expect, it } from 'vitest';

import { hasPendingItems, reconcileTransaction, reconcileTransactionPage } from './reconcile';
import type { TransactionPage, TransactionResponse } from './transaction-schemas';

const DEBIT_UUID = '0199f9c2-1a2b-7c8d-9e0f-100000000001';
const CREDIT_UUID = '0199f9c2-1a2b-7c8d-9e0f-200000000002';
const TX_ID_A = '01999900-0000-7000-8000-aaa000000001';
const TX_ID_B = '01999900-0000-7000-8000-bbb000000002';

type Status = 'pending' | 'approved' | 'rejected';

function buildTx(
  id: string,
  status: Status,
  updatedAt = '2026-09-07T03:00:00.000Z',
): TransactionResponse {
  return {
    transactionExternalId: id,
    transactionType: { name: 'pix' },
    transactionStatus: { name: status },
    value: 100,
    createdAt: '2026-09-07T00:00:00.000Z',
    updatedAt,
    accountExternalIdDebit: DEBIT_UUID,
    accountExternalIdCredit: CREDIT_UUID,
  };
}

function buildPage(items: TransactionResponse[], total?: number): TransactionPage {
  return { items, page: 1, limit: 20, total: total ?? items.length };
}

describe('web/reconcileTransaction — TU-03', () => {
  it('retorna o dado fresco quando não há dado anterior', () => {
    const fresh = buildTx(TX_ID_A, 'approved');
    expect(reconcileTransaction(undefined, fresh)).toBe(fresh);
  });

  it('retorna o dado fresco quando ambos são pendentes', () => {
    const prev = buildTx(TX_ID_A, 'pending', '2026-09-07T03:00:00.000Z');
    const next = buildTx(TX_ID_A, 'pending', '2026-09-07T04:00:00.000Z');
    expect(reconcileTransaction(prev, next)).toBe(next);
  });

  it('preserva a decisão terminal quando o dado fresco é mais antigo', () => {
    const terminal = buildTx(TX_ID_A, 'approved', '2026-09-07T04:00:00.000Z');
    const stale = buildTx(TX_ID_A, 'pending', '2026-09-07T03:00:00.000Z');
    expect(reconcileTransaction(terminal, stale)).toBe(terminal);
  });

  it('preserva a decisão terminal com o mesmo updatedAt', () => {
    const terminal = buildTx(TX_ID_A, 'approved', '2026-09-07T03:00:00.000Z');
    const concurrent = buildTx(TX_ID_A, 'pending', '2026-09-07T03:00:00.000Z');
    expect(reconcileTransaction(terminal, concurrent)).toBe(terminal);
  });

  it('preserva a primeira decisão diante de outra decisão terminal', () => {
    const older = buildTx(TX_ID_A, 'approved', '2026-09-07T03:00:00.000Z');
    const newer = buildTx(TX_ID_A, 'rejected', '2026-09-07T04:00:00.000Z');
    expect(reconcileTransaction(older, newer)).toBe(older);
  });

  it('aceita decisão terminal sobre pendente anterior', () => {
    const pending = buildTx(TX_ID_A, 'pending', '2026-09-07T03:00:00.000Z');
    const approved = buildTx(TX_ID_A, 'approved', '2026-09-07T04:00:00.000Z');
    expect(reconcileTransaction(pending, approved)).toBe(approved);
  });

  it('compara instantes com offsets diferentes sem depender da ordem textual', () => {
    const newer = buildTx(TX_ID_A, 'pending', '2026-09-07T00:30:00.000-03:00');
    const older = buildTx(TX_ID_A, 'pending', '2026-09-07T03:00:00.000Z');
    expect(reconcileTransaction(newer, older)).toBe(newer);
  });
});

describe('web/reconcileTransactionPage — TU-03', () => {
  it('retorna a página fresca quando não há dado anterior', () => {
    const fresh = buildPage([buildTx(TX_ID_A, 'pending')]);
    expect(reconcileTransactionPage(undefined, fresh)).toBe(fresh);
  });

  it('reconcilia itens individuais preservando decisões terminais', () => {
    const prevItems = [
      buildTx(TX_ID_A, 'approved', '2026-09-07T04:00:00.000Z'),
      buildTx(TX_ID_B, 'pending', '2026-09-07T03:00:00.000Z'),
    ];
    const nextItems = [
      buildTx(TX_ID_A, 'pending', '2026-09-07T03:00:00.000Z'),
      buildTx(TX_ID_B, 'approved', '2026-09-07T05:00:00.000Z'),
    ];
    const result = reconcileTransactionPage(buildPage(prevItems), buildPage(nextItems));
    expect(result.items[0]).toBe(prevItems[0]);
    expect(result.items[1]).toBe(nextItems[1]);
  });

  it('mantém total e paginação da resposta fresca', () => {
    const prev = buildPage([buildTx(TX_ID_A, 'approved')]);
    const next = { ...buildPage([buildTx(TX_ID_A, 'approved')]), total: 42, page: 2 };
    const result = reconcileTransactionPage(prev, next);
    expect(result.total).toBe(42);
    expect(result.page).toBe(2);
  });

  it('não há items pendentes em página com todos aprovados', () => {
    const page = buildPage([buildTx(TX_ID_A, 'approved'), buildTx(TX_ID_B, 'rejected')]);
    expect(hasPendingItems(page)).toBe(false);
  });

  it('há items pendentes quando ao menos um está pendente', () => {
    const page = buildPage([buildTx(TX_ID_A, 'approved'), buildTx(TX_ID_B, 'pending')]);
    expect(hasPendingItems(page)).toBe(true);
  });
});
