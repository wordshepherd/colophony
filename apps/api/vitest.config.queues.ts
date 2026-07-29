import { mergeConfig } from 'vitest/config';
import { integrationBase } from './vitest.config.integration-base';

export default mergeConfig(integrationBase, {
  test: {
    include: ['src/__tests__/queues/**/*.test.ts'],
    setupFiles: ['src/__tests__/queues/helpers/vitest-setup.ts'],
    env: {
      // The two database URLs now live in vitest.config.integration-base.ts,
      // along with the explanation this suite's outbox-poller failure produced.
      REDIS_HOST: process.env.REDIS_HOST ?? 'localhost',
      REDIS_PORT: process.env.REDIS_PORT ?? '6379',
      REDIS_PASSWORD: process.env.REDIS_PASSWORD ?? '',
    },
  },
});
