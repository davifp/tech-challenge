import { NestFactory } from '@nestjs/core';

import { AppModule } from './app.module';

const DEFAULT_PORT = 3002;

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule);
  const port = Number(process.env.ANTI_FRAUD_PORT ?? DEFAULT_PORT);
  await app.listen(port);
}

void bootstrap();
