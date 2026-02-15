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

  // Webhook hardening
  WEBHOOK_TIMESTAMP_MAX_AGE_SECONDS: z.coerce
    .number()
    .int()
    .positive()
    .default(300),
  WEBHOOK_RATE_LIMIT_MAX: z.coerce.number().int().positive().default(100),

  // Optional — validated when modules wire up
  STRIPE_SECRET_KEY: z.string().optional(),
  STRIPE_WEBHOOK_SECRET: z.string().optional(),
  ZITADEL_AUTHORITY: z.string().url().optional(),
  ZITADEL_CLIENT_ID: z.string().optional(),
  ZITADEL_WEBHOOK_SECRET: z.string().optional(),
  FEDERATION_DOMAIN: z.string().optional(),
  FEDERATION_ENABLED: z
    .enum(['true', 'false'])
    .transform((v) => v === 'true')
    .optional(),
});

export type Env = z.infer<typeof envSchema>;

export function validateEnv(
  env: Record<string, string | undefined> = process.env,
): Env {
  return envSchema.parse(env);
}
