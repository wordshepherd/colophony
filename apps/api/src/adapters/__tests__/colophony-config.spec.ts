import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Env } from '../../config/env.js';

// Mock adapters — prevent real SDK/network initialization
const mockInitialize = vi.fn();
const mockAdapter = {
  id: 'test',
  name: 'test',
  version: '1.0.0',
  initialize: mockInitialize,
  healthCheck: vi.fn(),
  destroy: vi.fn(),
  configSchema: {} as never,
};

vi.mock('../email/smtp-sdk.adapter.js', () => ({
  SmtpEmailAdapter: function SmtpEmailAdapter() {
    return { ...mockAdapter, id: 'smtp', name: 'SMTP' };
  },
}));

vi.mock('../email/sendgrid-sdk.adapter.js', () => ({
  SendGridEmailAdapter: function SendGridEmailAdapter() {
    return { ...mockAdapter, id: 'sendgrid', name: 'SendGrid' };
  },
}));

vi.mock('../storage/index.js', () => ({
  S3StorageAdapter: function S3StorageAdapter() {
    return { ...mockAdapter, id: 's3', name: 'S3' };
  },
}));

vi.mock('../payment/index.js', () => ({
  StripePaymentAdapter: function StripePaymentAdapter() {
    return { ...mockAdapter, id: 'stripe', name: 'Stripe' };
  },
}));

import { initAdapters } from '../../colophony.config.js';

function makeEnv(overrides: Partial<Env> = {}): Env {
  return {
    EMAIL_PROVIDER: 'none',
    S3_ENDPOINT: 'http://localhost:9000',
    S3_REGION: 'us-east-1',
    S3_ACCESS_KEY: 'minioadmin',
    S3_SECRET_KEY: 'minioadmin',
    S3_BUCKET: 'submissions',
    S3_QUARANTINE_BUCKET: 'quarantine',
    WEBHOOK_TIMESTAMP_MAX_AGE_SECONDS: 300,
    ...overrides,
  } as Env;
}

describe('initAdapters', () => {
  beforeEach(() => {
    mockInitialize.mockClear();
  });

  it('registers email adapter when EMAIL_PROVIDER=smtp', async () => {
    const registry = await initAdapters(
      makeEnv({
        EMAIL_PROVIDER: 'smtp',
        SMTP_HOST: 'smtp.example.com',
        SMTP_FROM: 'noreply@example.com',
      }),
    );

    expect(registry.has('email')).toBe(true);
    expect(mockInitialize).toHaveBeenCalledWith(
      expect.objectContaining({
        host: 'smtp.example.com',
        from: 'noreply@example.com',
      }),
    );
  });

  it('registers email adapter when EMAIL_PROVIDER=sendgrid', async () => {
    const registry = await initAdapters(
      makeEnv({
        EMAIL_PROVIDER: 'sendgrid',
        SENDGRID_API_KEY: 'SG.test',
        SENDGRID_FROM: 'noreply@example.com',
      }),
    );

    expect(registry.has('email')).toBe(true);
    expect(mockInitialize).toHaveBeenCalledWith(
      expect.objectContaining({
        apiKey: 'SG.test',
        from: 'noreply@example.com',
      }),
    );
  });

  it('skips email adapter when EMAIL_PROVIDER=none', async () => {
    const registry = await initAdapters(makeEnv());
    expect(registry.has('email')).toBe(false);
  });

  it('always registers storage adapter', async () => {
    const registry = await initAdapters(makeEnv());

    expect(registry.has('storage')).toBe(true);
    expect(mockInitialize).toHaveBeenCalledWith(
      expect.objectContaining({
        endpoint: 'http://localhost:9000',
        bucket: 'submissions',
        quarantineBucket: 'quarantine',
      }),
    );
  });

  it('registers payment adapter when Stripe keys configured', async () => {
    const registry = await initAdapters(
      makeEnv({
        STRIPE_SECRET_KEY: 'sk_test_123',
        STRIPE_WEBHOOK_SECRET: 'whsec_test',
      }),
    );

    expect(registry.has('payment')).toBe(true);
    expect(mockInitialize).toHaveBeenCalledWith(
      expect.objectContaining({
        secretKey: 'sk_test_123',
        webhookSecret: 'whsec_test',
      }),
    );
  });

  it('skips payment adapter when Stripe keys not configured', async () => {
    const registry = await initAdapters(makeEnv());
    expect(registry.has('payment')).toBe(false);
  });
});
