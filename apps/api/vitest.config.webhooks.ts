import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/__tests__/webhooks/**/*.test.ts'],
    globals: false,
    setupFiles: ['../../test/vitest-console-setup.ts'],
    testTimeout: 30_000,
    fileParallelism: false,
    pool: 'forks',
    singleFork: true,
    env: {
      // Point @colophony/db's pool at the test database.
      // Uses the same env var / fallback as db-setup.ts's getAppPool().
      DATABASE_URL:
        process.env.DATABASE_APP_URL ??
        'postgresql://app_user:app_password@localhost:5433/colophony_test',
      NODE_ENV: 'test',
    },
  },
});
