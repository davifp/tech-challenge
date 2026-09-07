import { expect, test } from '@playwright/test';

import { readE2eEnvironment } from '../helpers/e2e-environment';

import {
  attachInterfaceEvidence,
  fillTransactionForm,
  transactionFrom,
  waitForTransactionStatus,
} from './e2e-helpers';

const UI_UPDATE_LIMIT_MS = 5_000;

test.describe('E2E-01 — ciclo real no navegador', () => {
  test('fecha o modal ao criar uma transação e navegar para o detalhe', async ({
    page,
  }, testInfo) => {
    await page.goto('/transactions');
    await page.getByRole('link', { name: 'Registrar nova transação' }).click();
    const dialog = page.getByRole('dialog', { name: 'Nova transação' });
    await expect(dialog).toBeVisible();
    await fillTransactionForm(page, '500,00');
    await page.getByRole('button', { name: 'Criar transação' }).click();
    await expect(page).toHaveURL(/\/transactions\/[0-9a-f-]{36}/);
    await expect(dialog).toBeHidden();
    await expect(page.getByRole('heading', { name: 'Detalhe da transação' })).toBeVisible();
    await attachInterfaceEvidence(page, testInfo, 'e2e-01-criacao-pelo-modal');
  });

  test('aprova a transação de R$ 1.000,00 e atualiza a decisão em até 5 segundos', async ({
    page,
    request,
  }, testInfo) => {
    await page.goto('/transactions/new');
    await fillTransactionForm(page, '1000,00');
    await page.getByRole('button', { name: 'Criar transação' }).click();
    await expect(page).toHaveURL(/\/transactions\/[0-9a-f-]{36}/);
    const transactionExternalId = new URL(page.url()).pathname.split('/').at(-1);
    expect(transactionExternalId).toBeTruthy();
    const decisionAvailableAt = await waitForTransactionStatus(
      request,
      transactionExternalId ?? '',
      'approved',
    );
    await expect(page.getByText('Aprovada', { exact: true })).toBeVisible({
      timeout: UI_UPDATE_LIMIT_MS,
    });
    expect(Date.now() - decisionAvailableAt).toBeLessThanOrEqual(UI_UPDATE_LIMIT_MS);
    await attachInterfaceEvidence(page, testInfo, 'e2e-01-aprovada');
  });

  test('rejeita a transação de R$ 1.000,01', async ({ page, request }, testInfo) => {
    await page.goto('/transactions/new');
    await fillTransactionForm(page, '1000,01');
    await page.getByRole('button', { name: 'Criar transação' }).click();
    await expect(page).toHaveURL(/\/transactions\/[0-9a-f-]{36}/);
    const transactionExternalId = new URL(page.url()).pathname.split('/').at(-1);
    expect(transactionExternalId).toBeTruthy();
    await waitForTransactionStatus(request, transactionExternalId ?? '', 'rejected');
    await expect(page.getByText('Rejeitada', { exact: true })).toBeVisible({
      timeout: UI_UPDATE_LIMIT_MS,
    });
    await attachInterfaceEvidence(page, testInfo, 'e2e-01-rejeitada');
  });

  test('recupera confirmação perdida sem criar uma segunda transação', async ({
    page,
  }, testInfo) => {
    const { apiOrigin } = readE2eEnvironment();
    let createdTransactionId: string | undefined;
    await page.route(
      `${apiOrigin}/transactions`,
      async (route) => {
        if (route.request().method() !== 'POST') {
          await route.continue();
          return;
        }
        const response = await route.fetch();
        createdTransactionId = transactionFrom(await response.json()).transactionExternalId;
        await route.abort('failed');
      },
      { times: 1 },
    );
    await page.goto('/transactions/new');
    await fillTransactionForm(page, '750,00');
    await page.getByRole('button', { name: 'Criar transação' }).click();
    await expect(
      page.getByRole('region', { name: 'Tentativa anterior com resultado incerto' }),
    ).toBeVisible();
    expect(createdTransactionId).toBeTruthy();
    await page.getByRole('button', { name: 'Retomar tentativa' }).click();
    await expect(page).toHaveURL(new RegExp(`/transactions/${createdTransactionId ?? ''}`));
    await expect(page.getByText('R$ 750,00', { exact: true })).toBeVisible();
    await attachInterfaceEvidence(page, testInfo, 'e2e-01-recuperacao-idempotente');
  });
});
