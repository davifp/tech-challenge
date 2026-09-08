import { expect, type APIRequestContext, type Page, type TestInfo } from '@playwright/test';

import { readE2eEnvironment } from '../helpers/e2e-environment';

const TERMINAL_STATUS_TIMEOUT_MS = 15_000;
const DEFAULT_TRANSFER_TYPE_ID = '1';

type TransactionStatus = 'pending' | 'approved' | 'rejected';

type TransactionResponse = {
  transactionExternalId: string;
  transactionStatus: { name: TransactionStatus };
};

function isTransactionResponse(value: unknown): value is TransactionResponse {
  if (!value || typeof value !== 'object') return false;
  const record = value as Record<string, unknown>;
  if (typeof record.transactionExternalId !== 'string') return false;
  if (!record.transactionStatus || typeof record.transactionStatus !== 'object') return false;
  const status = (record.transactionStatus as Record<string, unknown>).name;
  return status === 'pending' || status === 'approved' || status === 'rejected';
}

export function transactionFrom(value: unknown): TransactionResponse {
  if (!isTransactionResponse(value)) throw new Error('Unexpected transaction API response');
  return value;
}

export async function createTransactionByApi(
  request: APIRequestContext,
  value: number,
): Promise<TransactionResponse> {
  const { apiOrigin } = readE2eEnvironment();
  const response = await request.post(`${apiOrigin}/transactions`, {
    headers: { 'Idempotency-Key': crypto.randomUUID() },
    data: {
      accountExternalIdDebit: crypto.randomUUID(),
      accountExternalIdCredit: crypto.randomUUID(),
      transferTypeId: 1,
      value,
    },
  });
  expect(response.ok()).toBe(true);
  return transactionFrom(await response.json());
}

export async function waitForTransactionStatus(
  request: APIRequestContext,
  transactionExternalId: string,
  expectedStatus: Exclude<TransactionStatus, 'pending'>,
): Promise<number> {
  const { apiOrigin } = readE2eEnvironment();
  await expect
    .poll(
      async () => {
        const response = await request.get(`${apiOrigin}/transactions/${transactionExternalId}`);
        if (!response.ok()) return 'unavailable';
        return transactionFrom(await response.json()).transactionStatus.name;
      },
      { timeout: TERMINAL_STATUS_TIMEOUT_MS },
    )
    .toBe(expectedStatus);
  return Date.now();
}

export async function fillTransactionForm(page: Page, value: string): Promise<void> {
  const form = page.getByRole('form', { name: 'Formulário de nova transação' });
  await form.getByRole('textbox', { name: 'Conta de débito' }).fill(crypto.randomUUID());
  await form.getByRole('textbox', { name: 'Conta de crédito' }).fill(crypto.randomUUID());
  await form
    .getByRole('combobox', { name: 'Tipo de transferência' })
    .selectOption(DEFAULT_TRANSFER_TYPE_ID);
  await form.getByRole('textbox', { name: 'Valor' }).fill(value);
}

export async function attachInterfaceEvidence(
  page: Page,
  testInfo: TestInfo,
  name: string,
): Promise<void> {
  await testInfo.attach(`${name}-visual`, {
    body: await page.screenshot({ fullPage: true }),
    contentType: 'image/png',
  });
  await testInfo.attach(`${name}-accessibility`, {
    body: Buffer.from(await page.locator('main').ariaSnapshot()),
    contentType: 'text/yaml',
  });
}
