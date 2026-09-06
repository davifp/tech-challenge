import { type INestApplication } from '@nestjs/common';

const CORS_METHODS = ['GET', 'POST'];
const CORS_ALLOWED_HEADERS = ['Content-Type', 'Idempotency-Key'];

export function enableDashboardCors(app: INestApplication, origin: string): void {
  app.enableCors({
    origin: [origin],
    methods: CORS_METHODS,
    allowedHeaders: CORS_ALLOWED_HEADERS,
  });
}
