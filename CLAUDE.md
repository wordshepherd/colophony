# Colophony — Infrastructure for Literary Magazines

Open-source suite covering the full publication lifecycle: submission intake, publication pipeline, notifications, and cross-instance federation.

**Status:** v2 rewrite in progress. v1 MVP (Prospector) tagged as `v1.0.0-mvp`.
**Team:** David (primary dev), Senior Developer (PR reviews), CEO (priorities)
**Session log:** [docs/DEVLOG.md](docs/DEVLOG.md) — append entries after each session
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

> **Note:** These are TARGET paths for the v2 architecture. During the rewrite, files are created incrementally. Check actual existence before referencing.

| What                        | Path                                                                     |
| --------------------------- | ------------------------------------------------------------------------ |
| **Drizzle schema**          | `packages/db/src/schema/` (one file per table group)                     |
| **Drizzle migrations**      | `packages/db/migrations/`                                                |
| **Drizzle client**          | `packages/db/src/client.ts`                                              |
| **RLS policies**            | `packages/db/src/schema/*.ts` (via `pgPolicy` in Drizzle schema)         |
| **Shared Zod schemas**      | `packages/types/src/`                                                    |
| **ts-rest contracts**       | `packages/api-contracts/src/`                                            |
| **Zitadel auth client**     | `packages/auth-client/src/`                                              |
| **Fastify app entry**       | `apps/api/src/main.ts`                                                   |
| **REST routes (ts-rest)**   | `apps/api/src/rest/`                                                     |
| **GraphQL (Pothos + Yoga)** | `apps/api/src/graphql/`                                                  |
| **tRPC (internal)**         | `apps/api/src/trpc/`                                                     |
| **Fastify hooks**           | `apps/api/src/hooks/` (auth, rate-limit, org-context, db-context, audit) |
| **Service layer**           | `apps/api/src/services/`                                                 |
| **BullMQ processors**       | `apps/api/src/jobs/`                                                     |
| **Zitadel webhooks**        | `apps/api/src/webhooks/zitadel.webhook.ts`                               |
| **Stripe webhooks**         | `apps/api/src/webhooks/stripe.webhook.ts`                                |
| **Federation endpoints**    | `apps/api/src/federation/`                                               |
| **Next.js frontend**        | `apps/web/`                                                              |
| **tRPC client**             | `apps/web/src/lib/trpc.ts`                                               |

Full project structure: [docs/architecture-v2-planning.md](docs/architecture-v2-planning.md)

---

## Tech Stack

**Frontend:** Next.js 15, TypeScript (strict), Tailwind + shadcn/ui (New York), tRPC (internal), TanStack Query, tus-js-client, date-fns

**Backend:** Fastify 5, TypeScript (strict), Drizzle ORM, BullMQ 5, Zitadel (auth), Stripe, nodemailer

**API surfaces:** ts-rest (public REST + OpenAPI 3.1), Pothos + GraphQL Yoga (GraphQL), tRPC (internal frontend)

**Data:** PostgreSQL 16+ (RLS via Drizzle `pgPolicy`), Redis 7+, MinIO (S3-compatible)

**Infra:** Docker Compose (self-hosted), Coolify + Hetzner (managed hosting)

---

## Critical Patterns

### 1. Multi-Tenancy with RLS (CRITICAL)

RLS policies are defined directly in Drizzle schema via `pgPolicy`. Org context is set via `SET LOCAL` inside transactions.

```typescript
// Drizzle schema — RLS is in the schema definition, not a separate SQL file
export const submissions = pgTable(
  "submissions",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    organizationId: uuid("organization_id").notNull(),
    // ... fields
  },
  (table) => [
    pgPolicy("submissions_org_isolation", {
      for: "all",
      using: sql`organization_id = current_setting('app.current_org')::uuid`,
    }),
  ],
);
```

**NEVER:**

- Query tenant data without setting org context via `SET LOCAL`
- Use session-level `SET` (always `SET LOCAL` inside transaction)
- Manually filter by `organizationId` (RLS does this)
- Use `app.current_user` (reserved keyword — use `app.user_id`)
- Skip `FORCE ROW LEVEL SECURITY` on tenant tables
- Make `app_user` a superuser (superusers bypass RLS)

### 2. Authentication (Zitadel OIDC)

Zitadel handles all authentication: login, signup, MFA, session management, token issuance. The API validates Zitadel-issued tokens via a Fastify `onRequest` hook.

