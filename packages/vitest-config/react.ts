import { fileURLToPath } from 'node:url';

import react from '@vitejs/plugin-react-swc';
import { defineConfig } from 'vitest/config';

const setupFile = fileURLToPath(new URL('./setup-react.ts', import.meta.url));

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: [setupFile],
    include: ['**/*.{test,spec}.{ts,tsx}'],
  },
});
