# Key File Locations

Quick-reference index of important files across the codebase.

## Core Packages

| What                    | Path                                                                                       |
| ----------------------- | ------------------------------------------------------------------------------------------ |
| **Drizzle schema**      | `packages/db/src/schema/` (one file per table group)                                       |
| **Drizzle migrations**  | `packages/db/migrations/`                                                                  |
| **Drizzle client**      | `packages/db/src/client.ts`                                                                |
| **RLS context**         | `packages/db/src/context.ts` (`withRls()`)                                                 |
| **Shared Zod schemas**  | `packages/types/src/`                                                                      |
| **Zitadel auth client** | `packages/auth-client/src/`                                                                |
| **Plugin SDK**          | `packages/plugin-sdk/src/` (adapters, hooks, config, plugin-base, testing)                 |
| **Writer workspace**    | `packages/db/src/schema/writer-workspace.ts`                                               |
| **CSR types**           | `packages/types/src/csr.ts`                                                                |
| **ProseMirror types**   | `packages/types/src/prosemirror.ts` (shared), `apps/web/src/lib/manuscript.ts` (converter) |

## API (`apps/api/`)

| What                       | Path                                                                                     |
| -------------------------- | ---------------------------------------------------------------------------------------- |
| **Fastify app entry**      | `apps/api/src/main.ts`                                                                   |
| **Fastify hooks**          | `apps/api/src/hooks/` (auth, rate-limit, org-context, db-context, audit)                 |
| **Service layer**          | `apps/api/src/services/`                                                                 |
| **tRPC (internal)**        | `apps/api/src/trpc/`                                                                     |
| **Zitadel webhook**        | `apps/api/src/webhooks/zitadel.webhook.ts`                                               |
| **Stripe webhook**         | `apps/api/src/webhooks/stripe.webhook.ts`                                                |
| **Documenso webhook**      | `apps/api/src/webhooks/documenso.webhook.ts`                                             |
| **Inngest functions**      | `apps/api/src/inngest/`                                                                  |
| **Adapter registry**       | `apps/api/src/adapters/registry-accessor.ts` (module-level singleton)                    |
| **Config builder**         | `apps/api/src/colophony.config.ts` (maps env → adapter init)                             |
| **SDK adapters**           | `apps/api/src/adapters/{email,storage,payment}/` (SDK-compatible)                        |
| **CMS adapters**           | `apps/api/src/adapters/cms/`                                                             |
| **Env config (Zod)**       | `apps/api/src/config/env.ts`                                                             |
| **SSRF validation**        | `apps/api/src/lib/url-validation.ts` (validateOutboundUrl, isPrivateIPv4/v6)             |
| **Sentry config**          | `apps/api/src/config/sentry.ts` (init, captureException, isSentryEnabled)                |
| **Metrics registry**       | `apps/api/src/config/metrics.ts` (Prometheus counters, histograms, gauges)               |
| **Metrics plugin**         | `apps/api/src/hooks/metrics.ts` (Fastify plugin — HTTP request instrumentation)          |
| **Instrumented worker**    | `apps/api/src/config/instrumented-worker.ts` (BullMQ wrapper with metrics)               |
| **Webhook health**         | `apps/api/src/webhooks/webhook-health.route.ts`                                          |
| **Ops tRPC router**        | `apps/api/src/trpc/routers/ops.ts` (queueHealth, webhookProviderHealth, submissionTrend) |
| **Content converters**     | `apps/api/src/converters/` (text, docx, smart-typography, format router)                 |
| **Content extract queue**  | `apps/api/src/queues/content-extract.queue.ts`                                           |
| **Content extract worker** | `apps/api/src/workers/content-extract.worker.ts` (4-phase extraction)                    |
| **Content extract svc**    | `apps/api/src/services/content-extraction.service.ts`                                    |
| **CSR service**            | `apps/api/src/services/csr.service.ts` (export/import for data portability)              |
| **Analytics service**      | `apps/api/src/services/submission-analytics.service.ts`                                  |
| **Portfolio service**      | `apps/api/src/services/portfolio.service.ts` (cross-org UNION ALL, status maps)          |
| **Writer analytics svc**   | `apps/api/src/services/writer-analytics.service.ts` (personal stats/charts)              |

## Federation (`apps/api/src/federation/`)

| What                    | Path                                                                             |
| ----------------------- | -------------------------------------------------------------------------------- |
| **Discovery**           | `apps/api/src/federation/discovery.routes.ts`                                    |
| **DID**                 | `apps/api/src/federation/did.routes.ts`                                          |
| **Federation service**  | `apps/api/src/services/federation.service.ts`                                    |
| **Trust**               | `apps/api/src/federation/trust.routes.ts` (S2S), `trust-admin.routes.ts`         |
| **Trust service**       | `apps/api/src/services/trust.service.ts`                                         |
| **HTTP signatures**     | `apps/api/src/federation/http-signatures.ts`                                     |
| **Federation auth**     | `apps/api/src/federation/federation-auth.ts` (S2S signature middleware)          |
| **Sim-sub (BSAP)**      | `apps/api/src/federation/simsub.routes.ts` (S2S), `simsub-admin.routes.ts`       |
| **Sim-sub service**     | `apps/api/src/services/simsub.service.ts`                                        |
| **Fingerprint service** | `apps/api/src/services/fingerprint.service.ts`                                   |
| **Transfer routes**     | `apps/api/src/federation/transfer.routes.ts` (S2S), `transfer-admin.routes.ts`   |
| **Transfer service**    | `apps/api/src/services/transfer.service.ts`                                      |
| **Migration routes**    | `apps/api/src/federation/migration.routes.ts` (S2S), `migration-admin.routes.ts` |
| **Migration service**   | `apps/api/src/services/migration.service.ts`, `migration-bundle.service.ts`      |
| **Hub routes**          | `apps/api/src/federation/hub.routes.ts` (S2S), `hub-admin.routes.ts`             |
| **Hub auth**            | `apps/api/src/federation/hub-auth.ts` (S2S hub auth middleware)                  |
| **Hub service**         | `apps/api/src/services/hub.service.ts`                                           |
| **Hub client service**  | `apps/api/src/services/hub-client.service.ts`                                    |