```typescript
// Fastify auth hook — validates Zitadel OIDC token or API key
app.addHook("onRequest", authHook);
```

- **Interactive users:** Zitadel OIDC tokens (access + refresh)
- **API consumers:** API keys (stored in DB, scoped per org)
- **Cross-instance (federation):** HTTP Message Signatures with `did:web` identity

User lifecycle events are synced from Zitadel to the local DB via webhooks (see interaction effect [3] in architecture doc).

### 3. File Uploads (tusd)

Client → tusd sidecar (chunked, resumable) → pre-create hook validates → post-finish hook creates record → BullMQ → ClamAV scan → clean/quarantine.

Unchanged from v1. Uses tus-js-client on frontend, tusd sidecar in Docker Compose.

### 4. Payments (Stripe Checkout)

Stripe Checkout only (zero PCI scope). Webhook handler is **idempotent** — checks processed status in `stripe_webhook_events` table first.

**NEVER:**

- Log card numbers or CVV
- Store card data in database
- Process a webhook without idempotency check
- Skip transaction wrapping for webhook processing

### 5. Three API Surfaces

| Surface     | Audience                     | Framework               | Auth               |
| ----------- | ---------------------------- | ----------------------- | ------------------ |
| **tRPC**    | Internal web frontend        | tRPC + Fastify          | Zitadel OIDC token |
| **REST**    | Public API, webhooks, Zapier | ts-rest + Fastify       | API key or OIDC    |
| **GraphQL** | Power users, aggregators     | Pothos + Yoga + Fastify | API key or OIDC    |

All three share the same service layer and Zod schemas. The API surface is a thin adapter.

Zod schemas in `@colophony/types` are the single source of truth for validation across all surfaces.

### 6. Frontend

tRPC client for internal API calls. Zitadel handles login/signup UI. `ProtectedRoute` wraps auth-required pages.

**API response patterns:**

- Paginated lists: `{ items, total, page, limit, totalPages }`
- Status transitions: use defined allowed-transition maps

---

## Known Quirks & Gotchas

| Quirk                                                  | Details                                                                                                                                                                                                                                                                       |
| ------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Drizzle `pgPolicy` requires `drizzle-orm/pg-core`**  | Import `pgPolicy` from `drizzle-orm/pg-core`, not the top-level export                                                                                                                                                                                                        |
| **Drizzle JSONB queries need raw SQL**                 | No native JSONB operators yet. Use `sql` template tag for JSONB path queries. Track Drizzle JSONB roadmap (Q2 2026)                                                                                                                                                           |
| **Drizzle `migrate()` silent no-op after schema drop** | `migrate(db, { migrationsFolder })` completes without error but creates zero tables after `DROP SCHEMA CASCADE; CREATE SCHEMA public`. Use manual SQL execution (read `_journal.json`, split on `--> statement-breakpoint`) instead. Affects Drizzle ORM 0.44 with journal v7 |
| **Pothos has no Drizzle plugin**                       | Manual type definitions, manual DataLoader setup, manual cursor pagination for every model. See architecture doc section 5.5                                                                                                                                                  |
| **Zitadel webhook signatures**                         | Verify `x-zitadel-signature` header on all webhook payloads. Use shared secret from Zitadel Actions config                                                                                                                                                                    |
| **`@ts-rest/fastify` adapter**                         | `initServer()` then `s.router(contract, handlers)` — different from the NestJS adapter pattern                                                                                                                                                                                |
| **GraphQL Yoga + Fastify**                             | Mount via `app.route()` with `handleNodeRequest`, not a Fastify plugin. Must forward headers manually                                                                                                                                                                         |
| **BullMQ Redis password**                              | Uses `REDIS_HOST`/`REDIS_PORT`/`REDIS_PASSWORD` (not `REDIS_URL`). Pass password in worker/queue config                                                                                                                                                                       |
| **Docker Compose env_file**                            | `env_file:` sets container env only. For YAML `${VAR}` substitution, use `--env-file .env` on CLI                                                                                                                                                                             |
| **PostgreSQL init-db.sh**                              | Only runs on first DB creation. Must `docker compose down -v` to re-run after changes                                                                                                                                                                                         |
| **TanStack Query v4 isLoading**                        | `isLoading` is `true` even when query is disabled (`enabled: false`). Check `fetchStatus !== 'idle'` instead                                                                                                                                                                  |
| **GitHub PAT: no Checks perm**                         | Fine-grained PATs lack `Checks` permission. Use `gh run list/view` (Actions API), NOT `gh pr checks`                                                                                                                                                                          |
| **tRPC TS2742 under NodeNext**                         | `typeof appRouter` can't be named without internal `@trpc/server/dist/core/router` reference. Use `AnyRouter` annotation; refine to concrete type when procedures are added                                                                                                   |
| **WSL husky hooks need nvm PATH**                      | Husky v9 runs hooks under `sh`/`dash`; `nvm.sh` can't be sourced. Hooks add nvm node bin to PATH directly. `lint-staged` called without `npx`                                                                                                                                 |
| **CI: workspace deps need build before Vitest**        | Vitest resolves workspace packages via `exports` field (pointing to `dist/`). CI must build deps before running tests                                                                                                                                                         |
| **`gh pr edit` broken (Projects Classic)**             | Returns GraphQL error about Projects Classic deprecation. Use `gh api repos/{owner}/{repo}/pulls/{number} -X PATCH -f title="..." -f body="..."` instead                                                                                                                      |
| **`@fastify/raw-body` doesn't exist**                  | Official `@fastify/` scoped package not published on npm. Use `fastify-raw-body` (community package, v5.0.0 for Fastify 5)                                                                                                                                                    |
| **Codex CLI needs nvm in non-interactive shells**      | Codex installed via npm under nvm. tmux `send-keys` runs non-interactive shells; must source nvm manually before invoking `codex`. The `/codex-review` skill handles this automatically.                                                                                      |

