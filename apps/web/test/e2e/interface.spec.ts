import { expect, test, type Page } from '@playwright/test';

import { readE2eEnvironment } from '../helpers/e2e-environment';

import {
  attachInterfaceEvidence,
  createTransactionByApi,
  waitForTransactionStatus,
} from './e2e-helpers';

const FUTURE_DATE = '2099-01-01';
const INTERMEDIATE_VIEWPORT = { width: 540, height: 720 };
const LANDSCAPE_VIEWPORT = { width: 667, height: 375 };

async function expectNoHorizontalOverflow(page: Page): Promise<void> {
  const hasOverflow = await page.evaluate(
    () => document.documentElement.scrollWidth > document.documentElement.clientWidth,
  );
  expect(hasOverflow).toBe(false);
}

test.describe('E2E-02 — navegação, acessibilidade e responsividade', () => {
  test('preserva contexto, funciona por teclado e expõe semântica acessível', async ({
    page,
    request,
  }, testInfo) => {
    const transaction = await createTransactionByApi(request, 500);
    await waitForTransactionStatus(request, transaction.transactionExternalId, 'approved');
    await page.goto('/transactions?status=approved&page=1');
    await expect(page.getByRole('heading', { name: 'Transações', exact: true })).toBeVisible();
    await expectNoHorizontalOverflow(page);
    const transactionLink = page
      .getByRole('link')
      .filter({ hasText: transaction.transactionExternalId });
    await transactionLink.focus();
    await expect(transactionLink).toBeFocused();
    await page.keyboard.press('Enter');
    await expect(page.getByRole('heading', { name: 'Detalhe da transação' })).toBeVisible();
    await expect(
      page.getByRole('button', { name: 'Copiar identificador da transação' }),
    ).toBeVisible();
    await page.getByRole('link', { name: '← Voltar' }).first().click();
    await expect(page).toHaveURL(/status=approved/);
    const createLink = page.getByRole('link', { name: 'Registrar nova transação' });
    await createLink.focus();
    await page.keyboard.press('Enter');
    await expect(page.getByRole('dialog', { name: 'Nova transação' })).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(page.getByRole('dialog', { name: 'Nova transação' })).toBeHidden();
    await expect(page).toHaveURL(/status=approved/);
    await attachInterfaceEvidence(page, testInfo, `${testInfo.project.name}-navegacao`);
  });

  test('distingue loading, erro recuperável e ausência de resultados', async ({
    page,
  }, testInfo) => {
    const { apiOrigin } = readE2eEnvironment();
    await page.route(
      `${apiOrigin}/transactions?*`,
      async (route) => {
        await new Promise((resolve) => setTimeout(resolve, 2_000));
        await route.continue();
      },
      { times: 1 },
    );
    await page.goto('/transactions');
    await expect(page.getByRole('status')).toContainText('Carregando transações…');
    await attachInterfaceEvidence(page, testInfo, `${testInfo.project.name}-loading`);
    await expect(page.getByRole('heading', { name: 'Transações', exact: true })).toBeVisible();
    await page.route(`${apiOrigin}/transactions?*`, async (route) => {
      await route.fulfill({
        status: 500,
        contentType: 'application/json',
        headers: { 'Access-Control-Allow-Origin': new URL(page.url()).origin },
        body: JSON.stringify({
          error: { code: 'INTERNAL_ERROR', message: 'Controlled E2E error' },
        }),
      });
    });
    await page.reload();
    const errorHeading = page.getByRole('heading', {
      name: 'Não foi possível carregar as transações',
    });
    await expect(errorHeading).toBeVisible();
    await attachInterfaceEvidence(page, testInfo, `${testInfo.project.name}-erro`);
    await page.unroute(`${apiOrigin}/transactions?*`);
    await page.getByRole('button', { name: 'Tentar novamente' }).click();
    await expect(errorHeading).toBeHidden();
    await expect(page.getByRole('heading', { name: 'Transações', exact: true })).toBeVisible();
    await page.goto(`/transactions?from=${FUTURE_DATE}`);
    await expect(
      page.getByRole('heading', { name: 'Sem resultados para os filtros' }),
    ).toBeVisible();
    await attachInterfaceEvidence(page, testInfo, `${testInfo.project.name}-vazio`);
  });

  test('mantém formulário e ações utilizáveis em zoom de 200% e larguras intermediárias', async ({
    page,
  }, testInfo) => {
    await page.goto('/transactions/new');
    await expect(page.getByRole('form', { name: 'Formulário de nova transação' })).toBeVisible();
    await expectNoHorizontalOverflow(page);
    await page.getByRole('button', { name: 'Criar transação' }).click();
    await expect(page.getByRole('alert').first()).toBeVisible();
    const session = await page.context().newCDPSession(page);
    await session.send('Emulation.setPageScaleFactor', { pageScaleFactor: 2 });
    await expect(page.getByRole('button', { name: 'Criar transação' })).toBeVisible();
    await attachInterfaceEvidence(page, testInfo, `${testInfo.project.name}-zoom-200`);
    await session.send('Emulation.setPageScaleFactor', { pageScaleFactor: 1 });
    if (testInfo.project.name !== 'mobile-375') return;
    await page.setViewportSize(INTERMEDIATE_VIEWPORT);
    await expectNoHorizontalOverflow(page);
    await page.setViewportSize(LANDSCAPE_VIEWPORT);
    await expectNoHorizontalOverflow(page);
    await attachInterfaceEvidence(page, testInfo, 'orientacao-e-largura-intermediaria');
  });
});
