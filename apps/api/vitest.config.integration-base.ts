import { defineConfig } from 'vitest/config';

/**
 * Shared base configuration for all integration test suites
 * (RLS, webhooks, security, services, queues).
 *
 * Each suite imports this and overrides only what differs
 * (include pattern, extra setup files, extra env vars).
 */
export const integrationBase = defineConfig({
  test: {
    environment: 'node',
    globals: false,
    setupFiles: ['../../test/vitest-console-setup.ts'],
    testTimeout: 30_000,
    fileParallelism: false,
    pool: 'forks',
    poolOptions: {
      forks: {
        singleFork: true,
      },
    },
    env: {
      DATABASE_URL:
        process.env.DATABASE_APP_URL ??
        'postgresql://app_user:app_password@localhost:5433/colophony_test',
    },
    coverage: {
      provider: 'v8',
      include: ['src/**/*.ts'],
      exclude: [
        'src/**/*.{test,spec}.ts',
        'src/__tests__/**',
        'src/config/env.ts',
        'src/main.ts',
      ],
      reporter: ['lcov'],
    },
  },
});
