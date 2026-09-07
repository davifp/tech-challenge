import { fileURLToPath } from 'node:url';

import base from '@tech-challenge/vitest-config/react';

export default {
  ...base,
  resolve: {
    ...base.resolve,
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  test: {
    ...base.test,
    include: ['src/**/*.{test,spec}.{ts,tsx}'],
  },
};
