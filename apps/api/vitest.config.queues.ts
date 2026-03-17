import { mergeConfig } from 'vitest/config';
import { integrationBase } from './vitest.config.integration-base';

export default mergeConfig(integrationBase, {
  test: {
    include: ['src/__tests__/queues/**/*.test.ts'],
    setupFiles: [
      '../../test/vitest-console-setup.ts',
      'src/__tests__/queues/helpers/vitest-setup.ts',
    ],
    env: {
      DATABASE_URL:
        process.env.DATABASE_APP_URL ??
        'postgresql://app_user:app_password@localhost:5433/colophony_test',
      DATABASE_APP_URL:
        process.env.DATABASE_APP_URL ??
        'postgresql://app_user:app_password@localhost:5433/colophony_test',
      REDIS_HOST: process.env.REDIS_HOST ?? 'localhost',
      REDIS_PORT: process.env.REDIS_PORT ?? '6379',
      REDIS_PASSWORD: process.env.REDIS_PASSWORD ?? '',
    },
  },
});
