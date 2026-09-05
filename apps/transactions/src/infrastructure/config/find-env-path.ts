import { existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';

export function findEnvPath(startDir: string): string | undefined {
  let currentDir = startDir;
  while (true) {
    const candidate = resolve(currentDir, '.env');
    if (existsSync(candidate)) return candidate;
    const parent = dirname(currentDir);
    if (parent === currentDir) return undefined;
    currentDir = parent;
  }
}
