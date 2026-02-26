import type { ColophonyConfig, AdapterType } from '@colophony/plugin-sdk';
import type { Env } from './config/env.js';
import { SmtpEmailAdapter } from './adapters/email/smtp-sdk.adapter.js';
import { SendGridEmailAdapter } from './adapters/email/sendgrid-sdk.adapter.js';
import { S3StorageAdapter } from './adapters/storage/index.js';
import { StripePaymentAdapter } from './adapters/payment/index.js';

export function buildColophonyConfig(env: Env): {
  config: ColophonyConfig;
  adapterConfigs: Partial<Record<AdapterType, Record<string, unknown>>>;
} {
  const config: ColophonyConfig = { adapters: {} };
  const adapterConfigs: Partial<Record<AdapterType, Record<string, unknown>>> =
    {};

  // Email adapter
  if (env.EMAIL_PROVIDER === 'smtp') {
    config.adapters!.email = SmtpEmailAdapter;
    adapterConfigs.email = {
      host: env.SMTP_HOST ?? '',
      port: env.SMTP_PORT ?? 587,
      secure: env.SMTP_SECURE ?? false,
      user: env.SMTP_USER,
      pass: env.SMTP_PASS,
      from: env.SMTP_FROM ?? '',
    };
  } else if (env.EMAIL_PROVIDER === 'sendgrid') {
    config.adapters!.email = SendGridEmailAdapter;
    adapterConfigs.email = {
      apiKey: env.SENDGRID_API_KEY ?? '',
      from: env.SENDGRID_FROM ?? '',
    };
  }

  // S3 storage adapter (always registered)
  config.adapters!.storage = S3StorageAdapter;
  adapterConfigs.storage = {
    endpoint: env.S3_ENDPOINT,
    region: env.S3_REGION,
    accessKey: env.S3_ACCESS_KEY,
    secretKey: env.S3_SECRET_KEY,
    bucket: env.S3_BUCKET,
    quarantineBucket: env.S3_QUARANTINE_BUCKET,
    forcePathStyle: true,
  };

  // Stripe payment adapter (when configured)
  if (env.STRIPE_SECRET_KEY && env.STRIPE_WEBHOOK_SECRET) {
    config.adapters!.payment = StripePaymentAdapter;
    adapterConfigs.payment = {
      secretKey: env.STRIPE_SECRET_KEY,
      webhookSecret: env.STRIPE_WEBHOOK_SECRET,
      timestampToleranceSeconds: env.WEBHOOK_TIMESTAMP_MAX_AGE_SECONDS,
    };
  }

  return { config, adapterConfigs };
}
