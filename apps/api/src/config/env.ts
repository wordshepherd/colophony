import { z } from 'zod';

const envSchema = z
  .object({
    // Required
    DATABASE_URL: z
      .string()
      .min(1, 'DATABASE_URL is required')
      .startsWith('postgresql://', 'DATABASE_URL must be a postgresql:// URL'),

    // Application database connection (non-superuser, NOBYPASSRLS)
    DATABASE_APP_URL: z
      .string()
      .startsWith(
        'postgresql://',
        'DATABASE_APP_URL must be a postgresql:// URL',
      )
      .optional(),

    // Database hardening
    DB_SSL: z.enum(['true', 'false', 'no-verify']).default('false'),
    DB_SSL_CA_PATH: z.string().optional(),
    DB_ADMIN_POOL_MAX: z.coerce.number().int().positive().default(5),
    DB_APP_POOL_MAX: z.coerce.number().int().positive().default(20),

    // With defaults
    PORT: z.coerce.number().int().positive().default(4000),
    HOST: z.string().default('0.0.0.0'),
    NODE_ENV: z
      .enum(['development', 'production', 'test'])
      .default('development'),
    LOG_LEVEL: z
      .enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace'])
      .default('info'),
    REDIS_HOST: z.string().default('localhost'),
    REDIS_PORT: z.coerce.number().int().positive().default(6379),
    REDIS_PASSWORD: z.string().default(''),
    CORS_ORIGIN: z.string().default('http://localhost:3000'),

    // Rate limiting
    RATE_LIMIT_DEFAULT_MAX: z.coerce.number().int().positive().default(60),
    RATE_LIMIT_AUTH_MAX: z.coerce.number().int().positive().default(200),
    RATE_LIMIT_WINDOW_SECONDS: z.coerce.number().int().positive().default(60),
    RATE_LIMIT_KEY_PREFIX: z.string().default('colophony:rl'),

    // Per-IP auth failure throttle
    AUTH_FAILURE_THROTTLE_MAX: z.coerce.number().int().positive().default(10),
    AUTH_FAILURE_THROTTLE_WINDOW_SECONDS: z.coerce
      .number()
      .int()
      .positive()
      .default(300),

    // Webhook hardening
    WEBHOOK_TIMESTAMP_MAX_AGE_SECONDS: z.coerce
      .number()
      .int()
      .positive()
      .default(300),
    WEBHOOK_RATE_LIMIT_MAX: z.coerce.number().int().positive().default(100),

    // S3 / Garage
    S3_ENDPOINT: z.string().default('http://localhost:3900'),
    S3_BUCKET: z.string().default('submissions'),
    S3_QUARANTINE_BUCKET: z.string().default('quarantine'),
    S3_ACCESS_KEY: z.string().default('GKdeadbeef12345678abcdef00'),
    S3_SECRET_KEY: z
      .string()
      .default(
        '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef',
      ),
    S3_REGION: z.string().default('us-east-1'),
    TUS_ENDPOINT: z.string().default('http://localhost:1080/files/'),

    // ClamAV virus scanning
    CLAMAV_HOST: z.string().default('localhost'),
    CLAMAV_PORT: z.coerce.number().int().positive().default(3310),
    VIRUS_SCAN_ENABLED: z
      .enum(['true', 'false'])
      .default('true')
      .transform((v) => v === 'true'),

    // Optional — validated when modules wire up
    STRIPE_SECRET_KEY: z.string().optional(),
    STRIPE_WEBHOOK_SECRET: z.string().optional(),
    ZITADEL_AUTHORITY: z
      .string()
      .optional()
      .transform((v) => (v === '' ? undefined : v))
      .pipe(z.string().url().optional()),
    ZITADEL_CLIENT_ID: z.string().optional(),
    ZITADEL_WEBHOOK_SECRET: z.string().optional(),
    DEV_AUTH_BYPASS: z
      .enum(['true', 'false'])
      .default('false')
      .transform((v) => v === 'true'),
    DEMO_MODE: z
      .enum(['true', 'false'])
      .default('false')
      .transform((v) => v === 'true'),
    DEMO_USER_IDS: z.string().optional(),
    // Federation rate limiting (per-peer)
    FEDERATION_RATE_LIMIT_MAX: z.coerce.number().int().positive().default(60),
    FEDERATION_RATE_LIMIT_WINDOW_SECONDS: z.coerce
      .number()
      .int()
      .positive()
      .default(60),

    // Status token TTL
    STATUS_TOKEN_TTL_DAYS: z.coerce.number().int().positive().default(90),

    // Internal-only boundary, across BOTH surfaces: the seven operator-console
    // tRPC routers and the hand-rolled Fastify federation routes. True = reject
    // non-interactive credentials. False reverts to log-only, which records the
    // attempt as an API_KEY_INTERNAL_ROUTE audit event and lets it through —
    // the observation window, closed 2026-07-27.
    //
    // Carried a TRPC_ prefix until 2026-07-29, when the Fastify surface started
    // using it too. validateEnv() rejects the old name outright rather than
    // ignoring it — see RENAMED_ENV_VARS below.
    INTERNAL_ONLY_ENFORCE: z
      .enum(['true', 'false'])
      .default('true')
      .transform((v) => v === 'true'),

    FEDERATION_RATE_LIMIT_FAIL_MODE: z
      .enum(['open', 'closed', 'fallback'])
      .default('open'),

    FEDERATION_DOMAIN: z.string().optional(),
    FEDERATION_ENABLED: z
      .enum(['true', 'false'])
      .default('false')
      .transform((v) => v === 'true'),
    FEDERATION_CONTACT: z
      .string()
      .optional()
      .transform((v) => (v === '' ? undefined : v))
      .pipe(z.string().email().optional()),
    FEDERATION_PRIVATE_KEY: z.string().optional(),
    FEDERATION_PUBLIC_KEY: z.string().optional(),

    // Inngest workflow engine
    INNGEST_EVENT_KEY: z.string().optional(),
    INNGEST_SIGNING_KEY: z.string().optional(),
    INNGEST_DEV: z
      .enum(['true', 'false'])
      .default('false')
      .transform((v) => v === 'true'),

    // Documenso contract signing
    DOCUMENSO_API_URL: z
      .string()
      .optional()
      .transform((v) => (v === '' ? undefined : v))
      .pipe(z.string().url().optional()),
    DOCUMENSO_API_KEY: z.string().optional(),
    DOCUMENSO_WEBHOOK_SECRET: z.string().optional(),

    // Federation hub (managed hosting)
    HUB_DOMAIN: z.string().optional(),
    HUB_REGISTRATION_TOKEN: z.string().optional(),

    // Email / Relay
    EMAIL_PROVIDER: z.enum(['smtp', 'sendgrid', 'none']).default('none'),
    SMTP_HOST: z.string().optional(),
    SMTP_PORT: z.coerce.number().int().positive().optional(),
    SMTP_USER: z.string().optional(),
    SMTP_PASS: z.string().optional(),
    SMTP_FROM: z.string().optional(),
    SMTP_SECURE: z
      .enum(['true', 'false'])
      .default('false')
      .transform((v) => v === 'true'),
    SENDGRID_API_KEY: z.string().optional(),
    SENDGRID_FROM: z.string().optional(),

    // Demo request notifications
    DEMO_NOTIFY_EMAIL: z.string().email().optional(),

    // Monitoring — Sentry
    SENTRY_DSN: z
      .string()
      .optional()
      .transform((v) => (v === '' ? undefined : v))
      .pipe(z.string().url().optional()),
    SENTRY_ENVIRONMENT: z.string().default('development'),
    SENTRY_TRACES_SAMPLE_RATE: z.coerce.number().min(0).max(1).default(0),
    SENTRY_RELEASE: z.string().optional(),

    // Monitoring — Prometheus
    METRICS_ENABLED: z
      .enum(['true', 'false'])
      .default('false')
      .transform((v) => v === 'true'),

    // Monitoring — Webhook health staleness thresholds (seconds)
    WEBHOOK_HEALTH_ZITADEL_STALE_SECONDS: z.coerce
      .number()
      .int()
      .positive()
      .default(3600),
    WEBHOOK_HEALTH_STRIPE_STALE_SECONDS: z.coerce
      .number()
      .int()
      .positive()
      .default(86400),
    WEBHOOK_HEALTH_DOCUMENSO_STALE_SECONDS: z.coerce
      .number()
      .int()
      .positive()
      .default(86400),
  })
  .refine(
    (env) =>
      env.NODE_ENV !== 'production' || env.DATABASE_APP_URL !== undefined,
    {
      message:
        'DATABASE_APP_URL is required in production to enforce RLS. ' +
        'Set it to a non-superuser (NOBYPASSRLS) connection string.',
      path: ['DATABASE_APP_URL'],
    },
  );