**Version pins (do not upgrade without testing):**

| Package        | Pinned        | Notes                                                |
| -------------- | ------------- | ---------------------------------------------------- |
| Fastify        | 5.x           | Major version; check plugin compat before upgrading  |
| Drizzle ORM    | latest stable | Schema API evolving; pin after initial setup         |
| Pothos         | 4.x           | Manual Drizzle mapping; no breaking changes expected |
| GraphQL Yoga   | 5.x           | Fastify integration via handleNodeRequest            |
| ts-rest        | 3.x           | Fastify adapter; check OpenAPI generation compat     |
| tRPC           | 10.45         | Internal only; Zod error behavior specific to v10    |
| TanStack Query | 4.36          | isLoading behavior changes in v5                     |
| tus-js-client  | 4.3.1         | —                                                    |
| Stripe         | 20.3          | —                                                    |
| BullMQ         | 5             | —                                                    |

---

## Security Status

### Application Security (v2 — in progress)

- [ ] Rate limiting on all API surfaces (Fastify hook, cost-based for GraphQL)
- [ ] Security headers (@fastify/helmet: CSP, HSTS, X-Content-Type-Options)
- [x] Secrets in environment only (never committed)
- [x] Pre-commit hook blocks secrets (husky + `scripts/check-secrets.sh`)
- [ ] Zitadel OIDC token validation on all protected routes
- [ ] API key authentication with scopes
- [ ] Audit log for all sensitive actions
- [ ] File virus scanning before production bucket (ClamAV via BullMQ)
- [x] RLS policies on all tenant tables via Drizzle `pgPolicy` with FORCE
- [x] Application database role is NOT superuser
- [ ] Input validation with Zod on all API surfaces
- [ ] Zitadel webhook signature verification
- [ ] Stripe webhook signature verification + idempotency
- [ ] Storage: block public access via MinIO policy

### Production Deployment Checklist

- [ ] Change `app_user` password from default
- [ ] PostgreSQL SSL/TLS (`sslmode=require`)
- [ ] Connection pooling (PgBouncer)
- [ ] Database backups (WAL-G to S3)
- [ ] `pg_stat_statements` for query monitoring
- [ ] Rotate credentials quarterly
- [ ] AGPL license boundary documented (Zitadel is AGPL; Colophony code is unaffected)
- [ ] Monitoring stack: Prometheus + Grafana + Loki
- [ ] Verify RLS in production:
  ```bash
  docker compose exec postgres psql -U colophony -c \
    "SELECT usename, usesuper FROM pg_user WHERE usename = 'app_user';"
  docker compose exec postgres psql -U colophony -c \
    "SELECT relname, relforcerowsecurity FROM pg_class WHERE relname IN ('submissions', 'payments');"
  ```

---

## Common Pitfalls

