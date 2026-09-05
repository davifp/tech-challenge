import { config as loadDotenv } from 'dotenv';
import { defineConfig, env } from 'prisma/config';

import { findEnvPath } from './src/infrastructure/config/find-env-path';

const envPath = findEnvPath(__dirname);
if (envPath) loadDotenv({ path: envPath, quiet: true });

export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: {
    path: 'prisma/migrations',
  },
  datasource: {
    url: env('DATABASE_URL_TEST'),
  },
});
