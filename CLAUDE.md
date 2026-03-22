# Colophony — Infrastructure for Literary Magazines

Open-source suite covering the full publication lifecycle: submission intake, publication pipeline, notifications, and cross-instance federation.

**Status:** v2 rewrite in progress. v1 MVP (originally named Prospector) tagged as `v1.0.0-mvp`.
**Team:** David (primary dev), Senior Developer (PR reviews), CEO (priorities)
**Session log:** `docs/devlog/YYYY-MM.md` (monthly rotation) — append entries after each session
**Architecture:** [docs/architecture.md](docs/architecture.md)

### Suite Components

| Component    | Scope                                                                     | Package prefix          |
| ------------ | ------------------------------------------------------------------------- | ----------------------- |
| **Hopper**   | Submission management — forms, intake, review pipeline, decisions         | `@colophony/hopper-*`   |
| **Slate**    | Publication pipeline — copyedit, contracts, issue assembly, CMS           | `@colophony/slate-*`    |
| **Relay**    | Notifications & communications — email, webhooks, in-app messaging        | `@colophony/relay-*`    |
| **Register** | Identity & federation — cross-instance identity, sim-sub, piece transfers | `@colophony/register-*` |

API layer and plugin system use the `@colophony/` prefix directly.

---

## Quick Reference: Key File Locations

Per-directory CLAUDE.md files contain domain-specific details:

- **`packages/db/CLAUDE.md`** — RLS rules (authoritative), schema files, migration workflow
- **`apps/api/CLAUDE.md`** — Hook registration, tRPC procedures, auth, webhooks
- **`apps/web/CLAUDE.md`** — tRPC client, providers, auth utilities, conventions

