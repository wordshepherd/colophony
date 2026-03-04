import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/__tests__/queues/**/*.test.ts'],
    globals: false,
    testTimeout: 30_000,
    setupFiles: [
      '../../test/vitest-console-setup.ts',
      'src/__tests__/queues/helpers/vitest-setup.ts',
    ],
    fileParallelism: false,
    pool: 'forks',
    forks: {
      singleFork: true,
    },
    env: {
      // Point @colophony/db's pool at the test database so that
      // workers using withRls() exercise the real DB path.
      DATABASE_URL:
        process.env.DATABASE_APP_URL ??
        'postgresql://app_user:app_password@localhost:5433/colophony_test',
      // Explicitly set DATABASE_APP_URL so appPool also uses test DB
      DATABASE_APP_URL:
        process.env.DATABASE_APP_URL ??
        'postgresql://app_user:app_password@localhost:5433/colophony_test',
      REDIS_HOST: process.env.REDIS_HOST ?? 'localhost',
      REDIS_PORT: process.env.REDIS_PORT ?? '6379',
      REDIS_PASSWORD: process.env.REDIS_PASSWORD ?? '',
    },
  },
});
