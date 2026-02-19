import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.{test,spec}.ts'],
    exclude: ['src/__tests__/rls/**', 'src/__tests__/webhooks/**'],
    globals: false,
    testTimeout: 30_000,
  },
});
