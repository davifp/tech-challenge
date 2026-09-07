import { fileURLToPath } from 'node:url';

import { defineConfig } from '@playwright/test';

import { readE2eEnvironment } from './test/helpers/e2e-environment';

const ROOT_DIRECTORY = fileURLToPath(new URL('../..', import.meta.url));
const EVIDENCE_DIRECTORY = fileURLToPath(
  new URL('../../.spec-driven/prd-fase-3-dashboard-nextjs/evidences', import.meta.url),
);
const environment = readE2eEnvironment();

export default defineConfig({
  testDir: './test/e2e',
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  timeout: 45_000,
  expect: { timeout: 10_000 },
  globalSetup: './test/helpers/anti-fraud-process.ts',
  outputDir: `${EVIDENCE_DIRECTORY}/test-results`,
  reporter: [
    ['list'],
    ['html', { open: 'never', outputFolder: `${EVIDENCE_DIRECTORY}/playwright-report` }],
  ],
  use: {
    baseURL: environment.webOrigin,
    locale: 'pt-BR',
    timezoneId: 'America/Sao_Paulo',
    screenshot: 'only-on-failure',
    trace: 'retain-on-failure',
    video: 'retain-on-failure',
  },
  projects: [
    {
      name: 'fluxo-chromium',
      testMatch: /transaction-cycle\.spec\.ts/,
      use: { browserName: 'chromium', viewport: { width: 1280, height: 800 } },
    },
    {
      name: 'mobile-375',
      testMatch: /interface\.spec\.ts/,
      use: { browserName: 'chromium', hasTouch: true, viewport: { width: 375, height: 812 } },
    },
    {
      name: 'tablet-768',
      testMatch: /interface\.spec\.ts/,
      use: { browserName: 'chromium', hasTouch: true, viewport: { width: 768, height: 1024 } },
    },
    {
      name: 'desktop-1280',
      testMatch: /interface\.spec\.ts/,
      use: { browserName: 'chromium', viewport: { width: 1280, height: 800 } },
    },
  ],
  webServer: [
    {
      name: 'transactions-api',
      command: 'pnpm --filter @tech-challenge/transactions start:e2e',
      cwd: ROOT_DIRECTORY,
      env: environment.backend,
      url: `${environment.apiOrigin}/transactions?page=1&limit=20`,
      timeout: 120_000,
      reuseExistingServer: false,
    },
    {
      name: 'dashboard',
      command: `pnpm --filter @tech-challenge/web exec next start -p ${environment.webPort}`,
      cwd: ROOT_DIRECTORY,
      env: { NEXT_PUBLIC_API_URL: environment.apiOrigin },
      url: `${environment.webOrigin}/transactions`,
      timeout: 120_000,
      reuseExistingServer: false,
    },
  ],
});
