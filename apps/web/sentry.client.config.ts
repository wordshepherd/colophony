import * as Sentry from "@sentry/nextjs";

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  environment: process.env.NEXT_PUBLIC_SENTRY_ENVIRONMENT ?? "development",
  tracesSampleRate: parseFloat(
    process.env.NEXT_PUBLIC_SENTRY_TRACES_SAMPLE_RATE ?? "0",
  ),
  enabled: !!process.env.NEXT_PUBLIC_SENTRY_DSN,
  // Disable replay — not needed for this project
  replaysSessionSampleRate: 0,
  replaysOnErrorSampleRate: 0,
});