1. **RLS Context Leakage**
   - ALWAYS use `SET LOCAL` inside transaction
   - NEVER use session-level `SET` with connection pooling
   - Application role MUST NOT be superuser
   - All tenant tables MUST have `FORCE ROW LEVEL SECURITY`
   - Test multi-tenancy isolation in EVERY feature

2. **Webhook Non-Idempotency**
   - ALWAYS check processed status before handling (Stripe and Zitadel webhooks)
   - Use database transaction for webhook processing
   - Record event ID after processing to prevent duplicates

3. **Missing DataLoaders (GraphQL)**
   - Every relation field in Pothos types MUST use a DataLoader
   - Without DataLoaders, GraphQL queries cause N+1 queries
   - Create loaders in `apps/api/src/graphql/loaders.ts`

4. **Hard-Coded Secrets**
   - Validate env schema with Zod at startup
   - Use environment variables for all configuration

5. **Pothos Type Drift**
   - Pothos types are manually mapped from Drizzle schema (no plugin)
   - When Drizzle schema changes, manually update corresponding Pothos types
   - Month 3 evaluation: reassess Pothos vs alternatives

6. **PCI Violations**
   - NEVER log card numbers or CVV
   - NEVER store card data in database
   - Use Stripe Checkout only

---

## Git Workflow

### Branching Strategy

- **`main`** — protected, always deployable. Requires PR + CI passing + senior dev review.
- **Feature branches** — branch from `main`, named `feat/<topic>`, `fix/<topic>`, `chore/<topic>`.
- **Squash merge** to `main` to keep history clean.

### Commit Messages