| What                     | Path                                                                             |
| ------------------------ | -------------------------------------------------------------------------------- |
| **Drizzle schema**       | `packages/db/src/schema/` (one file per table group)                             |
| **Drizzle migrations**   | `packages/db/migrations/`                                                        |
| **Drizzle client**       | `packages/db/src/client.ts`                                                      |
| **RLS context**          | `packages/db/src/context.ts` (`withRls()`)                                       |
| **Shared Zod schemas**   | `packages/types/src/`                                                            |
| **Zitadel auth client**  | `packages/auth-client/src/`                                                      |
| **Fastify app entry**    | `apps/api/src/main.ts`                                                           |
| **Fastify hooks**        | `apps/api/src/hooks/` (auth, rate-limit, org-context, db-context, audit)         |
| **Service layer**        | `apps/api/src/services/`                                                         |
| **tRPC (internal)**      | `apps/api/src/trpc/`                                                             |
| **Zitadel webhook**      | `apps/api/src/webhooks/zitadel.webhook.ts`                                       |
| **Stripe webhook**       | `apps/api/src/webhooks/stripe.webhook.ts`                                        |
| **Documenso webhook**    | `apps/api/src/webhooks/documenso.webhook.ts`                                     |
| **Inngest functions**    | `apps/api/src/inngest/`                                                          |
| **Adapter registry**     | `apps/api/src/adapters/registry-accessor.ts` (module-level singleton)            |
| **Config builder**       | `apps/api/src/colophony.config.ts` (maps env → adapter init)                     |
| **SDK adapters**         | `apps/api/src/adapters/{email,storage,payment}/` (SDK-compatible)                |
| **CMS adapters**         | `apps/api/src/adapters/cms/`                                                     |
| **Federation discovery** | `apps/api/src/federation/discovery.routes.ts`                                    |
| **Federation DID**       | `apps/api/src/federation/did.routes.ts`                                          |
| **Federation service**   | `apps/api/src/services/federation.service.ts`                                    |
| **Federation trust**     | `apps/api/src/federation/trust.routes.ts` (S2S), `trust-admin.routes.ts`         |
| **Trust service**        | `apps/api/src/services/trust.service.ts`                                         |
| **HTTP signatures**      | `apps/api/src/federation/http-signatures.ts`                                     |
| **Federation auth**      | `apps/api/src/federation/federation-auth.ts` (S2S signature middleware)          |
| **Sim-sub (BSAP)**       | `apps/api/src/federation/simsub.routes.ts` (S2S), `simsub-admin.routes.ts`       |
| **Sim-sub service**      | `apps/api/src/services/simsub.service.ts`                                        |
| **Fingerprint service**  | `apps/api/src/services/fingerprint.service.ts`                                   |
| **Transfer routes**      | `apps/api/src/federation/transfer.routes.ts` (S2S), `transfer-admin.routes.ts`   |
| **Transfer service**     | `apps/api/src/services/transfer.service.ts`                                      |
| **Migration routes**     | `apps/api/src/federation/migration.routes.ts` (S2S), `migration-admin.routes.ts` |
| **Migration service**    | `apps/api/src/services/migration.service.ts`, `migration-bundle.service.ts`      |
| **Hub routes**           | `apps/api/src/federation/hub.routes.ts` (S2S), `hub-admin.routes.ts`             |
| **Hub auth**             | `apps/api/src/federation/hub-auth.ts` (S2S hub auth middleware)                  |
| **Hub service**          | `apps/api/src/services/hub.service.ts`                                           |
| **Hub client service**   | `apps/api/src/services/hub-client.service.ts`                                    |
| **Analytics service**    | `apps/api/src/services/submission-analytics.service.ts`                          |
| **Analytics components** | `apps/web/src/components/analytics/` (charts, filters, dashboard page)           |
| **Portfolio service**    | `apps/api/src/services/portfolio.service.ts` (cross-org UNION ALL, status maps)  |
| **Writer analytics svc** | `apps/api/src/services/writer-analytics.service.ts` (personal stats/charts)      |
| **Writer analytics UI**  | `apps/web/src/components/workspace/writer-*` (analytics page + chart components) |
| **Next.js frontend**     | `apps/web/`                                                                      |
| **tRPC client**          | `apps/web/src/lib/trpc.ts`                                                       |
| **Env config (Zod)**     | `apps/api/src/config/env.ts`                                                     |
| **Plugin SDK**           | `packages/plugin-sdk/src/` (adapters, hooks, config, plugin-base, testing)       |
| **OpenAPI spec**         | `sdks/openapi.json` (exported from running API, 67 paths, 15 tag groups)         |
| **TypeScript SDK**       | `sdks/typescript/` (`@colophony/sdk` — openapi-fetch + generated types)          |
| **Python SDK**           | `sdks/python/` (`colophony` — openapi-python-client generated)                   |
| **SDK generation**       | `scripts/generate-sdks.ts` (regenerate both SDKs from committed spec)            |
| **SSRF validation**      | `apps/api/src/lib/url-validation.ts` (validateOutboundUrl, isPrivateIPv4/v6)     |
| **Sentry config**        | `apps/api/src/config/sentry.ts` (init, captureException, isSentryEnabled)        |
| **Metrics registry**     | `apps/api/src/config/metrics.ts` (Prometheus counters, histograms, gauges)       |
| **Metrics plugin**       | `apps/api/src/hooks/metrics.ts` (Fastify plugin — HTTP request instrumentation)  |
| **Instrumented worker**  | `apps/api/src/config/instrumented-worker.ts` (BullMQ wrapper with metrics)       |
| **Writer workspace**     | `packages/db/src/schema/writer-workspace.ts`                                     |
| **CSR types**            | `packages/types/src/csr.ts`                                                      |
| **CSR service**          | `apps/api/src/services/csr.service.ts` (export/import for data portability)      |
| **CSR format spec**      | `docs/csr-format.md`                                                             |
| **Backlog**              | `docs/backlog.md` (track-organized, drives session focus)                        |
| **QA log**               | `docs/qa-log.md`                                                                 |
| **Release checklist**    | `docs/release-checklist.md`                                                      |

