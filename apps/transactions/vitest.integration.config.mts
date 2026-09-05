import baseConfig from '@tech-challenge/vitest-config/node';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  ...baseConfig,
  test: {
    ...baseConfig.test,
    include: ['test/**/*.{test,spec}.ts'],
    globalSetup: ['./test/setup/global-setup.ts'],
    setupFiles: ['./test/setup/reset.ts'],
    fileParallelism: false,
  },
});
