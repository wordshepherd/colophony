import * as Sentry from "@sentry/nextjs";

import { clientEnv } from "@/env";

Sentry.init({
  dsn: clientEnv.NEXT_PUBLIC_SENTRY_DSN || undefined,
  environment: clientEnv.NEXT_PUBLIC_SENTRY_ENVIRONMENT,
  tracesSampleRate: clientEnv.NEXT_PUBLIC_SENTRY_TRACES_SAMPLE_RATE,
  enabled: !!clientEnv.NEXT_PUBLIC_SENTRY_DSN,
  // Disable replay — not needed for this project
  replaysSessionSampleRate: 0,
  replaysOnErrorSampleRate: 0,
});
