import { existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';

import { config as loadDotenv } from 'dotenv';

import { type Env } from './env.schema';
import { validateEnv } from './env.validator';

function findEnvPath(startDir: string): string | undefined {
  let currentDir = startDir;
  while (true) {
    const candidate = resolve(currentDir, '.env');
    if (existsSync(candidate)) return candidate;
    const parent = dirname(currentDir);
    if (parent === currentDir) return undefined;
    currentDir = parent;
  }
}

const envPath = findEnvPath(__dirname);
if (envPath) loadDotenv({ path: envPath, quiet: true });

export const env: Env = validateEnv(process.env);
