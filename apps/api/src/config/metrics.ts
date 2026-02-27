import client from 'prom-client';
import type { Pool } from 'pg';
import type { Queue } from 'bullmq';

// HTTP metrics
export const httpRequestDuration = new client.Histogram({
  name: 'http_request_duration_seconds',
  help: 'HTTP request duration in seconds',
  labelNames: ['method', 'route', 'status_code'] as const,
  buckets: [0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10],
});

export const httpRequestTotal = new client.Counter({
  name: 'http_requests_total',
  help: 'Total number of HTTP requests',
  labelNames: ['method', 'route', 'status_code'] as const,
});

export const httpActiveConnections = new client.Gauge({
  name: 'http_active_connections',
  help: 'Number of active HTTP connections',
});

// BullMQ metrics
export const bullmqJobDuration = new client.Histogram({
  name: 'bullmq_job_duration_seconds',
  help: 'BullMQ job processing duration in seconds',
  labelNames: ['queue', 'status'] as const,
  buckets: [0.01, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10, 30, 60, 120],
});

export const bullmqJobTotal = new client.Counter({
  name: 'bullmq_jobs_total',
  help: 'Total number of BullMQ jobs processed',
  labelNames: ['queue', 'status'] as const,
});

export const bullmqQueueDepth = new client.Gauge({
  name: 'bullmq_queue_depth',
  help: 'Number of jobs in queue by state',
  labelNames: ['queue', 'state'] as const,
});

// DB pool metrics
export const dbPoolTotal = new client.Gauge({
  name: 'db_pool_total_connections',
  help: 'Total number of connections in the DB pool',
  labelNames: ['pool'] as const,
});

export const dbPoolIdle = new client.Gauge({
  name: 'db_pool_idle_connections',
  help: 'Number of idle connections in the DB pool',
  labelNames: ['pool'] as const,
});

export const dbPoolWaiting = new client.Gauge({
  name: 'db_pool_waiting_clients',
  help: 'Number of clients waiting for a connection',
  labelNames: ['pool'] as const,
});

let poolInterval: ReturnType<typeof setInterval> | null = null;
let queueInterval: ReturnType<typeof setInterval> | null = null;

export function initMetrics(pools: { admin: Pool; app: Pool }): void {
  client.collectDefaultMetrics();

  // Poll DB pool stats every 15 seconds
  poolInterval = setInterval(() => {
    dbPoolTotal.set({ pool: 'admin' }, pools.admin.totalCount);
    dbPoolIdle.set({ pool: 'admin' }, pools.admin.idleCount);
    dbPoolWaiting.set({ pool: 'admin' }, pools.admin.waitingCount);

    dbPoolTotal.set({ pool: 'app' }, pools.app.totalCount);
    dbPoolIdle.set({ pool: 'app' }, pools.app.idleCount);
    dbPoolWaiting.set({ pool: 'app' }, pools.app.waitingCount);
  }, 15_000);
  poolInterval.unref();
}

export function startQueueDepthPolling(
  queues: Array<{ name: string; queue: Queue }>,
): void {
  queueInterval = setInterval(() => {
    void (async () => {
      for (const { name, queue } of queues) {
        try {
          const counts = await queue.getJobCounts(
            'waiting',
            'active',
            'delayed',
            'failed',
          );
          const labels = { queue: name };
          bullmqQueueDepth.set({ ...labels, state: 'waiting' }, counts.waiting);
          bullmqQueueDepth.set({ ...labels, state: 'active' }, counts.active);
          bullmqQueueDepth.set({ ...labels, state: 'delayed' }, counts.delayed);
          bullmqQueueDepth.set({ ...labels, state: 'failed' }, counts.failed);
        } catch {
          // Swallow errors — queue might be closing
        }
      }
    })();
  }, 30_000);
  queueInterval.unref();
}

export function stopMetricsPolling(): void {
  if (poolInterval) {
    clearInterval(poolInterval);
    poolInterval = null;
  }
  if (queueInterval) {
    clearInterval(queueInterval);
    queueInterval = null;
  }
}

export async function getMetricsOutput(): Promise<string> {
  return client.register.metrics();
}

export function getContentType(): string {
  return client.register.contentType;
}
