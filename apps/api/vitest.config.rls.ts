import { mergeConfig } from 'vitest/config';
import { integrationBase } from './vitest.config.integration-base';

export default mergeConfig(integrationBase, {
  test: {
    include: ['src/__tests__/rls/**/*.test.ts'],
    env: {
      DATABASE_URL:
        process.env.DATABASE_APP_URL ??
        'postgresql://app_user:app_password@localhost:5433/colophony_test',
    },
  },
});
