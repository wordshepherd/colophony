import { t, type AnyRouter } from './init.js';
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

export const appRouter: AnyRouter = t.router({
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

// Using AnyRouter avoids TS2742 (non-portable inferred type) under NodeNext.
// Refine to `typeof appRouter` when TS2742 is confirmed absent.
export type AppRouter = AnyRouter;
