import fp from 'fastify-plugin';
import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import {
  httpRequestDuration,
  httpRequestTotal,
  httpActiveConnections,
} from '../config/metrics.js';

declare module 'fastify' {
  interface FastifyRequest {
    _metricsStartTime: [number, number] | null;
  }
}

/**
 * Extracts a parameterized route label to prevent cardinality explosion.
 * Uses Fastify's routeOptions.url (e.g., `/v1/submissions/:id`) when available.
 * Falls back to the first 2 path segments.
 */
function getRouteLabel(request: FastifyRequest): string {
  // Fastify's routeOptions.url gives the parameterized pattern
  const pattern = request.routeOptions?.url;
  if (pattern) return pattern;

  // Fallback: first 2 segments to limit cardinality
  const path = request.url.split('?')[0];
  const segments = path.split('/').filter(Boolean);
  if (segments.length <= 2) return path;
  return '/' + segments.slice(0, 2).join('/');
}

export default fp(
  async function metricsPlugin(app: FastifyInstance) {
    app.decorateRequest('_metricsStartTime', null);

    app.addHook(
      'onRequest',
      async function metricsOnRequest(request: FastifyRequest) {
        request._metricsStartTime = process.hrtime();
        httpActiveConnections.inc();
      },
    );

    app.addHook(
      'onResponse',
      async function metricsOnResponse(
        request: FastifyRequest,
        reply: FastifyReply,
      ) {
        httpActiveConnections.dec();

        if (!request._metricsStartTime) return;

        const [seconds, nanoseconds] = process.hrtime(
          request._metricsStartTime,
        );
        const duration = seconds + nanoseconds / 1e9;

        const labels = {
          method: request.method,
          route: getRouteLabel(request),
          status_code: reply.statusCode.toString(),
        };

        httpRequestDuration.observe(labels, duration);
        httpRequestTotal.inc(labels);
      },
    );
  },
  {
    name: 'colophony-metrics',
    fastify: '5.x',
  },
);
