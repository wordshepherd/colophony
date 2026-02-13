import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/__tests__/rls/**/*.test.ts'],
    globals: false,
    testTimeout: 30_000,
    fileParallelism: false,
    pool: 'forks',
    poolOptions: {
      forks: {
        singleFork: true,
      },
    },
    env: {
      // Point @colophony/db's pool at the test database so that
      // auditService.logDirect() (which uses the shared `db` export)
      // exercises the real write path as app_user with RLS enforced.
      // Uses the same env var / fallback as db-setup.ts's getAppPool().
      DATABASE_URL:
        process.env.DATABASE_APP_URL ??
        'postgresql://app_user:app_password@localhost:5433/prospector_test',
    },
  },
});
