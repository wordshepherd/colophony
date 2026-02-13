import { t } from './init.js';
import { organizationsRouter } from './routers/organizations.js';

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
  auth: t.router({}),
  submissions: t.router({}),
  files: t.router({}),
  payments: t.router({}),
  gdpr: t.router({}),
  consent: t.router({}),
  audit: t.router({}),
  retention: t.router({}),
});

export type AppRouter = typeof appRouter;
