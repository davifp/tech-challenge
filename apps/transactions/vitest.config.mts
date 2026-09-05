import baseConfig from '@tech-challenge/vitest-config/node';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  ...baseConfig,
  test: {
    ...baseConfig.test,
    include: ['src/**/*.{test,spec}.ts'],
  },
});
