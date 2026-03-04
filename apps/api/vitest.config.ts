import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.{test,spec}.ts'],
    exclude: [
      'src/__tests__/rls/**',
      'src/__tests__/webhooks/**',
      'src/__tests__/security/**',
      'src/__tests__/services/**',
      'src/__tests__/queues/**',
      'src/**/*.flaky.test.ts',
    ],
    globals: false,
    sequence: {
      shuffle: true,
    },
    setupFiles: ['../../test/vitest-console-setup.ts'],
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
      reporter: ['text', 'text-summary', 'json-summary', 'lcov'],
      reportsDirectory: './coverage',
      thresholds: {
        statements: 50,
        branches: 44,
        functions: 45,
        lines: 51,
      },
    },
  },
});
