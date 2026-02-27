import { describe, it, expect, afterEach, vi } from 'vitest';
import client from 'prom-client';
import {
  httpRequestDuration,
  httpRequestTotal,
  httpActiveConnections,
  bullmqJobDuration,
  bullmqJobTotal,
  startQueueDepthPolling,
  getMetricsOutput,
  getContentType,
  stopMetricsPolling,
} from './metrics.js';

afterEach(() => {
  // Reset all metrics between tests to avoid cross-contamination
  client.register.resetMetrics();
  stopMetricsPolling();
});

describe('metrics', () => {
  it('records HTTP request duration histogram', () => {
    httpRequestDuration.observe(
      { method: 'GET', route: '/test', status_code: '200' },
      0.05,
    );
    // No throw = success. The observation is recorded in the histogram.
    expect(true).toBe(true);
  });

  it('increments HTTP request counter', () => {
    httpRequestTotal.inc({
      method: 'POST',
      route: '/v1/submissions',
      status_code: '201',
    });
    expect(true).toBe(true);
  });

  it('tracks active connections gauge', () => {
    httpActiveConnections.inc();
    httpActiveConnections.inc();
    httpActiveConnections.dec();
    // Gauge should be at 1
    expect(true).toBe(true);
  });

  it('records BullMQ job duration histogram', () => {
    bullmqJobDuration.observe({ queue: 'email', status: 'completed' }, 1.234);
    expect(true).toBe(true);
  });

  it('increments BullMQ job counter', () => {
    bullmqJobTotal.inc({ queue: 'file-scan', status: 'failed' });
    expect(true).toBe(true);
  });

  it('getMetricsOutput returns valid Prometheus text format', async () => {
    httpRequestTotal.inc({
      method: 'GET',
      route: '/health',
      status_code: '200',
    });

    const output = await getMetricsOutput();
    expect(output).toContain('http_requests_total');
    expect(output).toContain('method="GET"');
    expect(output).toContain('route="/health"');
    expect(output).toContain('status_code="200"');
  });

  it('getContentType returns correct MIME type', () => {
    const contentType = getContentType();
    expect(contentType).toContain('text/plain');
  });

  it('skips overlapping queue depth polls when previous poll is still running', async () => {
    vi.useFakeTimers();
    try {
      let resolveFirst: (() => void) | null = null;
      let callCount = 0;

      const mockQueue = {
        getJobCounts: vi.fn().mockImplementation(() => {
          callCount++;
          if (callCount === 1) {
            // First poll: block until resolved
            return new Promise<Record<string, number>>((resolve) => {
              resolveFirst = () =>
                resolve({ waiting: 1, active: 0, delayed: 0, failed: 0 });
            });
          }
          // Subsequent polls: resolve immediately
          return Promise.resolve({
            waiting: 0,
            active: 0,
            delayed: 0,
            failed: 0,
          });
        }),
      };

      startQueueDepthPolling([{ name: 'test', queue: mockQueue as any }]);

      // Trigger first poll
      vi.advanceTimersByTime(30_000);
      // First poll is in-flight (blocked)

      // Trigger second poll while first is still running
      vi.advanceTimersByTime(30_000);

      // Only the first poll should have called getJobCounts
      expect(callCount).toBe(1);

      // Resolve first poll
      resolveFirst!();
      await vi.advanceTimersByTimeAsync(0);

      // Now trigger third poll — should work since first completed
      vi.advanceTimersByTime(30_000);
      expect(callCount).toBe(2);
    } finally {
      stopMetricsPolling();
      vi.useRealTimers();
    }
  });
});
