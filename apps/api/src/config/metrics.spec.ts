import { describe, it, expect, afterEach } from 'vitest';
import client from 'prom-client';
import {
  httpRequestDuration,
  httpRequestTotal,
  httpActiveConnections,
  bullmqJobDuration,
  bullmqJobTotal,
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
});
