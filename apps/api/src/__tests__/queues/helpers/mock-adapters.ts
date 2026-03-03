import { vi } from 'vitest';
import type { Env } from '../../../config/env';

export function createMockStorage() {
  return {
    id: 'mock-s3',
    name: 'Mock S3',
    version: '1.0.0',
    configSchema: {} as any,
    defaultBucket: 'submissions',
    quarantineBucket: 'quarantine',
    initialize: vi.fn().mockResolvedValue(undefined),
    healthCheck: vi.fn().mockResolvedValue({ healthy: true, message: 'ok' }),
    destroy: vi.fn().mockResolvedValue(undefined),
    upload: vi.fn().mockResolvedValue({ key: 'test', size: 100 }),
    download: vi.fn(),
    delete: vi.fn().mockResolvedValue(undefined),
    exists: vi.fn().mockResolvedValue(true),
    getSignedUrl: vi.fn().mockResolvedValue('https://example.com/signed'),
    move: vi.fn().mockResolvedValue(undefined),
    downloadFromBucket: vi.fn(),
    deleteFromBucket: vi.fn().mockResolvedValue(undefined),
    uploadToBucket: vi.fn().mockResolvedValue(undefined),
    getSignedUrlFromBucket: vi
      .fn()
      .mockResolvedValue('https://example.com/signed'),
    moveBetweenBuckets: vi.fn().mockResolvedValue(undefined),
  };
}

export function createMockEmailAdapter() {
  return {
    id: 'mock-email',
    name: 'Mock Email',
    version: '1.0.0',
    configSchema: {} as any,
    initialize: vi.fn().mockResolvedValue(undefined),
    healthCheck: vi.fn().mockResolvedValue({ healthy: true, message: 'ok' }),
    destroy: vi.fn().mockResolvedValue(undefined),
    send: vi
      .fn()
      .mockResolvedValue({ success: true, messageId: 'msg-test-123' }),
  };
}

export function createMockRegistry(adapters: Record<string, unknown>) {
  return {
    resolve: vi.fn((type: string) => {
      const adapter = adapters[type];
      if (!adapter) throw new Error(`No adapter registered for type: ${type}`);
      return adapter;
    }),
    tryResolve: vi.fn((type: string) => adapters[type] ?? null),
    has: vi.fn((type: string) => type in adapters),
    register: vi.fn(),
    listRegistered: vi.fn().mockReturnValue([]),
    listAllTypes: vi.fn().mockReturnValue(Object.keys(adapters)),
    destroyAll: vi.fn().mockResolvedValue(undefined),
  };
}

export function createTestEnv(overrides?: Partial<Env>): Env {
  return {
    DATABASE_URL:
      process.env.DATABASE_URL ??
      'postgresql://app_user:app_password@localhost:5433/colophony_test',
    PORT: 4000,
    HOST: '0.0.0.0',
    NODE_ENV: 'test',
    LOG_LEVEL: 'error',
    REDIS_HOST: process.env.REDIS_HOST ?? 'localhost',
    REDIS_PORT: Number(process.env.REDIS_PORT ?? 6379),
    REDIS_PASSWORD: process.env.REDIS_PASSWORD ?? '',
    CORS_ORIGIN: 'http://localhost:3000',
    RATE_LIMIT_DEFAULT_MAX: 60,
    RATE_LIMIT_AUTH_MAX: 200,
    RATE_LIMIT_WINDOW_SECONDS: 60,
    RATE_LIMIT_KEY_PREFIX: 'colophony:rl',
    AUTH_FAILURE_THROTTLE_MAX: 10,
    AUTH_FAILURE_THROTTLE_WINDOW_SECONDS: 300,
    WEBHOOK_TIMESTAMP_MAX_AGE_SECONDS: 300,
    WEBHOOK_RATE_LIMIT_MAX: 100,
    S3_ENDPOINT: 'http://localhost:9000',
    S3_BUCKET: 'submissions',
    S3_QUARANTINE_BUCKET: 'quarantine',
    S3_ACCESS_KEY: 'minioadmin',
    S3_SECRET_KEY: 'minioadmin',
    S3_REGION: 'us-east-1',
    TUS_ENDPOINT: 'http://localhost:1080/files/',
    CLAMAV_HOST: 'localhost',
    CLAMAV_PORT: 3310,
    VIRUS_SCAN_ENABLED: true,
    DEV_AUTH_BYPASS: false,
    FEDERATION_RATE_LIMIT_MAX: 60,
    FEDERATION_RATE_LIMIT_WINDOW_SECONDS: 60,
    STATUS_TOKEN_TTL_DAYS: 90,
    FEDERATION_RATE_LIMIT_FAIL_MODE: 'open',
    FEDERATION_ENABLED: false,
    INNGEST_DEV: false,
    SMTP_SECURE: false,
    EMAIL_PROVIDER: 'none',
    METRICS_ENABLED: false,
    SENTRY_ENVIRONMENT: 'test',
    SENTRY_TRACES_SAMPLE_RATE: 0,
    ...overrides,
  } as Env;
}
