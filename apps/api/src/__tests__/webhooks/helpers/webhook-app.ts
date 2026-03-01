import Fastify from 'fastify';
import type { FastifyInstance } from 'fastify';
import type { Env } from '../../../config/env.js';
import { registerStripeWebhooks } from '../../../webhooks/stripe.webhook.js';
import { registerZitadelWebhooks } from '../../../webhooks/zitadel.webhook.js';
import { registerTusdWebhooks } from '../../../webhooks/tusd.webhook.js';

/**
 * Build a full Env object suitable for webhook integration tests.
 * All optional fields have safe test defaults. Overrides let individual
 * tests toggle specific knobs (e.g. VIRUS_SCAN_ENABLED).
 */
export function createTestEnv(overrides?: Partial<Env>): Env {
  return {
    DATABASE_URL:
      process.env.DATABASE_APP_URL ??
      'postgresql://app_user:app_password@localhost:5433/colophony_test',
    PORT: 0,
    HOST: '127.0.0.1',
    NODE_ENV: 'test',
    LOG_LEVEL: 'error',
    REDIS_HOST: 'localhost',
    REDIS_PORT: 6379,
    REDIS_PASSWORD: '',
    CORS_ORIGIN: 'http://localhost:3000',
    RATE_LIMIT_DEFAULT_MAX: 10000,
    RATE_LIMIT_AUTH_MAX: 10000,
    RATE_LIMIT_WINDOW_SECONDS: 60,
    RATE_LIMIT_KEY_PREFIX: 'colophony:test:rl',
    AUTH_FAILURE_THROTTLE_MAX: 10000,
    AUTH_FAILURE_THROTTLE_WINDOW_SECONDS: 300,
    WEBHOOK_TIMESTAMP_MAX_AGE_SECONDS: 300,
    WEBHOOK_RATE_LIMIT_MAX: 10000,
    S3_ENDPOINT: 'http://localhost:9000',
    S3_BUCKET: 'submissions',
    S3_QUARANTINE_BUCKET: 'quarantine',
    S3_ACCESS_KEY: 'minioadmin',
    S3_SECRET_KEY: 'minioadmin',
    S3_REGION: 'us-east-1',
    TUS_ENDPOINT: 'http://localhost:1080/files/',
    CLAMAV_HOST: 'localhost',
    CLAMAV_PORT: 3310,
    VIRUS_SCAN_ENABLED: false,
    STRIPE_SECRET_KEY: 'sk_test_fake_key_for_integration_tests',
    STRIPE_WEBHOOK_SECRET: 'whsec_test_fake_secret_for_integration_tests',
    ZITADEL_AUTHORITY: undefined,
    ZITADEL_CLIENT_ID: undefined,
    ZITADEL_WEBHOOK_SECRET: 'test-webhook-secret-32-characters!',
    DEV_AUTH_BYPASS: false,
    FEDERATION_DOMAIN: undefined,
    FEDERATION_ENABLED: false,
    FEDERATION_RATE_LIMIT_MAX: 60,
    FEDERATION_RATE_LIMIT_WINDOW_SECONDS: 60,
    INNGEST_DEV: false,
    EMAIL_PROVIDER: 'none' as const,
    SMTP_SECURE: false,
    SENTRY_ENVIRONMENT: 'test',
    SENTRY_TRACES_SAMPLE_RATE: 0,
    METRICS_ENABLED: false,
    STATUS_TOKEN_TTL_DAYS: 90,
    FEDERATION_RATE_LIMIT_FAIL_MODE: 'open' as const,
    ...overrides,
  };
}

/**
 * Build a Fastify instance with all three webhook routes registered
 * in isolated scopes (same pattern as main.ts lines 119-127).
 */
export async function buildWebhookApp(
  envOverrides?: Partial<Env>,
): Promise<FastifyInstance> {
  const env = createTestEnv(envOverrides);

  const app = Fastify({
    logger: false,
  });

  // Register webhooks in isolated scopes (matches main.ts)
  await app.register(async (scope) => {
    await registerZitadelWebhooks(scope, { env });
  });
  await app.register(async (scope) => {
    await registerTusdWebhooks(scope, { env });
  });
  await app.register(async (scope) => {
    await registerStripeWebhooks(scope, { env });
  });

  await app.ready();
  return app;
}