Full project structure: [docs/architecture.md](docs/architecture.md)

---

## Tech Stack

**Frontend:** Next.js 16, React 19, TypeScript (strict), Tailwind + shadcn/ui (New York), tRPC (internal), TanStack Query, tus-js-client, date-fns

**Backend:** Fastify 5, TypeScript (strict), Drizzle ORM, BullMQ 5, Zitadel (auth), Stripe, nodemailer

**API surfaces:** tRPC (built), oRPC REST + OpenAPI 3.1 (built). GraphQL (Pothos + Yoga) extracted to feature branch — re-merge when demand materializes

**Data:** PostgreSQL 16+ (RLS via Drizzle `pgPolicy`), Redis 7+, MinIO (S3-compatible)

**Infra:** Docker Compose (self-hosted), Coolify + Hetzner (managed hosting)

---

## Critical Patterns

### 1. Multi-Tenancy with RLS (CRITICAL)

**See `packages/db/CLAUDE.md`** for the authoritative RLS rules, `withRls()` usage, code examples, and full NEVER list.

Summary: RLS policies are in Drizzle schema via `pgPolicy`. Org context set via `SET LOCAL` inside transactions. Never query tenant data without setting context. Never make `app_user` a superuser.

### 2. Authentication (Zitadel OIDC)

**See `apps/api/CLAUDE.md`** for hook chain, token types, and auth details.

Summary: Zitadel handles all authentication. API validates tokens via Fastify `onRequest` hook. User lifecycle synced via Zitadel webhooks.

### 3. File Uploads (tusd)

Client → tusd sidecar (chunked, resumable) → pre-create hook validates → post-finish hook creates record → BullMQ → ClamAV scan → clean/quarantine.

Unchanged from v1. Uses tus-js-client on frontend, tusd sidecar in Docker Compose.

### 4. Payments (Stripe Checkout)

**See `apps/api/CLAUDE.md`** for PCI NEVER list and webhook idempotency patterns.

Summary: Stripe Checkout only (zero PCI scope). Webhook handler built with two-step idempotency (INSERT event, check `processed` status). PCI guardrails enforced: never log card numbers or store card data.

### 5. Frontend

**See `apps/web/CLAUDE.md`** for tRPC client setup, providers, auth utilities, and conventions.

---

## Known Quirks & Gotchas

Domain-specific quirks are in per-directory CLAUDE.md files. Cross-cutting quirks below:

