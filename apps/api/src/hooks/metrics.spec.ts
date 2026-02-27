import { describe, it, expect, beforeAll, afterAll, afterEach } from 'vitest';
import Fastify, { type FastifyInstance } from 'fastify';
import client from 'prom-client';
import metricsPlugin from './metrics.js';

describe('metrics plugin', () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    app = Fastify({ logger: false });
    await app.register(metricsPlugin);

    app.get('/test', async () => ({ ok: true }));
    app.get('/items/:id', async () => ({ ok: true }));
    app.post('/v1/submissions', async () => ({ created: true }));
  });

  afterAll(async () => {
    await app.close();
  });

  afterEach(() => {
    client.register.resetMetrics();
  });

  it('records request duration on response', async () => {
    const response = await app.inject({ method: 'GET', url: '/test' });
    expect(response.statusCode).toBe(200);

    const output = await client.register.metrics();
    expect(output).toContain('http_request_duration_seconds');
  });

  it('increments request counter with correct labels', async () => {
    await app.inject({ method: 'GET', url: '/test' });

    const output = await client.register.metrics();
    expect(output).toContain('http_requests_total');
    expect(output).toContain('method="GET"');
    expect(output).toContain('status_code="200"');
  });

  it('uses parameterized route pattern, not concrete path', async () => {
    await app.inject({ method: 'GET', url: '/items/abc-123' });

    const output = await client.register.metrics();
    // Should use the pattern /items/:id, not /items/abc-123
    expect(output).toContain('route="/items/:id"');
    expect(output).not.toContain('route="/items/abc-123"');
  });

  it('active connections gauge returns to 0 after response', async () => {
    await app.inject({ method: 'GET', url: '/test' });

    const metrics = await client.register.getMetricsAsJSON();
    const gauge = metrics.find((m) => m.name === 'http_active_connections');
    expect(gauge).toBeDefined();
    // After response completes, active connections should be 0
    if (gauge && 'values' in gauge) {
      const values = gauge.values as Array<{ value: number }>;
      expect(values[0]?.value).toBe(0);
    }
  });

  it('handles multiple concurrent requests', async () => {
    await Promise.all([
      app.inject({ method: 'GET', url: '/test' }),
      app.inject({ method: 'POST', url: '/v1/submissions' }),
      app.inject({ method: 'GET', url: '/items/1' }),
    ]);

    const output = await client.register.metrics();
    expect(output).toContain('method="GET"');
    expect(output).toContain('method="POST"');
  });
});
