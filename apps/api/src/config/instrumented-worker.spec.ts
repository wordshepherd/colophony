import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock metrics
const mockObserve = vi.fn();
const mockInc = vi.fn();
vi.mock('./metrics.js', () => ({
  bullmqJobDuration: { observe: (...args: unknown[]) => mockObserve(...args) },
  bullmqJobTotal: { inc: (...args: unknown[]) => mockInc(...args) },
}));

// Mock sentry
const mockCaptureException = vi.fn();
vi.mock('./sentry.js', () => ({
  captureException: (...args: unknown[]) => mockCaptureException(...args),
}));

// Mock logger
vi.mock('./logger.js', () => ({
  getLogger: () => ({
    error: vi.fn(),
  }),
}));

// Mock BullMQ Worker
const mockOn = vi.fn();
vi.mock('bullmq', () => ({
  Worker: function MockWorker(
    _name: string,
    processor: unknown,
    _opts: unknown,
  ) {
    (this as { processor: unknown }).processor = processor;
    (this as { on: unknown }).on = mockOn;
    return this;
  },
}));

import { createInstrumentedWorker } from './instrumented-worker.js';

describe('createInstrumentedWorker', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  function createTestWorker(opts?: {
    processor?: (job: unknown) => Promise<unknown>;
    onFailed?: (job: unknown, err: Error) => void | Promise<void>;
  }) {
    const processor = opts?.processor ?? (async () => 'result');
    const worker = createInstrumentedWorker({
      name: 'test-queue',
      processor,
      workerOpts: {
        connection: { host: 'localhost', port: 6379 },
        concurrency: 1,
      },
      onFailed: opts?.onFailed,
    });
    return worker;
  }

  it('records completed job duration', async () => {
    const worker = createTestWorker();
    const instrumentedProcessor = (
      worker as unknown as {
        processor: (job: unknown, token?: string) => Promise<unknown>;
      }
    ).processor;

    await instrumentedProcessor({ id: 'job-1', attemptsMade: 0 });

    expect(mockObserve).toHaveBeenCalledWith(
      { queue: 'test-queue', status: 'completed' },
      expect.any(Number),
    );
    expect(mockInc).toHaveBeenCalledWith({
      queue: 'test-queue',
      status: 'completed',
    });
  });

  it('records failed job duration', async () => {
    const worker = createTestWorker({
      processor: async () => {
        throw new Error('job failed');
      },
    });
    const instrumentedProcessor = (
      worker as unknown as {
        processor: (job: unknown, token?: string) => Promise<unknown>;
      }
    ).processor;

    await expect(
      instrumentedProcessor({ id: 'job-2', attemptsMade: 1 }),
    ).rejects.toThrow('job failed');

    expect(mockObserve).toHaveBeenCalledWith(
      { queue: 'test-queue', status: 'failed' },
      expect.any(Number),
    );
    expect(mockInc).toHaveBeenCalledWith({
      queue: 'test-queue',
      status: 'failed',
    });
  });

  it('calls captureException on failure with job context', async () => {
    const worker = createTestWorker({
      processor: async () => {
        throw new Error('crash');
      },
    });
    const instrumentedProcessor = (
      worker as unknown as {
        processor: (job: unknown, token?: string) => Promise<unknown>;
      }
    ).processor;

    await expect(
      instrumentedProcessor({ id: 'job-3', attemptsMade: 2 }),
    ).rejects.toThrow('crash');

    expect(mockCaptureException).toHaveBeenCalledWith(expect.any(Error), {
      queue: 'test-queue',
      jobId: 'job-3',
      attemptsMade: 2,
    });
  });

  it('re-throws error for BullMQ retry logic', async () => {
    const worker = createTestWorker({
      processor: async () => {
        throw new Error('retry me');
      },
    });
    const instrumentedProcessor = (
      worker as unknown as {
        processor: (job: unknown, token?: string) => Promise<unknown>;
      }
    ).processor;

    await expect(
      instrumentedProcessor({ id: 'job-4', attemptsMade: 0 }),
    ).rejects.toThrow('retry me');
  });

  it('registers failed event handler', () => {
    createTestWorker();
    expect(mockOn).toHaveBeenCalledWith('failed', expect.any(Function));
  });

  it('invokes onFailed callback on failure event', async () => {
    const onFailed = vi.fn();
    createTestWorker({ onFailed });

    // Extract the 'failed' handler
    const failedHandler = mockOn.mock.calls.find(
      (call: unknown[]) => call[0] === 'failed',
    )?.[1] as (job: unknown, err: Error) => Promise<void>;

    const mockJob = { id: 'job-5', attemptsMade: 3, opts: { attempts: 5 } };
    const error = new Error('test failure');

    await failedHandler(mockJob, error);

    expect(onFailed).toHaveBeenCalledWith(mockJob, error);
  });
});
