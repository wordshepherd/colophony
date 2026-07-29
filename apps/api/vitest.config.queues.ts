import { mergeConfig } from 'vitest/config';
import { integrationBase } from './vitest.config.integration-base';

export default mergeConfig(integrationBase, {
  test: {
    include: ['src/__tests__/queues/**/*.test.ts'],
    setupFiles: ['src/__tests__/queues/helpers/vitest-setup.ts'],
    env: {
      // DATABASE_URL backs the superuser pool (`db`); DATABASE_APP_URL backs
      // `appPool`/`withRls()`. They must differ, as they do in production —
      // pointing both at app_user made `db` a non-superuser, so the outbox
      // poller ran as app_user and its documented superuser path was never
      // exercised. That only passed while app_user wrongly held full DML on
      // outbox_events; see packages/db/privileges.sql.
      DATABASE_URL:
        process.env.DATABASE_TEST_URL ??
        'postgresql://test:test@localhost:5433/colophony_test',
      DATABASE_APP_URL:
        process.env.DATABASE_APP_URL ??
        'postgresql://app_user:app_password@localhost:5433/colophony_test',
      REDIS_HOST: process.env.REDIS_HOST ?? 'localhost',
      REDIS_PORT: process.env.REDIS_PORT ?? '6379',
      REDIS_PASSWORD: process.env.REDIS_PASSWORD ?? '',
    },
  },
});