Use [Conventional Commits](https://www.conventionalcommits.org/):

```
feat(hopper): add form builder conditional logic engine
fix(register): prevent identity leak in cross-instance WebFinger
chore: update Drizzle to latest stable
docs: add Zitadel webhook setup guide
test: add RLS isolation test for payments
refactor(relay): extract email template renderer
```

Scope with component name when the change is component-specific.

### Commit Cadence

Commit at **stable checkpoints** — after each logical unit of work compiles and passes tests. Branch history is squash-merged anyway, so commit frequency doesn't affect `main`.

**Always commit before:**

- Risky operations (refactors, dependency upgrades, config changes)
- Ending a session (`/end-session` will catch uncommitted work)
- Switching context to a different task

**A good checkpoint is:**

- A new schema/migration that runs cleanly
- A service or route that compiles with its tests passing
- A hook or config change that's been verified
- Any working intermediate state you'd want to recover

`/start-session` detects incomplete previous sessions, so unexpected exits are covered — but committed work is always safer than uncommitted work.

### Push Cadence

Pushes serve different purposes than commits: backup, CI feedback, and reviewer visibility. Commits are local and squashed away; pushes are visible and trigger automation.

**Push when:**

- You've completed a **reviewable unit of work** — one or more commits that form a coherent change (e.g., a full schema rewrite, a new route with tests)
- You're **stepping away** — remote is backup; a local-only commit doesn't survive machine failure, WSL issues, or accidental `docker compose down -v`
- You want **CI feedback** — CI runs on push to PR branches; push to validate in a clean environment
- You want **code review** — run `/codex-review` before pushing for immediate local feedback

**Don't push:**

- Broken states — unlike commits, pushes trigger CI and are visible to reviewers; a push should at minimum compile
- Partial work that would confuse reviewers — if the PR is already open and you're mid-refactor, either finish or use a draft PR

**Create the PR when:**

- The branch is in a **reviewable state** — not necessarily "done," but coherent enough for feedback
- You have enough context for a **meaningful description** — summary, test plan, and any caveats
- **Draft PRs** are fine for early feedback or to get CI running while you continue work

### Git Hooks (husky)

**Pre-commit** — runs on `git commit`:

1. **Secret scanning** (`scripts/check-secrets.sh`) — blocks Stripe live keys, AWS keys, private keys, `.env` files
2. **lint-staged** — runs Prettier on staged `.ts`/`.tsx`/`.json`/`.md` files

**Pre-push** — runs on `git push`:

1. **Type check** (`pnpm type-check`) — full `tsc --noEmit` across all packages
2. **Lint** (`pnpm lint`) — ESLint across all packages

Bypass with `--no-verify` (use sparingly).

### CI Pipeline (GitHub Actions)

Runs on every PR to `main` and pushes to `main`:

| Job            | What it checks                                     |
| -------------- | -------------------------------------------------- |
| **quality**    | `format:check`, `lint`, `type-check`, `pnpm audit` |
| **unit-tests** | `pnpm test`                                        |
| **rls-tests**  | RLS tenant isolation integration tests             |
| **build**      | `pnpm build` (API + Web production build)          |

### Claude Code Git Workflow (IMPORTANT)

**NEVER push directly to `main`.** The `main` branch is protected and requires PRs.

When committing and pushing changes, ALWAYS follow this flow:

```bash
# 1. Create a feature branch (use conventional prefix)
git checkout -b feat/<topic>    # or fix/, chore/, test/, docs/, refactor/

# 2. Commit changes
git add <files>
git commit -m "feat: description"

# 3. Push the feature branch
git push -u origin <branch-name>

# 4. Create a PR
gh pr create --title "feat: description" --body "..."
```

The `pre-push-branch.js` hook will block any `git push` targeting `main` directly.

### Release Tagging

Use semver tags: `v{major}.{minor}.{patch}` — e.g., `v2.0.0`, `v2.1.0`

The v1 MVP is tagged as `v1.0.0-mvp`.

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

**Pre-edit:**

- `pre-edit-validate.js` — Blocks secrets, warns missing RLS context on Drizzle query methods
- `pre-payment-validate.js` — Warns when payment/webhook code lacks idempotency
- `pre-frontend-validate.js` — Validates frontend patterns (use client, shadcn, org context)
- `pre-router-audit.js` — Warns when route handlers have sensitive ops without audit logging
- `pre-push-branch.js` — Blocks `git push` directly to main; enforces feature branch + PR workflow

**Post-edit:**

- `post-schema.js` — Reminds to run `pnpm db:generate` after Drizzle schema changes
- `post-email-template.js` — Reminds to add text version for HTML emails
- `post-migration-validate.js` — Reminds to add RLS policies for new tables in migrations
- `post-commit-devlog.js` — Reminds to update `docs/DEVLOG.md` after git commits

### Codex Review Integration

Code reviews are performed locally via Codex CLI in a tmux session, managed by Claude Code.

- **Skill:** `/codex-review [plan|diff|branch]` (default: branch)
- **tmux session:** `codex-review` (lazy-initialized on first invocation)
- **Context isolation:** Codex is killed and relaunched between reviews
- **Idle detection:** Polls tmux capture-pane for `__CODEX_REVIEW_DONE__` sentinel
- **Branch diffs:** Always uses `origin/main` (fetched) to avoid stale local main

### MCP Servers (restart Claude Code to activate)

- **postgres**: Direct DB queries (`@modelcontextprotocol/server-postgres`)
- **redis**: Job/session inspection (`@modelcontextprotocol/server-redis`)
- **context7**: Library docs (`@upstash/context7-mcp`)
- **github**: PR/issue management (`@modelcontextprotocol/server-github`)
- **stripe**: Stripe API/docs (`@stripe/mcp`)
- **playwright**: E2E automation (`@anthropic/mcp-playwright`)
- **docker**: Container inspection — logs, health, stats (`@modelcontextprotocol/server-docker`)

Config template: `.claude/mcp-servers.example.json`

### Starting Development

```bash
docker-compose up -d          # PostgreSQL, Redis, MinIO, Zitadel
pnpm install
pnpm db:migrate               # Run Drizzle migrations
pnpm dev                      # API: 4000, Web: 3000
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

**Frontend (`apps/web/.env.local`):**

```bash
NEXT_PUBLIC_API_URL=http://localhost:4000
NEXT_PUBLIC_ZITADEL_AUTHORITY=http://localhost:8080
NEXT_PUBLIC_ZITADEL_CLIENT_ID=your-client-id
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_xxx
API_URL=http://localhost:4000  # SSR-only
```

**Backend (`apps/api/.env`):**

```bash
DATABASE_URL=postgresql://app_user:password@localhost:5432/colophony
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=
ZITADEL_AUTHORITY=http://localhost:8080
ZITADEL_WEBHOOK_SECRET=your-webhook-secret
STRIPE_SECRET_KEY=sk_test_xxx
STRIPE_WEBHOOK_SECRET=whsec_xxx
FEDERATION_DOMAIN=localhost
FEDERATION_ENABLED=false
```

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
- [ts-rest](https://ts-rest.com/docs) | [Pothos](https://pothos-graphql.dev/) | [GraphQL Yoga](https://the-guild.dev/graphql/yoga-server)
- [tRPC](https://trpc.io/docs) | [Next.js](https://nextjs.org/docs)
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
