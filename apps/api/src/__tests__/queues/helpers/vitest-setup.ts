/**
 * Vitest setup file for queue integration tests.
 *
 * Patches BullMQ Worker connections to use a dedicated Redis database (db: 1)
 * so that dev-server Workers (running on db: 0) don't steal test jobs.
 */
import { vi } from 'vitest';

const TEST_REDIS_DB = 1;

vi.mock('bullmq', async (importActual) => {
  const actual = await importActual<Record<string, unknown>>();
  const OriginalWorker = actual.Worker as new (...args: unknown[]) => unknown;

  class TestWorker extends (OriginalWorker as any) {
    constructor(
      name: string,
      processor: unknown,
      opts: Record<string, unknown>,
    ) {
      const connection = (opts.connection ?? {}) as Record<string, unknown>;
      super(name, processor, {
        ...opts,
        connection: { ...connection, db: TEST_REDIS_DB },
      });
    }
  }

  return {
    ...actual,
    Worker: TestWorker,
  };
});
