import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.{test,spec}.ts'],
    exclude: ['src/__tests__/rls/**', 'src/__tests__/webhooks/**'],
    globals: false,
    testTimeout: 30_000,
    coverage: {
      provider: 'v8',
      include: ['src/**/*.ts'],
      exclude: [
        'src/**/*.{test,spec}.ts',
        'src/__tests__/**',
        'src/config/env.ts',
        'src/main.ts',
      ],
      reporter: ['text', 'text-summary', 'json-summary'],
      reportsDirectory: './coverage',
    },
  },
});
