import { t } from './init.js';
import { organizationsRouter } from './routers/organizations.js';
import { usersRouter } from './routers/users.js';
import { submissionsRouter } from './routers/submissions.js';
import { filesRouter } from './routers/files.js';
import { apiKeysRouter } from './routers/api-keys.js';
import { auditRouter } from './routers/audit.js';

// Re-export procedure builders for convenience
export {
  publicProcedure,
  authedProcedure,
  orgProcedure,
  adminProcedure,
  createRouter,
  mergeRouters,
} from './init.js';

// ---------------------------------------------------------------------------
// App router
// ---------------------------------------------------------------------------

export const appRouter = t.router({
  health: t.procedure.query(() => ({ status: 'ok' as const })),
  organizations: organizationsRouter,
  users: usersRouter,
  submissions: submissionsRouter,
  files: filesRouter,
  apiKeys: apiKeysRouter,
  payments: t.router({}),
  gdpr: t.router({}),
  consent: t.router({}),
  audit: auditRouter,
  retention: t.router({}),
});

export type AppRouter = typeof appRouter;
