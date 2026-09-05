import { Module } from '@nestjs/common';
import { APP_PIPE } from '@nestjs/core';
import { ZodValidationPipe } from 'nestjs-zod';

import { ConfigModule } from './infrastructure/config/config.module';
import { TransactionsModule } from './transactions.module';

@Module({
  imports: [ConfigModule, TransactionsModule],
  providers: [{ provide: APP_PIPE, useClass: ZodValidationPipe }],
})
export class AppModule {}
