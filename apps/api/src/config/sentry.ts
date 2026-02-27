import * as Sentry from '@sentry/node';
import type { Env } from './env.js';

let initialized = false;

export function initSentry(env: Env): void {
  if (initialized) return;
  if (!env.SENTRY_DSN) return;

  Sentry.init({
    dsn: env.SENTRY_DSN,
    environment: env.SENTRY_ENVIRONMENT,
    release: env.SENTRY_RELEASE,
    tracesSampleRate: env.SENTRY_TRACES_SAMPLE_RATE,
    integrations: [
      Sentry.onUncaughtExceptionIntegration(),
      Sentry.onUnhandledRejectionIntegration(),
    ],
    beforeSend(event) {
      // Scrub authorization headers from breadcrumbs
      if (event.breadcrumbs) {
        for (const breadcrumb of event.breadcrumbs) {
          const headers = breadcrumb.data?.headers as
            | Record<string, unknown>
            | undefined;
          if (headers) {
            delete headers.authorization;
            delete headers['x-api-key'];
          }
        }
      }
      return event;
    },
  });

  initialized = true;
}

export function captureException(
  error: unknown,
  context?: Record<string, unknown>,
): void {
  if (!initialized) return;
  Sentry.captureException(error, context ? { extra: context } : undefined);
}

export function isSentryEnabled(): boolean {
  return initialized;
}
