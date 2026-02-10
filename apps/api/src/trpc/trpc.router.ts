import { router } from './trpc.service';
import { authRouter } from './routers/auth.router';
import { submissionsRouter } from './routers/submissions.router';
import { filesRouter } from './routers/files.router';
import { paymentsRouter } from './routers/payments.router';
import { gdprRouter } from './routers/gdpr.router';
import { consentRouter } from './routers/consent.router';
import { auditRouter } from './routers/audit.router';
import { retentionRouter } from './routers/retention.router';

/**
 * Root tRPC router that merges all sub-routers.
 * This is the type that will be exported for the frontend client.
 */
export const appRouter = router({
  auth: authRouter,
  submissions: submissionsRouter,
  files: filesRouter,
  payments: paymentsRouter,
  gdpr: gdprRouter,
  consent: consentRouter,
  audit: auditRouter,
  retention: retentionRouter,
});

/**
 * Export type for use in frontend tRPC client.
 * This provides end-to-end type safety.
 */
export type AppRouter = typeof appRouter;
