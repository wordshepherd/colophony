import { AdapterRegistry } from '@colophony/plugin-sdk';
import type { Env } from './config/env.js';
import { SmtpEmailAdapter } from './adapters/email/smtp-sdk.adapter.js';
import { SendGridEmailAdapter } from './adapters/email/sendgrid-sdk.adapter.js';
import { S3StorageAdapter } from './adapters/storage/index.js';
import { StripePaymentAdapter } from './adapters/payment/index.js';

export async function initAdapters(env: Env): Promise<AdapterRegistry> {
  const registry = new AdapterRegistry();

  // Email adapter
  if (env.EMAIL_PROVIDER === 'smtp') {
    const adapter = new SmtpEmailAdapter();
    await adapter.initialize({
      host: env.SMTP_HOST ?? '',
      port: env.SMTP_PORT ?? 587,
      secure: env.SMTP_SECURE ?? false,
      user: env.SMTP_USER,
      pass: env.SMTP_PASS,
      from: env.SMTP_FROM ?? '',
    });
    registry.register('email', adapter);
  } else if (env.EMAIL_PROVIDER === 'sendgrid') {
    const adapter = new SendGridEmailAdapter();
    await adapter.initialize({
      apiKey: env.SENDGRID_API_KEY ?? '',
      from: env.SENDGRID_FROM ?? '',
    });
    registry.register('email', adapter);
  }

  // S3 storage adapter (always registered)
  const storageAdapter = new S3StorageAdapter();
  await storageAdapter.initialize({
    endpoint: env.S3_ENDPOINT,
    region: env.S3_REGION,
    accessKey: env.S3_ACCESS_KEY,
    secretKey: env.S3_SECRET_KEY,
    bucket: env.S3_BUCKET,
    quarantineBucket: env.S3_QUARANTINE_BUCKET,
    forcePathStyle: true,
  });
  registry.register('storage', storageAdapter);

  // Stripe payment adapter (when configured)
  if (env.STRIPE_SECRET_KEY && env.STRIPE_WEBHOOK_SECRET) {
    const paymentAdapter = new StripePaymentAdapter();
    await paymentAdapter.initialize({
      secretKey: env.STRIPE_SECRET_KEY,
      webhookSecret: env.STRIPE_WEBHOOK_SECRET,
      timestampToleranceSeconds: env.WEBHOOK_TIMESTAMP_MAX_AGE_SECONDS,
    });
    registry.register('payment', paymentAdapter);
  }

  return registry;
}
