import Fastify, { type FastifyInstance } from 'fastify';
import cors from '@fastify/cors';
import compress from '@fastify/compress';
import helmet from '@fastify/helmet';
import { pool, appPool } from '@colophony/db';
import { type Env, validateEnv } from './config/env.js';
import { initSentry, captureException } from './config/sentry.js';
import {
  initMetrics,
  startQueueDepthPolling,
  stopMetricsPolling,
  getMetricsOutput,
  getContentType,
} from './config/metrics.js';
import metricsPlugin from './hooks/metrics.js';
import { initAdapters } from './colophony.config.js';
import { setGlobalRegistry } from './adapters/registry-accessor.js';
import authPlugin from './hooks/auth.js';
import rateLimitPlugin from './hooks/rate-limit.js';
import rateLimitAuthPlugin from './hooks/rate-limit-auth.js';
import orgContextPlugin from './hooks/org-context.js';
import dbContextPlugin from './hooks/db-context.js';
import auditPlugin from './hooks/audit.js';
import { registerZitadelWebhooks } from './webhooks/zitadel.webhook.js';
import { registerTusdWebhooks } from './webhooks/tusd.webhook.js';
import { registerStripeWebhooks } from './webhooks/stripe.webhook.js';
import { registerDocumensoWebhooks } from './webhooks/documenso.webhook.js';
import { registerEmbedRoutes } from './routes/embed.routes.js';
import { fastifyTRPCPlugin } from '@trpc/server/adapters/fastify';
import { appRouter } from './trpc/router.js';
import { createContext } from './trpc/context.js';
import { registerRestRoutes } from './rest/router.js';
import {
  startFileScanWorker,
  stopFileScanWorker,
  startS3CleanupWorker,
  stopS3CleanupWorker,
  startOutboxPollerWorker,
  stopOutboxPollerWorker,
  startTransferFetchWorker,
  stopTransferFetchWorker,
  startEmailWorker,
  stopEmailWorker,
  startWebhookWorker,
  stopWebhookWorker,
} from './workers/index.js';
import {
  closeFileScanQueue,
  closeS3CleanupQueue,
  startOutboxPoller,
  closeOutboxPollerQueue,
  closeTransferFetchQueue,
  closeEmailQueue,
  closeWebhookQueue,
  getFileScanQueueInstance,
  getS3CleanupQueueInstance,
  getOutboxPollerQueueInstance,
  getTransferFetchQueueInstance,
  getEmailQueueInstance,
  getWebhookQueueInstance,
} from './queues/index.js';
import { registerInngestRoutes } from './inngest/serve.js';
import { registerWebhookHealthRoute } from './webhooks/webhook-health.route.js';
import { registerFederationDiscoveryRoutes } from './federation/discovery.routes.js';
import { registerFederationDidRoutes } from './federation/did.routes.js';
import { registerFederationTrustRoutes } from './federation/trust.routes.js';
import { registerFederationTrustAdminRoutes } from './federation/trust-admin.routes.js';
import { registerSimSubRoutes } from './federation/simsub.routes.js';
import { registerSimSubAdminRoutes } from './federation/simsub-admin.routes.js';
import { registerTransferRoutes } from './federation/transfer.routes.js';
import { registerTransferAdminRoutes } from './federation/transfer-admin.routes.js';
import { registerMigrationRoutes } from './federation/migration.routes.js';
import { registerMigrationAdminRoutes } from './federation/migration-admin.routes.js';
import { registerHubRoutes } from './federation/hub.routes.js';
import { registerHubAdminRoutes } from './federation/hub-admin.routes.js';
import { registerKeyAdminRoutes } from './federation/key-admin.routes.js';
import { hubClientService } from './services/hub-client.service.js';
import { registerNotificationStreamRoute } from './sse/notification-stream.js';
import {
  closePublisher,
  closeSubscriber,
  closeAllSSEConnections,
} from './sse/redis-pubsub.js';

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
    // tRPC httpBatchLink encodes comma-separated procedure names in the URL
    // path (e.g. /trpc/a.b,c.d,e.f). Fastify's default maxParamLength of 100
    // silently returns 404 for batches with many long procedure names (such as
    // the analytics dashboard which batches ~8 queries at once).
    maxParamLength: 500,
  });

  // Security headers
  await app.register(helmet, {
    contentSecurityPolicy: false, // No HTML served from API
    strictTransportSecurity: {
      maxAge: 31536000, // 1 year — explicit to avoid drift across helmet upgrades
      includeSubDomains: true,
    },
    // CORP defaults to same-origin; no override needed for a JSON API
    // (cross-origin fetch/XHR is governed by CORS, not CORP)
  });

  // Response compression (brotli + gzip, skip small payloads)
  await app.register(compress, { threshold: 1024 });

  // Permissions-Policy — helmet v8 dropped support; set manually
  app.addHook('onSend', async (_request, reply) => {
    void reply.header(
      'permissions-policy',
      'camera=(), microphone=(), geolocation=(), interest-cohort=()',
    );
  });

  // Cache-Control: no-store for authenticated responses
  app.addHook('onSend', async (request, reply) => {
    if (request.authContext) {
      void reply.header('cache-control', 'no-store');
    }
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
      'X-Api-Key',
    ],
    exposedHeaders: [
      'X-RateLimit-Limit',
      'X-RateLimit-Remaining',
      'X-RateLimit-Reset',
      'Retry-After',
    ],
    maxAge: 86400, // 24 hours
  });

  // Metrics plugin — before rate limit so it measures full lifecycle including auth
  if (env.METRICS_ENABLED) {
    await app.register(metricsPlugin);
  }

  // Rate limit (IP) → auth → rate limit (user) → org context → per-request RLS transaction
  // First-pass rate limit runs before auth so unauthenticated 401s are still throttled (DoS protection)
  // Second-pass rate limit runs after auth to apply higher per-user limits
  await app.register(rateLimitPlugin, { env });
  await app.register(authPlugin, { env });
  await app.register(rateLimitAuthPlugin, { env });
  await app.register(orgContextPlugin);
  await app.register(dbContextPlugin);
  await app.register(auditPlugin);

  // Webhooks — separate scopes for isolation
  await app.register(async (scope) => {
    await registerZitadelWebhooks(scope, { env });
  });
  await app.register(async (scope) => {
    await registerTusdWebhooks(scope, { env });
  });
  await app.register(async (scope) => {
    await registerStripeWebhooks(scope, { env });
  });

  await app.register(async (scope) => {
    await registerDocumensoWebhooks(scope, { env });
  });

  // Embed routes — isolated scope (own auth via token verification)
  await app.register(async (scope) => {
    await registerEmbedRoutes(scope, { env });
  });

  // Prometheus metrics endpoint — isolated scope (public, no auth/rate-limit)
  if (env.METRICS_ENABLED) {
    await app.register(async (scope) => {
      scope.get('/metrics', async (_request, reply) => {
        const output = await getMetricsOutput();
        return reply.type(getContentType()).send(output);
      });
    });
  }

  // Webhook health endpoint — isolated scope (public, no auth/rate-limit)
  await app.register(async (scope) => {
    await registerWebhookHealthRoute(scope, { env });
  });

  // Inngest serve endpoint — isolated scope (Inngest handles its own auth)
  await app.register(async (scope) => {
    await registerInngestRoutes(scope);
  });

  // Federation — isolated scopes (public endpoints)
  if (env.FEDERATION_ENABLED) {
    await app.register(async (scope) => {
      await registerFederationDiscoveryRoutes(scope, { env });
    });
    await app.register(async (scope) => {
      await registerFederationDidRoutes(scope, { env });
    });
    await app.register(async (scope) => {
      await registerFederationTrustRoutes(scope, { env });
    });
    await app.register(async (scope) => {
      await registerFederationTrustAdminRoutes(scope, { env });
    });
    await app.register(async (scope) => {
      await registerSimSubRoutes(scope, { env });
    });
    await app.register(async (scope) => {
      await registerSimSubAdminRoutes(scope, { env });
    });
    await app.register(async (scope) => {
      await registerTransferRoutes(scope, { env });
    });
    await app.register(async (scope) => {
      await registerTransferAdminRoutes(scope, { env });
    });
    await app.register(async (scope) => {
      await registerMigrationRoutes(scope, { env });
    });
    await app.register(async (scope) => {
      await registerMigrationAdminRoutes(scope, { env });
    });
    // Hub S2S routes (only active when mode = managed_hub)
    await app.register(async (scope) => {
      await registerHubRoutes(scope, { env });
    });
    // Hub admin routes (OIDC + ADMIN)
    await app.register(async (scope) => {
      await registerHubAdminRoutes(scope, { env });
    });
    // Key admin routes (OIDC — user manages own DID keys)
    await app.register(async (scope) => {
      await registerKeyAdminRoutes(scope, { env });
    });
  }

  // tRPC adapter
  await app.register(fastifyTRPCPlugin, {
    prefix: '/trpc',
    trpcOptions: {
      router: appRouter,
      createContext,
      onError({ error }: { error: { message: string; code?: string } }) {
        app.log.error(error, 'tRPC error');
        if (!error.code || error.code === 'INTERNAL_SERVER_ERROR') {
          captureException(error, { source: 'trpc' });
        }
      },
    },
  });

  // REST API (oRPC) — child scope inherits all hooks
  await app.register(registerRestRoutes);

  // SSE notification stream — inherits auth + org-context hooks (NOT db-context per skip)
  await registerNotificationStreamRoute(app, { env });

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
  app.setErrorHandler<Error>((error, request, reply) => {
    app.log.error(error);
    const statusCode =
      'statusCode' in error &&
      typeof (error as Record<string, unknown>).statusCode === 'number'
        ? ((error as Record<string, unknown>).statusCode as number)
        : 500;
    if (statusCode >= 500) {
      captureException(error, {
        url: request.url,
        method: request.method,
        userId: request.authContext?.userId,
        orgId: request.authContext?.orgId,
      });
    }
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

  // Initialize Sentry early for global exception handlers
  initSentry(env);

  const app = await buildApp(env);

  // Initialize adapters + registry
  const registry = await initAdapters(env);
  setGlobalRegistry(registry);

  // Initialize shared logger for BullMQ workers
  const { setWorkerLogger } = await import('./config/logger.js');
  setWorkerLogger(app.log);

  // Initialize Prometheus metrics (DB pool polling)
  if (env.METRICS_ENABLED) {
    initMetrics({ admin: pool, app: appPool });
    app.log.info('Prometheus metrics enabled');
  }

  // Start BullMQ workers
  if (env.VIRUS_SCAN_ENABLED) {
    startFileScanWorker(env, registry);
    app.log.info('File scan worker started');
  }
  startS3CleanupWorker(env, registry);
  app.log.info('S3 cleanup worker started');

  // Start outbox poller for Inngest event delivery
  startOutboxPollerWorker(env);
  await startOutboxPoller(env);
  app.log.info('Outbox poller worker started');

  // Start transfer fetch worker (federation file downloads with retries)
  if (env.FEDERATION_ENABLED) {
    startTransferFetchWorker(env, registry);
    app.log.info('Transfer fetch worker started');
  }

  // Start email worker when email provider is configured
  if (env.EMAIL_PROVIDER !== 'none') {
    startEmailWorker(env, registry);
    app.log.info('Email worker started');
  }

  // Start webhook delivery worker
  startWebhookWorker(env);
  app.log.info('Webhook delivery worker started');

  // Start queue depth polling for Prometheus metrics
  if (env.METRICS_ENABLED) {
    const allQueues: Array<{ name: string; queue: unknown }> = [
      { name: 'file-scan', queue: getFileScanQueueInstance() },
      { name: 's3-cleanup', queue: getS3CleanupQueueInstance() },
      { name: 'outbox-poller', queue: getOutboxPollerQueueInstance() },
      { name: 'transfer-fetch', queue: getTransferFetchQueueInstance() },
      { name: 'email', queue: getEmailQueueInstance() },
      { name: 'webhook', queue: getWebhookQueueInstance() },
    ];
    const activeQueues = allQueues.filter((q) => q.queue !== null) as Array<{
      name: string;
      queue: import('bullmq').Queue;
    }>;
    startQueueDepthPolling(activeQueues);
  }

  // Hub registration (fire-and-forget — don't block startup)
  if (env.HUB_DOMAIN && env.HUB_REGISTRATION_TOKEN) {
    hubClientService.registerWithHub(env).catch((err) => {
      app.log.warn(
        { err, hubDomain: env.HUB_DOMAIN },
        'Hub registration failed — will retry on next startup',
      );
    });
  }

  // Graceful shutdown
  const shutdown = async (signal: string) => {
    app.log.info(`Received ${signal}, shutting down gracefully...`);

    const forceExit = setTimeout(() => {
      app.log.error('Shutdown timeout exceeded, forcing exit');
      process.exit(1);
    }, 10_000);

    try {
      stopMetricsPolling();
      await app.close();
      await stopFileScanWorker();
      await stopS3CleanupWorker();
      await closeFileScanQueue();
      await closeS3CleanupQueue();
      await stopOutboxPollerWorker();
      await closeOutboxPollerQueue();
      await stopTransferFetchWorker();
      await closeTransferFetchQueue();
      await stopEmailWorker();
      await closeEmailQueue();
      await stopWebhookWorker();
      await closeWebhookQueue();
      await closeAllSSEConnections();
      await closePublisher();
      await closeSubscriber();
      await registry.destroyAll();
      await Promise.all([
        pool.end().catch(() => {}),
        appPool.end().catch(() => {}),
      ]);
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
