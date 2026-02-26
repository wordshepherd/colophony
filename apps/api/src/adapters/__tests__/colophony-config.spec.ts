import { describe, it, expect } from 'vitest';
import { buildColophonyConfig } from '../../colophony.config.js';
import { SmtpEmailAdapter } from '../email/smtp-sdk.adapter.js';
import { SendGridEmailAdapter } from '../email/sendgrid-sdk.adapter.js';
import { S3StorageAdapter } from '../storage/index.js';
import { StripePaymentAdapter } from '../payment/index.js';
import type { Env } from '../../config/env.js';

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

describe('buildColophonyConfig', () => {
  it('registers SmtpEmailAdapter when EMAIL_PROVIDER=smtp', () => {
    const { config, adapterConfigs } = buildColophonyConfig(
      makeEnv({
        EMAIL_PROVIDER: 'smtp',
        SMTP_HOST: 'smtp.example.com',
        SMTP_FROM: 'noreply@example.com',
      }),
    );

    expect(config.adapters?.email).toBe(SmtpEmailAdapter);
    expect(adapterConfigs.email).toEqual(
      expect.objectContaining({
        host: 'smtp.example.com',
        from: 'noreply@example.com',
      }),
    );
  });

  it('registers SendGridEmailAdapter when EMAIL_PROVIDER=sendgrid', () => {
    const { config, adapterConfigs } = buildColophonyConfig(
      makeEnv({
        EMAIL_PROVIDER: 'sendgrid',
        SENDGRID_API_KEY: 'SG.test',
        SENDGRID_FROM: 'noreply@example.com',
      }),
    );

    expect(config.adapters?.email).toBe(SendGridEmailAdapter);
    expect(adapterConfigs.email).toEqual(
      expect.objectContaining({
        apiKey: 'SG.test',
        from: 'noreply@example.com',
      }),
    );
  });

  it('skips email adapter when EMAIL_PROVIDER=none', () => {
    const { config } = buildColophonyConfig(makeEnv());
    expect(config.adapters?.email).toBeUndefined();
  });

  it('always registers S3StorageAdapter', () => {
    const { config, adapterConfigs } = buildColophonyConfig(makeEnv());

    expect(config.adapters?.storage).toBe(S3StorageAdapter);
    expect(adapterConfigs.storage).toEqual(
      expect.objectContaining({
        endpoint: 'http://localhost:9000',
        bucket: 'submissions',
        quarantineBucket: 'quarantine',
      }),
    );
  });

  it('registers StripePaymentAdapter when keys configured', () => {
    const { config, adapterConfigs } = buildColophonyConfig(
      makeEnv({
        STRIPE_SECRET_KEY: 'sk_test_123',
        STRIPE_WEBHOOK_SECRET: 'whsec_test',
      }),
    );

    expect(config.adapters?.payment).toBe(StripePaymentAdapter);
    expect(adapterConfigs.payment).toEqual(
      expect.objectContaining({
        secretKey: 'sk_test_123',
        webhookSecret: 'whsec_test',
      }),
    );
  });

  it('skips Stripe when keys not configured', () => {
    const { config } = buildColophonyConfig(makeEnv());
    expect(config.adapters?.payment).toBeUndefined();
  });

  it('maps SMTP env vars to correct config keys', () => {
    const { adapterConfigs } = buildColophonyConfig(
      makeEnv({
        EMAIL_PROVIDER: 'smtp',
        SMTP_HOST: 'mail.test.com',
        SMTP_PORT: 465,
        SMTP_SECURE: true,
        SMTP_USER: 'user',
        SMTP_PASS: 'pass',
        SMTP_FROM: 'a@b.com',
      }),
    );

    expect(adapterConfigs.email).toEqual({
      host: 'mail.test.com',
      port: 465,
      secure: true,
      user: 'user',
      pass: 'pass',
      from: 'a@b.com',
    });
  });

  it('maps S3 env vars to correct config keys', () => {
    const { adapterConfigs } = buildColophonyConfig(makeEnv());

    expect(adapterConfigs.storage).toEqual({
      endpoint: 'http://localhost:9000',
      region: 'us-east-1',
      accessKey: 'minioadmin',
      secretKey: 'minioadmin',
      bucket: 'submissions',
      quarantineBucket: 'quarantine',
      forcePathStyle: true,
    });
  });
});
