import { Worker, type Processor, type WorkerOptions, type Job } from 'bullmq';
import { bullmqJobDuration, bullmqJobTotal } from './metrics.js';
import { captureException } from './sentry.js';
import { getLogger } from './logger.js';

export interface InstrumentedWorkerOptions<T> {
  /** Queue name — used as metric label and log prefix. */
  name: string;
  /** Job processor function. */
  processor: Processor<T>;
  /** BullMQ worker options (connection, concurrency, settings, etc.). */
  workerOpts: Omit<WorkerOptions, 'connection'> & {
    connection: { host: string; port: number; password?: string };
  };
  /**
   * Optional callback invoked on job failure (after logging + metrics).
   * Use this for final-failure audit logic (e.g., marking records as FAILED).
   * The wrapper already calls getLogger().error() — don't duplicate that.
   */
  onFailed?: (job: Job<T> | undefined, err: Error) => void | Promise<void>;
}

/**
 * Creates a BullMQ Worker instrumented with Prometheus metrics and Sentry error tracking.
 *
 * - Records job duration in `bullmq_job_duration_seconds` histogram
 * - Increments `bullmq_jobs_total` counter (completed/failed)
 * - Calls `captureException()` on failure with job context
 * - Re-throws errors for BullMQ retry logic
 * - Logs failures via `getLogger().error()`
 */
export function createInstrumentedWorker<T>(
  opts: InstrumentedWorkerOptions<T>,
): Worker<T> {
  const { name, processor, workerOpts, onFailed } = opts;

  const instrumentedProcessor: Processor<T> = async (job, token) => {
    const start = process.hrtime();
    try {
      const result = await processor(job, token);
      const [seconds, nanoseconds] = process.hrtime(start);
      const duration = seconds + nanoseconds / 1e9;
      bullmqJobDuration.observe({ queue: name, status: 'completed' }, duration);
      bullmqJobTotal.inc({ queue: name, status: 'completed' });
      return result;
    } catch (err) {
      const [seconds, nanoseconds] = process.hrtime(start);
      const duration = seconds + nanoseconds / 1e9;
      bullmqJobDuration.observe({ queue: name, status: 'failed' }, duration);
      bullmqJobTotal.inc({ queue: name, status: 'failed' });
      captureException(err, {
        queue: name,
        jobId: job.id,
        attemptsMade: job.attemptsMade,
      });
      throw err;
    }
  };

  const worker = new Worker<T>(name, instrumentedProcessor, workerOpts);

  // eslint-disable-next-line @typescript-eslint/no-misused-promises
  worker.on('failed', async (job, err) => {
    getLogger().error(
      {
        jobId: job?.id,
        attempt: job?.attemptsMade,
        maxAttempts: job?.opts.attempts,
        err,
      },
      `[${name}] Job failed`,
    );

    if (onFailed) {
      try {
        await onFailed(job, err);
      } catch (callbackErr) {
        getLogger().error(
          { jobId: job?.id, err: callbackErr },
          `[${name}] onFailed callback error`,
        );
      }
    }
  });

  return worker;
}
