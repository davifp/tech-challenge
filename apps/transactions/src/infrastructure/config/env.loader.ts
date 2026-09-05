import { config as loadDotenv } from 'dotenv';

import { type Env } from './env.schema';
import { validateEnv } from './env.validator';
import { findEnvPath } from './find-env-path';

const envPath = findEnvPath(__dirname);
if (envPath) loadDotenv({ path: envPath, quiet: true });

export const env: Env = validateEnv(process.env);
