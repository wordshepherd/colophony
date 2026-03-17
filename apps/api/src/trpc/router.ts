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
import { pipelineRouter } from './routers/pipeline.js';
import { contractTemplatesRouter } from './routers/contract-templates.js';
import { contractsRouter } from './routers/contracts.js';
import { issuesRouter } from './routers/issues.js';
import { cmsConnectionsRouter } from './routers/cms-connections.js';
import { notificationPreferencesRouter } from './routers/notification-preferences.js';
import { notificationsRouter } from './routers/notifications.js';
import { webhooksRouter } from './routers/webhooks.js';
import { correspondenceRouter } from './routers/correspondence.js';
import { emailTemplatesRouter } from './routers/email-templates.js';
import { queuePresetsRouter } from './routers/queue-presets.js';
import { csrRouter } from './routers/csr.js';
import { externalSubmissionsRouter } from './routers/external-submissions.js';
import { writerProfilesRouter } from './routers/writer-profiles.js';
import { journalDirectoryRouter } from './routers/journal-directory.js';
import { workspaceRouter } from './routers/workspace.js';
import { federationRouter } from './routers/federation.js';
import { simsubRouter } from './routers/simsub.js';
import { transferRouter } from './routers/transfer.js';
import { migrationRouter } from './routers/migration.js';
import { hubRouter } from './routers/hub.js';

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
  pipeline: pipelineRouter,
  contractTemplates: contractTemplatesRouter,
  contracts: contractsRouter,
  issues: issuesRouter,
  cmsConnections: cmsConnectionsRouter,
  notificationPreferences: notificationPreferencesRouter,
  notifications: notificationsRouter,
  webhooks: webhooksRouter,
  correspondence: correspondenceRouter,
  emailTemplates: emailTemplatesRouter,
  queuePresets: queuePresetsRouter,
  csr: csrRouter,
  externalSubmissions: externalSubmissionsRouter,
  writerProfiles: writerProfilesRouter,
  journalDirectory: journalDirectoryRouter,
  workspace: workspaceRouter,
  federation: federationRouter,
  simsub: simsubRouter,
  transfers: transferRouter,
  migrations: migrationRouter,
  hub: hubRouter,
  retention: t.router({}),
});

export type AppRouter = typeof appRouter;
