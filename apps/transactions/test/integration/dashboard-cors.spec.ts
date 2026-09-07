import { ConfigService } from '@nestjs/config';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { type Env } from '../../src/infrastructure/config/env.schema';
import { createTransactionsTestApp, type TransactionsTestApp } from '../helpers/test-app';

const DISALLOWED_ORIGIN = 'https://untrusted-dashboard.test';

describe('dashboard CORS', () => {
  let testApp: TransactionsTestApp;
  let allowedOrigin: string;

  beforeAll(async () => {
    testApp = await createTransactionsTestApp();
    const config = testApp.app.get<ConfigService<Env, true>>(ConfigService);
    allowedOrigin = config.get('DASHBOARD_ORIGIN', { infer: true });
  });

  afterAll(async () => {
    await testApp.app.close();
  });

  it('allows transaction requests from the configured dashboard origin', async () => {
    const response = await request(testApp.app.getHttpServer())
      .options('/transactions')
      .set('Origin', allowedOrigin)
      .set('Access-Control-Request-Method', 'POST')
      .set('Access-Control-Request-Headers', 'content-type,idempotency-key')
      .expect(204);
    expect(response.headers['access-control-allow-origin']).toBe(allowedOrigin);
    expect(response.headers['access-control-allow-methods']).toBe('GET,POST');
    expect(response.headers['access-control-allow-headers']).toBe('Content-Type,Idempotency-Key');
  });

  it('does not authorize an unconfigured browser origin', async () => {
    const response = await request(testApp.app.getHttpServer())
      .options('/transactions')
      .set('Origin', DISALLOWED_ORIGIN)
      .set('Access-Control-Request-Method', 'GET')
      .expect(204);
    expect(response.headers['access-control-allow-origin']).toBeUndefined();
  });
});
