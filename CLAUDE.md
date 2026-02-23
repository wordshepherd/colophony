# Colophony — Infrastructure for Literary Magazines

Open-source suite covering the full publication lifecycle: submission intake, publication pipeline, notifications, and cross-instance federation.

**Status:** v2 rewrite in progress. v1 MVP (originally named Prospector) tagged as `v1.0.0-mvp`.
**Team:** David (primary dev), Senior Developer (PR reviews), CEO (priorities)
**Session log:** `docs/devlog/YYYY-MM.md` (monthly rotation) — append entries after each session
**Architecture:** [docs/architecture-v2-planning.md](docs/architecture-v2-planning.md)

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

| What                    | Path                                                                     |
| ----------------------- | ------------------------------------------------------------------------ |
| **Drizzle schema**      | `packages/db/src/schema/` (one file per table group)                     |
| **Drizzle migrations**  | `packages/db/migrations/`                                                |
| **Drizzle client**      | `packages/db/src/client.ts`                                              |
| **RLS context**         | `packages/db/src/context.ts` (`withRls()`)                               |
| **Shared Zod schemas**  | `packages/types/src/`                                                    |
| **Zitadel auth client** | `packages/auth-client/src/`                                              |
| **Fastify app entry**   | `apps/api/src/main.ts`                                                   |
| **Fastify hooks**       | `apps/api/src/hooks/` (auth, rate-limit, org-context, db-context, audit) |
| **Service layer**       | `apps/api/src/services/`                                                 |
| **tRPC (internal)**     | `apps/api/src/trpc/`                                                     |
| **Zitadel webhook**     | `apps/api/src/webhooks/zitadel.webhook.ts`                               |
| **Stripe webhook**      | `apps/api/src/webhooks/stripe.webhook.ts`                                |
| **Next.js frontend**    | `apps/web/`                                                              |
| **tRPC client**         | `apps/web/src/lib/trpc.ts`                                               |
| **Env config (Zod)**    | `apps/api/src/config/env.ts`                                             |
| **Backlog**             | `docs/backlog.md` (track-organized, drives session focus)                |

Full project structure: [docs/architecture-v2-planning.md](docs/architecture-v2-planning.md)

---

## Tech Stack

**Frontend:** Next.js 16, React 19, TypeScript (strict), Tailwind + shadcn/ui (New York), tRPC (internal), TanStack Query, tus-js-client, date-fns

**Backend:** Fastify 5, TypeScript (strict), Drizzle ORM, BullMQ 5, Zitadel (auth), Stripe, nodemailer

**API surfaces:** tRPC (built), oRPC REST + OpenAPI 3.1 (PR 1 done), GraphQL via Pothos + Yoga (PR 1 done — queries)

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

### 4. Payments (Stripe Checkout) — planned

**See `apps/api/CLAUDE.md`** for PCI NEVER list and webhook idempotency patterns.

Summary: Stripe Checkout only (zero PCI scope). No Stripe handler exists yet. PCI guardrails apply when built: never log card numbers or store card data.

### 5. Frontend

**See `apps/web/CLAUDE.md`** for tRPC client setup, providers, auth utilities, and conventions.

---

## Known Quirks & Gotchas

Domain-specific quirks are in per-directory CLAUDE.md files. Cross-cutting quirks below:

