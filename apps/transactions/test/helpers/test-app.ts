import './load-env';
import { createServer } from 'node:net';

import { type INestApplication } from '@nestjs/common';

const FIRST_TEST_PORT = 3050;
const LAST_TEST_PORT = 3099;
const TEST_HOST = '127.0.0.1';

async function isPortAvailable(port: number): Promise<boolean> {
  return new Promise((resolve) => {
    const server = createServer();
    server.once('error', () => resolve(false));
    server.listen(port, TEST_HOST, () => server.close(() => resolve(true)));
  });
}

async function findTestPort(): Promise<number> {
  for (let port = FIRST_TEST_PORT; port <= LAST_TEST_PORT; port += 1) {
    if (await isPortAvailable(port)) return port;
  }
  throw new Error(`No available test port between ${FIRST_TEST_PORT} and ${LAST_TEST_PORT}`);
}

export type TransactionsTestApp = {
  app: INestApplication;
  baseUrl: string;
};

export async function createTransactionsTestApp(): Promise<TransactionsTestApp> {
  const databaseUrlTest = process.env.DATABASE_URL_TEST;
  if (!databaseUrlTest) throw new Error('DATABASE_URL_TEST is required for HTTP tests');
  process.env.DATABASE_URL = databaseUrlTest;
  const [{ NestFactory }, { AppModule }, { HttpExceptionFilter }] = await Promise.all([
    import('@nestjs/core'),
    import('../../src/app.module'),
    import('../../src/infrastructure/http/filters/http-exception.filter'),
  ]);
  const app = await NestFactory.create(AppModule, { logger: false });
  app.useGlobalFilters(new HttpExceptionFilter());
  const port = await findTestPort();
  await app.listen(port, TEST_HOST);
  return { app, baseUrl: `http://${TEST_HOST}:${port}` };
}
