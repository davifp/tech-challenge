import { config as loadDotenv } from 'dotenv';

import { findEnvPath } from '../../src/infrastructure/config/find-env-path';

const envPath = findEnvPath(__dirname);
if (envPath) loadDotenv({ path: envPath, quiet: true });