| Quirk                                                 | Details                                                                                                                                                                                                                           |
| ----------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Docker Compose env_file**                           | `env_file:` sets container env only. For YAML `${VAR}` substitution, use `--env-file .env` on CLI                                                                                                                                 |
| **PostgreSQL init-db.sh**                             | Only runs on first DB creation. Must `docker compose down -v` to re-run after changes                                                                                                                                             |
| **WSL husky hooks need nvm PATH**                     | Husky v9 runs hooks under `sh`/`dash`; `nvm.sh` can't be sourced. Hooks add nvm node bin to PATH directly. `lint-staged` called without `npx`                                                                                     |
| **CI: workspace deps need build before Vitest**       | Vitest resolves workspace packages via `exports` field (pointing to `dist/`). CI must build deps before running tests                                                                                                             |
| **`drizzle-kit generate` TUI blocks automation**      | Interactive prompts (rename vs create) use a TUI that ignores piped stdin. Write manual migrations in non-interactive shells; snapshot files may need regeneration interactively                                                  |
| **Playwright `webServer.env` replaces `process.env`** | `webServer.env` **replaces** (not merges) the child process environment. Must load `.env` files via `dotenv` and spread `...process.env` to ensure `DATABASE_URL` etc. reach dev servers                                          |
| **Zitadel issuer ± trailing slash**                   | Zitadel v4.10.1 omits trailing slash in JWT `iss` claim. JWKS verifier uses array issuer `[base, base + "/"]` to match both. Don't normalize to one form                                                                          |
| **Overmind requires tmux**                            | `pnpm dev` uses Overmind (tmux-based process manager). Install both `tmux` and `overmind`. Turbo stays for builds; Overmind replaces it for persistent dev servers only. Use `pnpm dev:clean` to kill orphans if Overmind crashes |

**Version pin (cross-cutting):**

| Package     | Pinned        | Notes                                        |
| ----------- | ------------- | -------------------------------------------- |
| Drizzle ORM | latest stable | Schema API evolving; pin after initial setup |

All other version pins are in their respective per-directory CLAUDE.md files.

---

## Security Status

### Application Security (v2 — in progress)

- [x] Rate limiting on all API surfaces (two-tier: IP pre-auth + user post-auth Fastify hooks)
- [x] Security headers (@fastify/helmet: CSP, HSTS, X-Content-Type-Options)
- [x] Secrets in environment only (never committed). Validate env schema with Zod at startup; canonical definition: `apps/api/src/config/env.ts`
- [x] Pre-commit hook blocks secrets (husky + `scripts/check-secrets.sh`)
- [x] Zitadel OIDC token validation on all protected routes (default-deny auth hook)
- [x] API key authentication with scopes (enforced via `requireScopes` middleware on REST + tRPC)
- [ ] Audit log for all sensitive actions
- [x] File virus scanning before production bucket (ClamAV via BullMQ)
- [x] RLS policies on all tenant tables via Drizzle `pgPolicy` with FORCE — see `packages/db/CLAUDE.md`
- [x] Application database role is NOT superuser — see `packages/db/CLAUDE.md`
- [x] Input validation with Zod on all API surfaces
- [x] Zitadel webhook signature verification + timestamp freshness + event ordering + webhook rate limiting
- [x] Stripe webhook signature verification + idempotency
- [x] Storage: block public access via MinIO policy

### Production Deployment Checklist

- [ ] Change `app_user` password from default
- [ ] PostgreSQL SSL/TLS (`sslmode=require`), connection pooling (PgBouncer), backups (WAL-G to S3)
- [ ] `pg_stat_statements` for query monitoring
- [ ] Rotate credentials quarterly
- [ ] AGPL license boundary documented (Zitadel is AGPL; Colophony code is unaffected)
- [ ] Monitoring: Prometheus + Grafana + Loki
- [ ] Verify RLS in production — see `packages/db/CLAUDE.md` for verification queries

---

## Git Workflow

**NEVER push directly to `main`.** Protected branch — requires PR + CI + senior dev review. The `pre-push-branch.js` hook blocks direct pushes.

