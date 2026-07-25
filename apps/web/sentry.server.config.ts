import * as Sentry from "@sentry/nextjs";

import { getServerEnv } from "@/env";

const env = getServerEnv();

Sentry.init({
  dsn: env.SENTRY_DSN || undefined,
  environment: env.SENTRY_ENVIRONMENT,
  tracesSampleRate: env.SENTRY_TRACES_SAMPLE_RATE,
  enabled: !!env.SENTRY_DSN,
});
