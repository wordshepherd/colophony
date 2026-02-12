import Fastify, { type FastifyInstance } from 'fastify';
import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import { pool } from '@colophony/db';
import { type Env, validateEnv } from './config/env.js';
import authPlugin from './hooks/auth.js';
import rateLimitPlugin from './hooks/rate-limit.js';
import orgContextPlugin from './hooks/org-context.js';
import dbContextPlugin from './hooks/db-context.js';
import { registerZitadelWebhooks } from './webhooks/zitadel.webhook.js';

export async function buildApp(env: Env): Promise<FastifyInstance> {
  const app = Fastify({
    logger: {
      level: env.LOG_LEVEL,
      ...(env.NODE_ENV === 'development'
        ? { transport: { target: 'pino-pretty' } }
        : {}),
      redact: [
        'req.headers.authorization',
        'req.headers.cookie',
        'req.headers["x-api-key"]',
      ],
    },
    trustProxy: true,
    keepAliveTimeout: 65_000,
    requestTimeout: 60_000,
    connectionTimeout: 5_000,
  });

  // Security headers
  await app.register(helmet, {
    contentSecurityPolicy: false, // No HTML served from API
    crossOriginResourcePolicy: { policy: 'cross-origin' },
  });

  // CORS
  const origins = env.CORS_ORIGIN.split(',').map((o) => o.trim());
  const hasWildcard = origins.includes('*');

  if (hasWildcard) {
    app.log.warn(
      'CORS_ORIGIN includes wildcard (*) — credentials will be disabled (CORS spec forbids credentials: true with wildcard origin)',
    );
  }

  await app.register(cors, {
    origin: (origin, callback) => {
      // Allow requests with no origin (mobile apps, curl, etc.)
      if (!origin) {
        callback(null, true);
        return;
      }
      if (hasWildcard || origins.includes(origin)) {
        callback(null, true);
      } else {
        callback(new Error('Not allowed by CORS'), false);
      }
    },
    credentials: !hasWildcard,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: [
      'Content-Type',
      'Authorization',
      'X-Organization-Id',
      'X-Request-Id',
    ],
    exposedHeaders: [
      'X-RateLimit-Limit',
      'X-RateLimit-Remaining',
      'X-RateLimit-Reset',
      'Retry-After',
    ],
    maxAge: 86400, // 24 hours
  });

  // Auth + rate limit + org context + per-request RLS transaction
  await app.register(authPlugin, { env });
  await app.register(rateLimitPlugin, { env });
  await app.register(orgContextPlugin);
  await app.register(dbContextPlugin);

  // Webhooks — separate scope to isolate fastify-raw-body
  await app.register(async (scope) => {
    await registerZitadelWebhooks(scope, { env });
  });

  // TODO: Register tRPC adapter when wiring procedures
  // await app.register(fastifyTRPCPlugin, { prefix: '/trpc', router: appRouter });

  // Routes
  app.get('/health', async () => ({
    status: 'ok',
    timestamp: new Date().toISOString(),
  }));

  app.get('/ready', async (_request, reply) => {
    try {
      await pool.query('SELECT 1');
      return { status: 'ready', timestamp: new Date().toISOString() };
    } catch (err) {
      app.log.error(err, 'Readiness check failed — database unreachable');
      return reply.status(503).send({
        status: 'unavailable',
        error: 'database_unreachable',
        timestamp: new Date().toISOString(),
      });
    }
  });

  app.get('/', async () => ({
    name: 'Colophony API',
    version: '2.0.0-dev',
  }));

  // Error handlers
  app.setErrorHandler<Error>((error, _request, reply) => {
    app.log.error(error);
    const statusCode =
      'statusCode' in error &&
      typeof (error as Record<string, unknown>).statusCode === 'number'
        ? ((error as Record<string, unknown>).statusCode as number)
        : 500;
    void reply.status(statusCode).send({
      error: statusCode >= 500 ? 'internal_error' : error.message,
    });
  });

  app.setNotFoundHandler((_request, reply) => {
    void reply.status(404).send({ error: 'not_found' });
  });

  return app;
}

async function start(): Promise<void> {
  const env = validateEnv();
  const app = await buildApp(env);

  // Graceful shutdown
  const shutdown = async (signal: string) => {
    app.log.info(`Received ${signal}, shutting down gracefully...`);

    const forceExit = setTimeout(() => {
      app.log.error('Shutdown timeout exceeded, forcing exit');
      process.exit(1);
    }, 10_000);

    try {
      await app.close();
      // TODO: Close DB pool when connection management is centralized
      // TODO: Close Redis connections
      // TODO: Close BullMQ workers
      app.log.info('Server closed');
    } finally {
      clearTimeout(forceExit);
      process.exit(0);
    }
  };

  process.once('SIGINT', () => void shutdown('SIGINT'));
  process.once('SIGTERM', () => void shutdown('SIGTERM'));

  await app.listen({ port: env.PORT, host: env.HOST });
  app.log.info(`Colophony API listening on ${env.HOST}:${env.PORT}`);
}

// Only start when run directly, not when imported by tests
if (require.main === module) {
  start().catch((err) => {
    console.error('Failed to start server:', err);
    process.exit(1);
  });
}
