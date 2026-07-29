import { mergeConfig } from 'vitest/config';
import { integrationBase } from './vitest.config.integration-base';

export default mergeConfig(integrationBase, {
  test: {
    include: ['src/__tests__/webhooks/**/*.test.ts'],
    env: {
      NODE_ENV: 'test',
    },
  },
});
