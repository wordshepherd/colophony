import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import type { FastifyInstance } from 'fastify';
import {
  globalSetup,
  globalTeardown,
  getAdminPool,
} from '../rls/helpers/db-setup';
import { truncateAllTables } from '../rls/helpers/cleanup';
import { buildWebhookApp } from './helpers/webhook-app';

describe('GET /webhooks/health', () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    await globalSetup();
    app = await buildWebhookApp();
  });

  afterAll(async () => {
    await app.close();
    await globalTeardown();
  });

  beforeEach(async () => {
    await truncateAllTables(getAdminPool());
  });

  it('returns unknown status when no events exist for any provider', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/webhooks/health',
    });

    expect(response.statusCode).toBe(200);
    const body = response.json();
    expect(body.timestamp).toBeDefined();
    expect(body.providers).toHaveLength(3);

    for (const provider of body.providers) {
      expect(provider.lastReceivedAt).toBeNull();
      expect(provider.freshnessSeconds).toBeNull();
      expect(provider.status).toBe('unknown');
    }
  });

  it('returns healthy status when events are recent', async () => {
    const pool = getAdminPool();
    await pool.query(
      `INSERT INTO zitadel_webhook_events (event_id, type, payload, received_at)
       VALUES ('test:1', 'user.human.created', '{}', NOW())`,
    );

    const response = await app.inject({
      method: 'GET',
      url: '/webhooks/health',
    });

    expect(response.statusCode).toBe(200);
    const body = response.json();
    const zitadel = body.providers.find(
      (p: { provider: string }) => p.provider === 'zitadel',
    );

    expect(zitadel.lastReceivedAt).not.toBeNull();
    expect(zitadel.freshnessSeconds).toBeLessThan(60);
    expect(zitadel.status).toBe('healthy');
  });

  it('returns stale status when events exceed threshold', async () => {
    const pool = getAdminPool();
    // Insert an event 2 hours ago — default Zitadel threshold is 3600s (1 hour)
    await pool.query(
      `INSERT INTO zitadel_webhook_events (event_id, type, payload, received_at)
       VALUES ('test:2', 'user.human.created', '{}', NOW() - INTERVAL '2 hours')`,
    );

    const response = await app.inject({
      method: 'GET',
      url: '/webhooks/health',
    });

    expect(response.statusCode).toBe(200);
    const body = response.json();
    const zitadel = body.providers.find(
      (p: { provider: string }) => p.provider === 'zitadel',
    );

    expect(zitadel.status).toBe('stale');
    expect(zitadel.freshnessSeconds).toBeGreaterThan(3600);
  });

  it('returns all three providers', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/webhooks/health',
    });

    expect(response.statusCode).toBe(200);
    const body = response.json();
    const providerNames = body.providers.map(
      (p: { provider: string }) => p.provider,
    );
    expect(providerNames).toContain('zitadel');
    expect(providerNames).toContain('stripe');
    expect(providerNames).toContain('documenso');
  });
});
