import { fileURLToPath } from 'node:url';

import base from '@tech-challenge/vitest-config/react';
import { mergeConfig } from 'vitest/config';

export default mergeConfig(base, {
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
});
