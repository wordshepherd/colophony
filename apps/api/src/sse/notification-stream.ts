import type { FastifyInstance } from 'fastify';
import Redis from 'ioredis';
import type { Env } from '../config/env.js';
import {
  channelKey,
  trackConnection,
  untrackConnection,
} from './redis-pubsub.js';

export async function registerNotificationStreamRoute(
  app: FastifyInstance,
  { env }: { env: Env },
): Promise<void> {
  app.get('/api/notifications/stream', async (request, reply) => {
    // Auth is handled by the auth + org-context hooks.
    // db-context is skipped for this route (see db-context.ts).
    if (!request.authContext?.userId) {
      return reply.status(401).send({ error: 'unauthorized' });
    }
    if (!request.authContext.orgId) {
      return reply.status(400).send({ error: 'X-Organization-Id required' });
    }

    const { userId, orgId } = request.authContext;
    const channel = channelKey(orgId, userId);

    // SSE response headers
    void reply.hijack();
    const raw = reply.raw;
    raw.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no',
    });

    // Send connected event
    raw.write('event: connected\ndata: {}\n\n');

    // Per-connection subscriber (Redis requires dedicated connection for subscribe mode)
    const sub = new Redis({
      host: env.REDIS_HOST,
      port: env.REDIS_PORT,
      password: env.REDIS_PASSWORD || undefined,
      lazyConnect: true,
      maxRetriesPerRequest: null,
    });
    await sub.connect();
    trackConnection(sub);

    // Forward messages as SSE events
    sub.on('message', (_ch: string, message: string) => {
      raw.write(`event: notification\ndata: ${message}\n\n`);
    });

    await sub.subscribe(channel);

    // Keep-alive ping every 30s
    const pingInterval = setInterval(() => {
      raw.write(': ping\n\n');
    }, 30_000);

    // Cleanup on disconnect
    const cleanup = () => {
      clearInterval(pingInterval);
      sub
        .unsubscribe(channel)
        .catch(() => undefined)
        .finally(() => {
          untrackConnection(sub);
          sub.quit().catch(() => undefined);
        });
      raw.end();
    };

    request.raw.on('close', cleanup);
    request.raw.on('error', cleanup);
  });
}
