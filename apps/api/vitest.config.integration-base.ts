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
    // Integration `beforeAll` hooks do MORE work than a typical test — they
    // run globalSetup() (schema reset, pool warm-up) and build a Fastify app.
    // Leaving hookTimeout at its 10s default gave setup a third of the budget
    // an individual test gets, so a slow CI runner failed in the hook rather
    // than in any assertion. Keep the two in step.
    hookTimeout: 30_000,
    // `fileParallelism: false` is what actually serializes these suites — they
    // share one test database, so two files must never run at once.
    fileParallelism: false,
    pool: 'forks',
    // NOTE: this previously also set `poolOptions.forks.singleFork: true`.
    // Vitest 4 removed `poolOptions` entirely, so that setting had stopped
    // doing anything and only emitted a deprecation warning on every run.
    // Removing it is a no-op; serialization comes from fileParallelism above.
    // Adopting the v4 equivalent (`isolate: false`) would be a real change to
    // cross-file module isolation and is deliberately NOT done here.
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
