import { QueueEvents, type Queue, type Job } from 'bullmq';
import { getRedisConfig } from './redis-setup';

const queueEventsMap = new Map<string, QueueEvents>();

export async function getQueueEvents(queueName: string): Promise<QueueEvents> {
  let qe = queueEventsMap.get(queueName);
  if (!qe) {
    qe = new QueueEvents(queueName, { connection: getRedisConfig() });
    queueEventsMap.set(queueName, qe);
    // Wait for the QueueEvents to connect to Redis so we don't miss
    // completion events emitted before the subscription is active.
    await qe.waitUntilReady();
  }
  return qe;
}

export async function waitForJobCompletion<T>(
  queue: Queue<T>,
  jobId: string,
  timeoutMs = 15_000,
): Promise<Job<T>> {
  const qe = await getQueueEvents(queue.name);
  const job = await queue.getJob(jobId);
  if (!job) throw new Error(`Job ${jobId} not found in queue ${queue.name}`);

  await job.waitUntilFinished(qe, timeoutMs);

  // Re-fetch to get final state
  const finalJob = await queue.getJob(jobId);
  if (!finalJob) throw new Error(`Job ${jobId} disappeared after completion`);
  return finalJob as Job<T>;
}

export async function waitForJobFailure<T>(
  queue: Queue<T>,
  jobId: string,
  timeoutMs = 15_000,
): Promise<Job<T>> {
  const qe = await getQueueEvents(queue.name);
  const job = await queue.getJob(jobId);
  if (!job) throw new Error(`Job ${jobId} not found in queue ${queue.name}`);

  try {
    await job.waitUntilFinished(qe, timeoutMs);
  } catch {
    // Expected — job failed
  }

  const finalJob = await queue.getJob(jobId);
  if (!finalJob) throw new Error(`Job ${jobId} disappeared after failure`);

  const state = await finalJob.getState();
  if (state !== 'failed') {
    throw new Error(
      `Expected job ${jobId} to be in 'failed' state but got '${state}'`,
    );
  }

  return finalJob as Job<T>;
}

export async function closeAllQueueEvents(): Promise<void> {
  const closePromises = Array.from(queueEventsMap.values()).map((qe) =>
    qe.close(),
  );
  await Promise.allSettled(closePromises);
  queueEventsMap.clear();
}