| Quirk                                                 | Details                                                                                                                                                                                                                                                                                                                                                                                                                           |
| ----------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Docker Compose env_file**                           | `env_file:` sets container env only. For YAML `${VAR}` substitution, use `--env-file .env` on CLI                                                                                                                                                                                                                                                                                                                                 |
| **PostgreSQL init-db.sh**                             | Only runs on first DB creation. Must `docker compose down -v` to re-run after changes                                                                                                                                                                                                                                                                                                                                             |
| **PgBouncer: migrations must bypass**                 | `drizzle-kit` and `pnpm db:migrate` use `DATABASE_URL` (direct port 5432). Only `DATABASE_APP_URL` routes through PgBouncer (port 6432). `SET LOCAL` is required (not `SET`) — transaction pooling reuses server connections                                                                                                                                                                                                      |
| **WSL husky hooks need nvm PATH**                     | Husky v9 runs hooks under `sh`/`dash`; `nvm.sh` can't be sourced. Hooks add nvm node bin to PATH directly. `lint-staged` called without `npx`                                                                                                                                                                                                                                                                                     |
| **CI: workspace deps need build before Vitest**       | Vitest resolves workspace packages via `exports` field (pointing to `dist/`). CI must build deps before running tests                                                                                                                                                                                                                                                                                                             |
| **`drizzle-kit generate` TUI blocks automation**      | Interactive prompts (rename vs create) use a TUI that ignores piped stdin. Write manual migrations in non-interactive shells; snapshot files may need regeneration interactively                                                                                                                                                                                                                                                  |
| **Playwright `webServer.env` replaces `process.env`** | `webServer.env` **replaces** (not merges) the child process environment. Must load `.env` files via `dotenv` and spread `...process.env` to ensure `DATABASE_URL` etc. reach dev servers                                                                                                                                                                                                                                          |
| **Zitadel issuer ± trailing slash**                   | Zitadel v4.10.1 omits trailing slash in JWT `iss` claim. JWKS verifier uses array issuer `[base, base + "/"]` to match both. Don't normalize to one form                                                                                                                                                                                                                                                                          |
| **hivemind for dev servers**                          | `pnpm dev` uses hivemind (single Go binary, no tmux). Install `hivemind`. Turbo stays for builds; hivemind replaces it for persistent dev servers only. Use `pnpm dev:clean` to kill orphans if hivemind crashes. No per-process `connect`/`restart` — use Ctrl+C to stop all, rely on hot-reload for changes. hivemind always injects a PORT env var (base 5000); `Procfile.dev` sets `PORT=` explicitly per process to override |
| **Coolify: bind mounts → directories**                | Coolify converts `./path/to/file:/container/path:ro` bind mounts into directories. All file mounts must be embedded in Docker images via COPY. Affects `docker-compose.coolify.yml` only — staging/prod compose files still use bind mounts for non-Coolify deployments                                                                                                                                                           |
| **Coolify: `restart:unless-stopped` on all**          | Coolify injects `restart: unless-stopped` on every service, including one-shot containers (migrate, minio-setup). One-shot services must be merged into long-running containers or will crash-loop                                                                                                                                                                                                                                |
| **Coolify: `${VAR}` in labels not resolved**          | Docker Compose `${VAR}` substitution works in `environment:` but not in `labels:`. Use Coolify UI "Domains" field for Traefik routing instead of manual labels                                                                                                                                                                                                                                                                    |
| **Zitadel Actions v2 payload format**                 | Zitadel sends `event_type` (not `eventType`), `created_at` (not `creationDate`), `aggregateID:sequence` for idempotency (no `eventId`), and user data in `event_payload` (not `user`). Signature header is `ZITADEL-Signature` with format `t=<ts>,v1=<hmac>` where HMAC is over `<ts>.<body>`. Handler maps `user.human.*` event names to internal `user.*` names via alias table                                                |

**Version pin (cross-cutting):**

| Package     | Pinned        | Notes                                        |
| ----------- | ------------- | -------------------------------------------- |
| Drizzle ORM | latest stable | Schema API evolving; pin after initial setup |

All other version pins are in their respective per-directory CLAUDE.md files.

---

## Security Status

Application security controls (rate limiting, auth, RLS, audit, input validation, webhook verification, etc.) are all in place. See `docs/release-checklist.md` for the full checklist.

**Remaining production TODOs:**

- [x] Backups (WAL-G to S3) — `docker/postgres/` (WAL-G image), `scripts/backup-db.sh`, `scripts/verify-backup.sh`, `scripts/restore-backup.sh`
- [x] Rotate credentials quarterly — `scripts/rotate-secrets.sh` + `docs/credential-rotation.md`
- [x] Verify RLS in production — `scripts/verify-rls.sh` (structural + behavioral, integrated into deploy via `init-prod.sh`)

---

## Git Workflow

**NEVER push directly to `main`.** Protected branch — requires PR + CI + senior dev review. The `pre-push-branch.js` hook blocks direct pushes.

