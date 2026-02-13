import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.{test,spec}.ts'],
    exclude: ['src/__tests__/rls/**'],
    globals: false,
    testTimeout: 30_000,
  },
});