## Frontend (`apps/web/`)

| What                      | Path                                                                                        |
| ------------------------- | ------------------------------------------------------------------------------------------- |
| **Next.js frontend**      | `apps/web/`                                                                                 |
| **tRPC client**           | `apps/web/src/lib/trpc.ts`                                                                  |
| **Analytics components**  | `apps/web/src/components/analytics/` (charts, filters, dashboard page)                      |
| **Writer analytics UI**   | `apps/web/src/components/workspace/writer-*` (analytics page + chart components)            |
| **Ops dashboard**         | `apps/web/src/components/operations/ops-dashboard.tsx` (health card grid + quick links)     |
| **Health card grid**      | `apps/web/src/components/operations/health-card-grid.tsx` (4-card status derivation)        |
| **Density provider**      | `apps/web/src/hooks/use-density.tsx` (DensityProvider + useDensity hook)                    |
| **Layout shells**         | `apps/web/src/app/(dashboard)/{editor,slate,federation,webhooks,organizations}/layout.tsx`  |
| **Split pane**            | `apps/web/src/components/editor/editorial-split-pane.tsx` (triage/deep-read orchestrator)   |
| **ManuscriptRenderer**    | `apps/web/src/components/manuscripts/manuscript-renderer.tsx` (genre-aware typography)      |
| **ManuscriptEditor**      | `apps/web/src/components/manuscripts/manuscript-editor.tsx` (TipTap copyedit editor)        |
| **ManuscriptDiff**        | `apps/web/src/components/manuscripts/manuscript-diff.tsx` (word-level diff view)            |
| **TipTap manuscript ext** | `apps/web/src/lib/tiptap-manuscript-extensions.ts` (custom nodes/marks + converters)        |
| **Production dashboard**  | `apps/web/src/components/slate/production-dashboard.tsx` (issue-centric pipeline overview)  |
| **Production aging**      | `apps/web/src/components/slate/production-aging.ts` (aging status, deadline, handoff utils) |
| **Keyboard shortcuts**    | `apps/web/src/hooks/use-shortcuts.ts` (shell-scoped shortcut hook)                          |
| **Command palette**       | `apps/web/src/components/command-palette/command-palette.tsx` (Cmd+K global nav)            |
| **Shortcut overlay**      | `apps/web/src/components/command-palette/shortcut-overlay.tsx` (? key help dialog)          |
| **Shared navigation**     | `apps/web/src/lib/navigation.ts` (nav items + groups, shared by sidebar + palette)          |
| **Platform utilities**    | `apps/web/src/lib/platform.ts` (isMac, modifierKey, modifierSymbol)                         |
| **Literata font**         | `apps/web/src/lib/fonts.ts` (variable font with optical sizing)                             |

## SDKs & Scripts

| What               | Path                                                                     |
| ------------------ | ------------------------------------------------------------------------ |
| **OpenAPI spec**   | `sdks/openapi.json` (exported from running API, 67 paths, 15 tag groups) |
| **TypeScript SDK** | `sdks/typescript/` (`@colophony/sdk` — openapi-fetch + generated types)  |
| **Python SDK**     | `sdks/python/` (`colophony` — openapi-python-client generated)           |
| **SDK generation** | `scripts/generate-sdks.ts` (regenerate both SDKs from committed spec)    |

## Infrastructure & Ops

| What                    | Path                                                                                    |
| ----------------------- | --------------------------------------------------------------------------------------- |
| **Alert rules**         | `docker/prometheus/alert-rules.yml`                                                     |
| **AlertManager config** | `docker/alertmanager/alertmanager.yml`                                                  |
| **Loki config**         | `docker/loki/loki-config.yml` (dev), `loki-config.prod.yml` (prod)                      |
| **Promtail config**     | `docker/promtail/promtail-config.yml`                                                   |
| **Grafana dashboards**  | `docker/grafana/dashboards/` (API metrics + logs exploration)                           |
| **Gateway config**      | `gateway/Caddyfile` (Caddy reverse proxy — routing, security headers, maintenance page) |
| **Gateway Dockerfile**  | `gateway/Dockerfile`                                                                    |
| **Uptime workflow**     | `.github/workflows/uptime.yml` (cron health checks, issue-based alerting)               |

## Documentation

| What                  | Path                                                                             |
| --------------------- | -------------------------------------------------------------------------------- |
| **Backlog**           | `docs/backlog.md` (track-organized, drives session focus)                        |
| **Design system**     | `docs/DESIGN_SYSTEM.md` (roles, density, navigation, typography, migration path) |
| **Manuscript format** | `docs/manuscript-format.md` (ProseMirror JSON schema, conversion pipeline)       |
| **CSR format spec**   | `docs/csr-format.md`                                                             |
| **QA log**            | `docs/qa-log.md`                                                                 |
| **Release checklist** | `docs/release-checklist.md`                                                      |