- **Branching:** `feat/<topic>`, `fix/<topic>`, `chore/<topic>` from `main`. Squash merge.
- **Commits:** [Conventional Commits](https://www.conventionalcommits.org/) — scope with component name when specific (e.g., `feat(hopper): ...`).
- **Commit cadence:** At stable checkpoints. Always before risky ops, ending a session, or switching context.
- **Push cadence:** When you have a reviewable unit, are stepping away, or want CI feedback. Don't push broken states.
- **Release tags:** semver `v{major}.{minor}.{patch}`. v1 MVP tagged `v1.0.0-mvp`.

### Git Hooks (husky)

| Hook           | Checks                                                                                                                                                                            |
| -------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Pre-commit** | Secret scanning (`scripts/check-secrets.sh`), lint-staged (Prettier on `.ts`/`.tsx`/`.json`/`.md`, ESLint `--max-warnings 0` on `.ts`/`.tsx` via `scripts/lint-staged-eslint.sh`) |
| **Pre-push**   | `pnpm type-check` (tsc --noEmit, scoped to `db` + `api` packages), `pnpm lint` (ESLint). Full workspace type-check runs in CI.                                                    |

### CI Pipeline (GitHub Actions)

| Job                           | Checks                                                      |
| ----------------------------- | ----------------------------------------------------------- |
| **quality**                   | `format:check`, `lint`, `type-check`, `pnpm audit`          |
| **unit-tests**                | `pnpm test`                                                 |
| **rls-tests**                 | RLS tenant isolation integration tests                      |
| **queue-tests**               | Queue/worker integration tests (19 tests, Redis + Postgres) |
| **service-integration-tests** | Service integration tests (Postgres)                        |
| **security-tests**            | Security tests (Postgres)                                   |
| **webhook-tests**             | Webhook integration tests (Postgres)                        |
| **python-sdk-tests**          | Python SDK smoke tests                                      |
| **playwright-tests**          | Playwright E2E submissions project (20 tests)               |
| **playwright-uploads**        | Playwright E2E uploads project (6 tests)                    |
| **playwright-oidc**           | Playwright E2E OIDC project (6 tests)                       |
| **playwright-embed**          | Playwright E2E embed project (10 tests)                     |
| **playwright-slate**          | Playwright E2E Slate pipeline project (30 tests)            |
| **playwright-workspace**      | Playwright E2E Writer Workspace project (21 tests)          |
| **playwright-forms**          | Playwright E2E Form Builder project (16 tests)              |
| **playwright-organization**   | Playwright E2E Organization & Settings project (14 tests)   |
| **playwright-analytics**      | Playwright E2E Submission Analytics project (6 tests)       |
| **playwright-federation**     | Playwright E2E Federation Admin project (16 tests)          |
| **build**                     | `pnpm build` (API + Web production build)                   |

**Path filtering:** Playwright suites run selectively on PRs based on changed files (`.github/scripts/detect-changes.sh`). Shared paths (packages, API, shared hooks/lib/ui) trigger all suites. Suite-specific paths (e.g., `apps/web/e2e/slate/`, `apps/web/src/components/slate/`) trigger only that suite. Unknown paths fail-open (all suites run). Push to `main` always runs everything. Fast jobs (quality, unit-tests, rls-tests, queue-tests, service-integration-tests, security-tests, build) are unaffected — they always run on non-docs PRs.

---

## Development Workflow

### Claude Code Skills

```
# Backend
/db-reset             # Reset database and apply Drizzle migrations + RLS
/db-reset --test      # Reset test database
/new-route <name>     # Scaffold ts-rest route with Fastify handler + tests
/new-service <name>   # Scaffold service class with Drizzle queries + tests
/new-processor <name> # Scaffold BullMQ job processor
/new-migration <name> # Add Drizzle schema + generate migration + RLS policy
/stripe-webhook <evt> # Add Stripe webhook handler with idempotency
/test-rls             # Run RLS integration tests

# Frontend
/new-page <name>      # Scaffold Next.js page (auth, dashboard, or public)
/new-component <name> # Scaffold React component (form, list, dialog, or basic)
/new-hook <name>      # Scaffold React hook (query, mutation, or state)
/new-e2e <feature>    # Scaffold Playwright E2E test with helpers

# Session
/start-session        # Session briefing (DEVLOG context, git state, PRs, infra)
/end-session          # End-of-session housekeeping (DEVLOG, git, PR, summary)
/codex-review [type]  # Run Codex code review (plan, diff, branch; default: branch)
/opencode-review [type] # Run OpenCode code review (plan, diff, branch; default: branch)
```

### Claude Code Hooks (run automatically)

**Pre-edit:** `pre-edit-validate.js` (secrets, RLS context), `pre-payment-validate.js` (idempotency), `pre-frontend-validate.js` (use client, shadcn, org context), `pre-router-audit.js` (audit logging), `pre-push-branch.js` (blocks push to main)

**Post-edit:** `post-edit-lint.js` (eslint on changed file — fix warnings immediately, do not defer), `post-schema.js` (db:generate reminder), `post-email-template.js` (text version), `post-migration-validate.js` (RLS for new tables), `post-commit-devlog.js` (DEVLOG reminder)

### Code Review Integration

Two review tools available — use either:

- `/codex-review [plan|diff|branch]` — Codex CLI review. Branch: `codex review --base origin/main`. Diff: `--uncommitted`. Plan: `codex exec -s read-only`.
- `/opencode-review [plan|diff|branch]` — OpenCode CLI review. All modes use `opencode run` with a review prompt and `-f` to attach diffs/plans.

For interactive Codex in tmux: source nvm, `nvm use v22.22.0`, then `codex`. Use `codex resume` or `codex fork --last` for follow-up.

### Decision Surfacing in Plan Mode

After exploring the codebase but **before writing the implementation plan**, enumerate any architectural gray areas discovered during exploration. Present each as a decision point:

```
## Design Decisions

### [Decision Title]
**Context:** [What was found during exploration that creates ambiguity]
**Options:**
  A. [Option] — [pro/con]
  B. [Option] — [pro/con]
**Recommendation:** [A or B] — [rationale]
```

Wait for user confirmation or redirection on each decision before proceeding to write the plan. This prevents wasted planning effort on an approach the user would reject.

**Skip this step when:**

- The task has no meaningful design choices (pure mechanical refactoring, typo fixes)
- All decisions were already made in the requirements (backlog item specifies the approach)
- The user explicitly says "just do it" or "use your judgment"

### Plan Review: Codex Integration

<!-- To switch to OpenCode: replace /codex-review with /opencode-review below -->

Every non-trivial plan **must be reviewed before presenting to the user for approval**. The workflow is:

1. **Write the plan** (after decision surfacing, per above)
2. **Run `/codex-review plan`** automatically — do not ask the user, just run it
3. **Evaluate review findings** — adjust the plan for any critical or important issues; for dismissed suggestions, add a brief note (e.g., "Review suggested X; dismissed because Y")
4. **Present the reviewed plan** to the user for approval

The user sees a plan that has already been through one round of review. This replaces the previous pattern of creating blocking task list entries for review.

**When to skip:** Trivial plans (typo fix, single config change, doc-only update). If in doubt, run the review.

### Plan Specificity Standard

Plans must be concrete enough to mechanically verify after implementation. Every non-trivial plan should include:

- **Exact file paths** for all files to create or modify (absolute from repo root)
- **Concrete type/interface names** for new exports (e.g., "export `FormFieldValidator` type from `form-validation.service.ts`")
- **Function/method signatures** with parameter and return types
- **Named test cases** with setup conditions and expected assertions (e.g., "Test 'rejects invalid email': setup field with `fieldType: 'email'`, pass value `'not-an-email'`, assert error message contains 'valid email'")
- **Import changes** when moving code between files
- **Files that should NOT change** when relevant (confirms scope boundaries)

The goal: another developer (or Codex) could diff the implementation against the plan and flag unintentional divergences. When a plan item is too exploratory to specify concretely, mark it as `[exploratory]` and note what will be determined during implementation.

### Plan Override Log

During implementation, when discoveries require deliberate divergence from the approved plan, log overrides immediately. Do not wait until the end.

**Where to log:** Add a `## Plan Overrides` section to the PR description body (created by `/end-session` or `gh pr create`). Use this table format:

| File              | Planned               | Actual                                    | Rationale                                       |
| ----------------- | --------------------- | ----------------------------------------- | ----------------------------------------------- |
| `path/to/file.ts` | Export `FooValidator` | Export `validateFoo` (function, not type) | Function is simpler; no consumers need the type |

**When to log:**

- A file was created/modified that was not in the plan
- A planned file was not created (scope reduced)
- An export name, type, or signature differs from the plan
- A test case was added, removed, or substantially changed

**When NOT to log:**

- Trivial formatting differences (import order, whitespace)
- Bug fixes discovered during implementation that are clearly in-scope
- Additional test cases that strengthen coverage beyond the plan

Drift detection (in `/opencode-review branch` or `/codex-review branch`) reads this section and excludes acknowledged overrides from its findings.

### File Size Guideline

Soft limit of 500 lines per source file. Files exceeding 500 lines should be flagged during code review (`/opencode-review` or `/codex-review`) for potential extraction. This is a review trigger, not a hard gate — some files (e.g., schema definitions, test suites) naturally exceed this. When flagged, evaluate whether there is a natural seam for extraction (pure logic vs DB-dependent, CRUD vs validation, etc.).

### MCP Servers (restart Claude Code to activate)

- **postgres**: Direct DB queries (`@modelcontextprotocol/server-postgres`)
- **redis**: Job/session inspection (`@modelcontextprotocol/server-redis`)
- **context7**: Library docs (`@upstash/context7-mcp`)
- **stripe**: Stripe API/docs (`@stripe/mcp`)
- **playwright**: E2E automation (`@anthropic/mcp-playwright`)
- **docker**: Container inspection — logs, health, stats (`@modelcontextprotocol/server-docker`)

Config template: `.claude/mcp-servers.example.json`

### Starting Development

```bash
pnpm docker:up                # Core infra + Zitadel (or --full for ClamAV, --core to skip Zitadel)
pnpm install
pnpm db:migrate               # Run Drizzle migrations
pnpm db:seed                  # Seed dev data (orgs, submissions, Slate pipeline)
pnpm zitadel:setup            # Provision Zitadel + patch .env files (after volume wipe)
pnpm dev                      # hivemind: builds packages, then API: 4000, Web: 3000
```

**hivemind controls** (while `pnpm dev` is running):

```bash
Ctrl+C                         # Stop all dev servers (hivemind forwards signals)
pnpm dev:clean                 # Kill orphaned processes + stale files (fallback)
```

Note: hivemind does not support per-process attach/restart. Both apps have hot-reload, so file changes trigger automatic restarts. Use `pnpm dev:clean && pnpm dev` for a full restart.

### Running Tests

```bash
pnpm test                     # Unit tests
pnpm test:e2e                 # API E2E (needs docker-compose up)
pnpm --filter @colophony/web test:e2e  # Playwright (needs dev servers)
```

Full testing guide: [docs/testing.md](docs/testing.md)

### Database Management

```bash
pnpm db:migrate               # Validate journal + run Drizzle migrations
pnpm db:generate              # Generate migration from schema changes
pnpm db:seed                  # Seed test data
pnpm db:reset                 # Drop and recreate with migrations + RLS
pnpm db:validate-migrations   # Check SQL files ↔ journal consistency
pnpm db:add-migration <name>  # Add journal entry for a manual migration
```

### SDK Management

```bash
pnpm sdk:export-spec          # Export OpenAPI spec from running dev server → sdks/openapi.json
pnpm sdk:generate             # Regenerate TypeScript + Python SDKs from committed spec
```

### Environment Variables

Canonical definition with Zod validation: `apps/api/src/config/env.ts` (55 variables, all defaults and descriptions inline). Read that file for the full reference.

---

## Development Tracks

All 10 tracks complete. Track 6 (Plugins) extracted to feature branch. See [docs/architecture.md Section 6](docs/architecture.md) for details.
