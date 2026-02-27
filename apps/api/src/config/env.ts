import { z } from 'zod';

const envSchema = z.object({
  // Required
  DATABASE_URL: z
    .string()
    .min(1, 'DATABASE_URL is required')
    .startsWith('postgresql://', 'DATABASE_URL must be a postgresql:// URL'),

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

  // S3 / MinIO
  S3_ENDPOINT: z.string().default('http://localhost:9000'),
  S3_BUCKET: z.string().default('submissions'),
  S3_QUARANTINE_BUCKET: z.string().default('quarantine'),
  S3_ACCESS_KEY: z.string().default('minioadmin'),
  S3_SECRET_KEY: z.string().default('minioadmin'),
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
  ZITADEL_AUTHORITY: z.string().url().optional(),
  ZITADEL_CLIENT_ID: z.string().optional(),
  ZITADEL_WEBHOOK_SECRET: z.string().optional(),
  DEV_AUTH_BYPASS: z
    .enum(['true', 'false'])
    .default('false')
    .transform((v) => v === 'true'),
  // Federation rate limiting (per-peer)
  FEDERATION_RATE_LIMIT_MAX: z.coerce.number().int().positive().default(60),
  FEDERATION_RATE_LIMIT_WINDOW_SECONDS: z.coerce
    .number()
    .int()
    .positive()
    .default(60),

  FEDERATION_DOMAIN: z.string().optional(),
  FEDERATION_ENABLED: z
    .enum(['true', 'false'])
    .default('false')
    .transform((v) => v === 'true'),
  FEDERATION_CONTACT: z.string().email().optional(),
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
  DOCUMENSO_API_URL: z.string().url().optional(),
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

  // Plugin registry
  PLUGIN_REGISTRY_URL: z.string().url().optional(),
});

export type Env = z.infer<typeof envSchema>;

export function validateEnv(
  env: Record<string, string | undefined> = process.env,
): Env {
  return envSchema.parse(env);
}