export type Env = z.infer<typeof envSchema>;

/**
 * Environment variables that were renamed, mapped to their replacement.
 *
 * A removed name that is merely ignored is worse than one that fails: the schema
 * default silently takes over, so an operator who set the old variable to
 * override a default finds the default back in force with nothing to indicate it.
 * For INTERNAL_ONLY_ENFORCE specifically, that means someone who set `false` to
 * keep a surface reachable gets it closed with no signal. Fail at startup
 * instead, naming the replacement.
 */
const RENAMED_ENV_VARS: Record<string, string> = {
  TRPC_INTERNAL_ONLY_ENFORCE: 'INTERNAL_ONLY_ENFORCE',
};

export function validateEnv(
  env: Record<string, string | undefined> = process.env,
): Env {
  for (const [legacy, replacement] of Object.entries(RENAMED_ENV_VARS)) {
    // Empty counts as absent, and that is load-bearing rather than defensive.
    // Compose injects only the variables named in a service's `environment:`
    // block, so `docker-compose.prod.yml` has to pass each legacy name through
    // explicitly for this check to see it at all — and a pass-through of an unset
    // variable arrives as `''`, not undefined. Treating `''` as set would throw
    // on every deployment that had already migrated.
    if ((env[legacy] ?? '') !== '') {
      throw new Error(
        `${legacy} has been renamed to ${replacement}. It is no longer read, ` +
          `so leaving it set would silently restore the default — which for ` +
          `INTERNAL_ONLY_ENFORCE means closing a surface an operator meant to ` +
          `keep open. Rename it wherever it is set: your .env file, and the ` +
          `${replacement} line in docker-compose.prod.yml.`,
      );
    }
  }

  return envSchema.parse(env);
}
