import { z } from 'zod';
import { t } from './init.js';
import { organizationsRouter } from './routers/organizations.js';
import { usersRouter } from './routers/users.js';
import { submissionsRouter } from './routers/submissions.js';
import { filesRouter } from './routers/files.js';
import { apiKeysRouter } from './routers/api-keys.js';
import { auditRouter } from './routers/audit.js';
import { formsRouter } from './routers/forms.js';
import { periodsRouter } from './routers/periods.js';
import { manuscriptsRouter } from './routers/manuscripts.js';
import { embedTokensRouter } from './routers/embed-tokens.js';
import { gdprRouter } from './routers/gdpr.js';
import { publicationsRouter } from './routers/publications.js';

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
  health: t.procedure
    .output(z.object({ status: z.literal('ok') }))
    .query(() => ({ status: 'ok' as const })),
  organizations: organizationsRouter,
  users: usersRouter,
  submissions: submissionsRouter,
  manuscripts: manuscriptsRouter,
  files: filesRouter,
  apiKeys: apiKeysRouter,
  payments: t.router({}),
  gdpr: gdprRouter,
  consent: t.router({}),
  audit: auditRouter,
  forms: formsRouter,
  periods: periodsRouter,
  embedTokens: embedTokensRouter,
  publications: publicationsRouter,
  retention: t.router({}),
});

export type AppRouter = typeof appRouter;