- **Branching:** `feat/<topic>`, `fix/<topic>`, `chore/<topic>` from `main`. Squash merge.
- **Commits:** [Conventional Commits](https://www.conventionalcommits.org/) — scope with component name when specific (e.g., `feat(hopper): ...`).
- **Commit cadence:** At stable checkpoints. Always before risky ops, ending a session, or switching context.
- **Push cadence:** When you have a reviewable unit, are stepping away, or want CI feedback. Don't push broken states.
- **Release tags:** semver `v{major}.{minor}.{patch}`. v1 MVP tagged `v1.0.0-mvp`.

### Git Hooks (husky)

| Hook           | Checks                                                                                             |
| -------------- | -------------------------------------------------------------------------------------------------- |
| **Pre-commit** | Secret scanning (`scripts/check-secrets.sh`), lint-staged (Prettier on `.ts`/`.tsx`/`.json`/`.md`) |
| **Pre-push**   | `pnpm type-check` (tsc --noEmit), `pnpm lint` (ESLint)                                             |

### CI Pipeline (GitHub Actions)

| Job                    | Checks                                             |
| ---------------------- | -------------------------------------------------- |
| **quality**            | `format:check`, `lint`, `type-check`, `pnpm audit` |
| **unit-tests**         | `pnpm test`                                        |
| **rls-tests**          | RLS tenant isolation integration tests             |
| **playwright-tests**   | Playwright E2E submissions project (20 tests)      |
| **playwright-uploads** | Playwright E2E uploads project (6 tests)           |
| **playwright-oidc**    | Playwright E2E OIDC project (6 tests)              |
| **playwright-embed**   | Playwright E2E embed project (10 tests)            |
| **build**              | `pnpm build` (API + Web production build)          |

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
```

### Claude Code Hooks (run automatically)

**Pre-edit:** `pre-edit-validate.js` (secrets, RLS context), `pre-payment-validate.js` (idempotency), `pre-frontend-validate.js` (use client, shadcn, org context), `pre-router-audit.js` (audit logging), `pre-push-branch.js` (blocks push to main)

**Post-edit:** `post-schema.js` (db:generate reminder), `post-email-template.js` (text version), `post-migration-validate.js` (RLS for new tables), `post-commit-devlog.js` (DEVLOG reminder)

### Codex Review Integration

`/codex-review [plan|diff|branch]` — non-interactive Codex review. Branch review (default): `codex review --base origin/main`. Diff review: `--uncommitted`. Plan review: `codex exec -s read-only`.

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

Every non-trivial plan **must be reviewed by Codex before presenting to the user for approval**. The workflow is:

1. **Write the plan** (after decision surfacing, per above)
2. **Run `/codex-review plan`** automatically — do not ask the user, just run it
3. **Evaluate Codex findings** — adjust the plan for any critical or important issues; for dismissed suggestions, add a brief note (e.g., "Codex suggested X; dismissed because Y")
4. **Present the Codex-vetted plan** to the user for approval

The user sees a plan that has already been through one round of review. This replaces the previous pattern of creating blocking task list entries for Codex review.

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

Drift detection (in `/codex-review branch`) reads this section and excludes acknowledged overrides from its findings.

### File Size Guideline

Soft limit of 500 lines per source file. Files exceeding 500 lines should be flagged during `/codex-review` for potential extraction. This is a review trigger, not a hard gate — some files (e.g., schema definitions, test suites) naturally exceed this. When flagged, evaluate whether there is a natural seam for extraction (pure logic vs DB-dependent, CRUD vs validation, etc.).

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
pnpm dev                      # Overmind: builds packages, then API: 4000, Web: 3000
```

**Overmind commands** (run from project root while `pnpm dev` is running):

```bash
overmind connect api           # Attach to API logs (detach: Ctrl+B D)
overmind connect web           # Attach to Web logs
overmind restart api           # Restart API only (Web continues)
overmind kill                  # Stop all dev servers
pnpm dev:clean                # Kill orphaned processes + stale files (fallback)
```

### Running Tests

```bash
pnpm test                     # Unit tests
pnpm test:e2e                 # API E2E (needs docker-compose up)
pnpm --filter @colophony/web test:e2e  # Playwright (needs dev servers)
```

Full testing guide: [docs/testing.md](docs/testing.md)

### Database Management

```bash
pnpm db:migrate               # Run Drizzle migrations
pnpm db:generate              # Generate migration from schema changes
pnpm db:seed                  # Seed test data
pnpm db:reset                 # Drop and recreate with migrations + RLS
```

### Environment Variables

Canonical env definition with Zod validation: `apps/api/src/config/env.ts`

| Variable                                                          | Required | Default                      | Used by        |
| ----------------------------------------------------------------- | -------- | ---------------------------- | -------------- |
| `DATABASE_URL`                                                    | Yes      | —                            | API            |
| `DATABASE_APP_URL`                                                | No       | Falls back to `DATABASE_URL` | API (RLS)      |
| `PORT` / `HOST`                                                   | No       | `4000` / `0.0.0.0`           | API            |
| `NODE_ENV`                                                        | No       | `development`                | API            |
| `REDIS_HOST` / `REDIS_PORT` / `REDIS_PASSWORD`                    | No       | `localhost` / `6379` / `""`  | API            |
| `CORS_ORIGIN`                                                     | No       | `http://localhost:3000`      | API            |
| `ZITADEL_AUTHORITY` / `ZITADEL_CLIENT_ID`                         | Optional | —                            | API            |
| `ZITADEL_WEBHOOK_SECRET`                                          | Optional | —                            | API            |
| `CLAMAV_HOST` / `CLAMAV_PORT`                                     | No       | `localhost` / `3310`         | API            |
| `VIRUS_SCAN_ENABLED`                                              | No       | `true`                       | API            |
| `STRIPE_SECRET_KEY` / `STRIPE_WEBHOOK_SECRET`                     | Optional | —                            | API            |
| `NEXT_PUBLIC_API_URL`                                             | No       | `http://localhost:4000`      | Web            |
| `NEXT_PUBLIC_ZITADEL_AUTHORITY` / `NEXT_PUBLIC_ZITADEL_CLIENT_ID` | —        | —                            | Web            |
| `API_URL`                                                         | —        | —                            | Web (SSR only) |

---

## Development Tracks

See [docs/architecture-v2-planning.md Section 6](docs/architecture-v2-planning.md) for full details.

| Track | Component                                                | Months | Status          |
| ----- | -------------------------------------------------------- | ------ | --------------- |
| 1     | Core Infrastructure (Fastify, Drizzle, Zitadel, Coolify) | 1-4    | **In progress** |
| 2     | Colophony API (REST, GraphQL, tRPC, SDKs)                | 3-8    | Pending         |
| 3     | Hopper — Submission Management                           | 5-12   | Pending         |
| 4     | Slate — Publication Pipeline                             | 8-15   | Pending         |
| 5     | Register — Identity & Federation                         | 10-18  | Pending         |
| 6     | Colophony Plugins                                        | 14-20  | Pending         |
| —     | Relay — Notifications (cross-cutting)                    | 1-20   | Pending         |

---

## References

- [Fastify](https://fastify.dev/docs) | [Drizzle](https://orm.drizzle.team/docs) | [Zitadel](https://zitadel.com/docs)
- [ts-rest](https://ts-rest.com/docs) | [tRPC](https://trpc.io/docs) | [Next.js](https://nextjs.org/docs)
- [BullMQ](https://docs.bullmq.io) | [tus](https://tus.io) | [Stripe](https://stripe.com/docs/api)
- [PostgreSQL RLS](https://www.postgresql.org/docs/current/ddl-rowsecurity.html)

---

## Self-Update Mechanism

If you (Claude Code) discover important patterns, constraints, or decisions during implementation:

1. Add a comment in the relevant file:

```typescript
// TODO(CLAUDE.md): Document pattern: [description]
```

2. At end of session, suggest update:

```markdown
## Suggested Update for CLAUDE.md

**Section**: [section name]
**Addition**: [new content]
**Rationale**: [why this is important]
```

3. David will review and merge approved updates.
