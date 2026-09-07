import { Module } from '@nestjs/common';
import { ConfigModule as NestConfigModule } from '@nestjs/config';

import { validateEnv } from './env.validator';
import { findEnvPath } from './find-env-path';

@Module({
  imports: [
    NestConfigModule.forRoot({
      isGlobal: true,
      cache: true,
      envFilePath: findEnvPath(process.cwd()),
      validate: validateEnv,
    }),
  ],
})
export class ConfigModule {}
