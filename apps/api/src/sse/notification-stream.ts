import type { FastifyInstance } from 'fastify';
import Redis from 'ioredis';
import type { Env } from '../config/env.js';
import {
  channelKey,
  trackConnection,
  untrackConnection,
} from './redis-pubsub.js';

/**
 * Build CORS headers for hijacked SSE response.
 * reply.hijack() bypasses @fastify/cors, so we must set these manually.
 */
function buildCorsHeaders(
  requestOrigin: string | undefined,
  allowedOrigins: string[],
): Record<string, string> {
  if (!requestOrigin) return {};
  const hasWildcard = allowedOrigins.includes('*');
  if (!hasWildcard && !allowedOrigins.includes(requestOrigin)) return {};
  return {
    'Access-Control-Allow-Origin': hasWildcard ? '*' : requestOrigin,
    ...(hasWildcard ? {} : { 'Access-Control-Allow-Credentials': 'true' }),
    Vary: 'Origin',
  };
}

// Per-user SSE connection limit to prevent connection exhaustion
const MAX_CONNECTIONS_PER_USER = 5;
const userConnectionCounts = new Map<string, number>();

function incrementUserConnections(userId: string): boolean {
  const count = userConnectionCounts.get(userId) ?? 0;
  if (count >= MAX_CONNECTIONS_PER_USER) return false;
  userConnectionCounts.set(userId, count + 1);
  return true;
}

function decrementUserConnections(userId: string): void {
  const count = userConnectionCounts.get(userId) ?? 0;
  if (count <= 1) {
    userConnectionCounts.delete(userId);
  } else {
    userConnectionCounts.set(userId, count - 1);
  }
}

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

    // Rate limit: max SSE connections per user
    if (!incrementUserConnections(userId)) {
      return reply.status(429).send({ error: 'Too many SSE connections' });
    }

    const channel = channelKey(orgId, userId);

    // SSE response headers — reply.hijack() bypasses @fastify/cors,
    // so CORS headers must be included in the manual writeHead() call.
    const corsHeaders = buildCorsHeaders(
      request.headers.origin,
      env.CORS_ORIGIN.split(',').map((o) => o.trim()),
    );

    void reply.hijack();
    const raw = reply.raw;
    raw.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no',
      ...corsHeaders,
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

    try {
      await sub.connect();
    } catch {
      decrementUserConnections(userId);
      raw.end();
      return;
    }
    trackConnection(sub);

    // Forward messages as SSE events
    sub.on('message', (_ch: string, message: string) => {
      raw.write(`event: notification\ndata: ${message}\n\n`);
    });

    try {
      await sub.subscribe(channel);
    } catch {
      decrementUserConnections(userId);
      untrackConnection(sub);
      sub.quit().catch(() => undefined);
      raw.end();
      return;
    }

    // Keep-alive ping every 30s
    const pingInterval = setInterval(() => {
      raw.write(': ping\n\n');
    }, 30_000);

    // Cleanup on disconnect
    let cleaned = false;
    const cleanup = () => {
      if (cleaned) return;
      cleaned = true;
      clearInterval(pingInterval);
      decrementUserConnections(userId);
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
