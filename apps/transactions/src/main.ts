import { NestFactory } from '@nestjs/core';

import { AppModule } from './app.module';
import { env } from './infrastructure/config/env.loader';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule);
  await app.listen(env.TRANSACTIONS_PORT);
}

void bootstrap();
