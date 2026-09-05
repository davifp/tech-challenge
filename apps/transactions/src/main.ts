import { type INestApplication } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { cleanupOpenApiDoc } from 'nestjs-zod';

import { AppModule } from './app.module';
import './infrastructure/config/env.loader';
import { type Env } from './infrastructure/config/env.schema';
import { HttpExceptionFilter } from './infrastructure/http/filters/http-exception.filter';

const OPENAPI_DOCS_PATH = 'api/docs';
const OPENAPI_TITLE = 'Transactions API';
const OPENAPI_DESCRIPTION = 'Financial transactions API. transferTypeId enum: 1 = transfer.';
const OPENAPI_VERSION = '1.0.0';

function buildOpenApiConfig(): ReturnType<DocumentBuilder['build']> {
  return new DocumentBuilder()
    .setTitle(OPENAPI_TITLE)
    .setDescription(OPENAPI_DESCRIPTION)
    .setVersion(OPENAPI_VERSION)
    .build();
}

function setupOpenApi(app: INestApplication): void {
  const document = SwaggerModule.createDocument(app, buildOpenApiConfig());
  SwaggerModule.setup(OPENAPI_DOCS_PATH, app, cleanupOpenApiDoc(document));
}

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule);
  app.useGlobalFilters(new HttpExceptionFilter());
  setupOpenApi(app);
  const config = app.get<ConfigService<Env, true>>(ConfigService);
  await app.listen(config.get('TRANSACTIONS_PORT', { infer: true }));
}

void bootstrap();
