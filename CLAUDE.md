# Prospector — Submissions Platform

Multi-tenant submissions management platform for creative arts magazines.
MVP complete. Self-hosted via Docker Compose.

**Team:** David (primary dev), Senior Developer (PR reviews), CEO (post-MVP priorities)
**Session log:** [docs/DEVLOG.md](docs/DEVLOG.md) — append entries after each session

---

## Quick Reference: Key File Locations

| What                     | Path                                                                                                |
| ------------------------ | --------------------------------------------------------------------------------------------------- |
| **Prisma schema**        | `packages/db/prisma/schema.prisma`                                                                  |
| **RLS policies SQL**     | `packages/db/prisma/rls-policies.sql`                                                               |
| **withOrgContext**       | `packages/db/src/context.ts`                                                                        |
| **Prisma singleton**     | `packages/db/src/client.ts`                                                                         |
| **Shared Zod schemas**   | `packages/types/src/` (8 files: auth, submission, file, payment, common, user, organization, index) |
| **Root tRPC router**     | `apps/api/src/trpc/trpc.router.ts`                                                                  |
| **tRPC context**         | `apps/api/src/trpc/trpc.context.ts`                                                                 |
| **tRPC controller**      | `apps/api/src/trpc/trpc.controller.ts`                                                              |
| **AuthService**          | `apps/api/src/modules/auth/auth.service.ts`                                                         |
| **GdprService**          | `apps/api/src/modules/gdpr/gdpr.service.ts`                                                         |
| **AuditService**         | `apps/api/src/modules/audit/audit.service.ts`                                                       |
| **PaymentsService**      | `apps/api/src/modules/payments/payments.service.ts`                                                 |
| **StorageService**       | `apps/api/src/modules/storage/storage.service.ts`                                                   |
| **BullMQ queue names**   | `apps/api/src/modules/jobs/constants.ts`                                                            |
| **RetentionService**     | `apps/api/src/modules/jobs/services/retention.service.ts`                                           |
| **OutboxService**        | `apps/api/src/modules/jobs/services/outbox.service.ts`                                              |
| **tRPC client**          | `apps/web/src/lib/trpc.ts`                                                                          |
| **Auth token utils**     | `apps/web/src/lib/auth.ts`                                                                          |
| **useAuth hook**         | `apps/web/src/hooks/use-auth.ts`                                                                    |
| **useOrganization hook** | `apps/web/src/hooks/use-organization.ts`                                                            |
| **useFileUpload hook**   | `apps/web/src/hooks/use-file-upload.ts`                                                             |
| **ProtectedRoute**       | `apps/web/src/components/auth/protected-route.tsx`                                                  |

Full project structure: [docs/architecture.md](docs/architecture.md)

---

## Tech Stack

**Frontend:** Next.js 15, TypeScript (strict), Tailwind 3.4 + shadcn/ui (New York), tRPC 10.45, TanStack Query 4.36, tus-js-client 4.3.1, date-fns

**Backend:** NestJS 10.4, tRPC 10.45, Prisma 5.22, BullMQ 5, Passport.js + JWT, Stripe 20.3, nodemailer

**Data:** PostgreSQL 16+ (RLS), Redis 7+, MinIO (S3-compatible)

**Infra:** Docker Compose (MVP), NO Kubernetes until 1000+ orgs

Full stack details with version pins: [docs/architecture.md](docs/architecture.md)

---

## Critical Patterns

### 1. Multi-Tenancy with RLS (CRITICAL)

All org-scoped queries MUST go through `withOrgContext()` in `packages/db/src/context.ts`.
It sets `SET LOCAL app.current_org` and `SET LOCAL app.user_id` inside a transaction.
Full implementation: [docs/architecture.md — Multi-Tenancy](docs/architecture.md#multi-tenancy-with-rls)

**NEVER:**

- Query without org context
- Use session-level `SET` (always `SET LOCAL`)
- Manually filter by `organizationId` (RLS does this)
- Use `app.current_user` (reserved keyword — use `app.user_id`)
- Use `$executeRaw` template literals for SET LOCAL (doesn't work with Prisma)
- Use `$executeRawUnsafe` for data queries (only for SET LOCAL with validated UUIDs)

### 2. Authentication (Hybrid JWT + Refresh)

**Access token:** 15-min JWT (stateless). **Refresh token:** 7-day, Redis, single-use rotation.
Implementation: `apps/api/src/modules/auth/auth.service.ts`
Full flow: [docs/architecture.md — Authentication](docs/architecture.md#authentication-flow)

### 3. File Uploads (tusd)

Client → tusd sidecar (chunked, resumable) → pre-create hook validates → post-finish hook creates record → BullMQ → ClamAV scan → clean/quarantine.
Implementation: `apps/api/src/modules/storage/`, `apps/api/src/modules/jobs/processors/virus-scan.processor.ts`
Full flow: [docs/architecture.md — File Upload](docs/architecture.md#file-upload-flow)

### 4. Payments (Stripe Checkout)

Stripe Checkout only (zero PCI scope). Webhook handler is **idempotent** — checks `StripeWebhookEvent.processed` first.
Implementation: `apps/api/src/modules/payments/`
Full flow: [docs/architecture.md — Payment](docs/architecture.md#payment-flow-stripe)

### 5. GDPR Compliance

Export (ZIP), erasure (anonymization), DSAR (30-day deadline), consent management, retention policies (daily job at 3 AM), audit logging (15+ actions), transactional outbox.
Implementation: `apps/api/src/modules/gdpr/`, `apps/api/src/modules/audit/`, `apps/api/src/modules/jobs/services/`
Full details: [docs/architecture.md — GDPR](docs/architecture.md#gdpr-compliance)

### 6. Frontend

tRPC client sends `Authorization` + `x-organization-id` headers. Tokens auto-refresh 1 min before expiry. `ProtectedRoute` wraps auth-required pages. `useOrganization` provides role checks.
Implementation: `apps/web/src/lib/trpc.ts`, `apps/web/src/hooks/`
Full patterns: [docs/architecture.md — Frontend](docs/architecture.md#frontend-architecture)

**API response patterns:**

- Paginated lists: `{ items, total, page, limit, totalPages }`
- Updates: `{ id, data: {...} }`
- Status transitions: `EDITOR_ALLOWED_TRANSITIONS` from `@prospector/types`

---

## Known Quirks & Gotchas

| Quirk                            | Details                                                                                                       |
| -------------------------------- | ------------------------------------------------------------------------------------------------------------- |
| **tRPC v10.45 Zod errors**       | Zod validation errors return 400 (`BAD_REQUEST`). Tests assert `toBe(400)` + `BAD_REQUEST` error code.        |
| **NestJS 10.4 Express 4 paths**  | `setGlobalPrefix` exclude must use `trpc/(.*)` (Express 4), NOT `trpc/*path` (Express 5).                     |
| **TrpcController URL stripping** | `@Controller('trpc')` prefix must be manually stripped from `req.url` before passing to tRPC middleware.      |
| **TanStack Query v4 isLoading**  | `isLoading` is `true` even when query is disabled (`enabled: false`). Check `fetchStatus !== 'idle'` instead. |
| **Prisma + Alpine OpenSSL**      | Must `apk add openssl` BEFORE `prisma generate` in Docker. Otherwise defaults to wrong engine.                |
| **pnpm deploy --prod Prisma**    | Misses generated client files (`.prisma/`). Requires `cp -r` step in Dockerfile.                              |
| **BullMQ Redis password**        | Uses `REDIS_HOST`/`REDIS_PORT`/`REDIS_PASSWORD` (not `REDIS_URL`). Password passed in `jobs.module.ts`.       |
| **Docker Compose env_file**      | `env_file:` sets container env only. For YAML `${VAR}` substitution, use `--env-file .env.prod` on CLI.       |
| **PostgreSQL init-db.sh**        | Only runs on first DB creation. Must `docker compose down -v` to re-run after changes.                        |

**Version pins (do not upgrade without testing):**

| Package        | Pinned | Notes                                |
| -------------- | ------ | ------------------------------------ |
| Prisma         | 5.22   | npx may fetch 7.x (breaking changes) |
| tRPC           | 10.45  | Zod error behavior specific to v10   |
| NestJS         | 10.4   | Express 4 path syntax                |
| TanStack Query | 4.36   | isLoading behavior changes in v5     |
| tus-js-client  | 4.3.1  | —                                    |
| Stripe         | 20.3   | —                                    |
| BullMQ         | 5      | —                                    |

---

## Security Status

### Application Security

- [x] Rate limiting on all endpoints (100 req/min default, 20 req/min auth)
- [x] Security headers (CSP, HSTS, X-Content-Type-Options)
- [x] Secrets in environment only (never committed)
- [x] Pre-commit hook blocks secrets (husky + `scripts/check-secrets.sh`)
- [x] Refresh token rotation on every use
- [x] Audit log for all sensitive actions
- [x] File virus scanning before production bucket (ClamAV via BullMQ)
- [x] RLS policies on all tenant tables with FORCE
- [x] Application database role is NOT superuser
- [x] Input validation with Zod on all tRPC inputs
- [ ] Email verification required before submission (implemented but not enforced in all paths)
- [x] Storage: block public access via MinIO policy

### Production Deployment Checklist

- [ ] Change `app_user` password from default
- [ ] PostgreSQL SSL/TLS (`sslmode=require`)
- [ ] Connection pooling (PgBouncer)
- [ ] Database backups (WAL-G to S3)
- [ ] `pg_stat_statements` for query monitoring
- [ ] Rotate credentials quarterly
- [ ] Verify RLS in production:
  ```bash
  docker compose exec postgres psql -U prospector -c \
    "SELECT usename, usesuper FROM pg_user WHERE usename = 'app_user';"
  docker compose exec postgres psql -U prospector -c \
    "SELECT relname, relforcerowsecurity FROM pg_class WHERE relname IN ('submissions', 'payments');"
  ```

---

## Common Pitfalls

1. **RLS Context Leakage**
   - ALWAYS use `SET LOCAL` inside transaction
   - NEVER use session-level `SET` with connection pooling
   - Use `$executeRawUnsafe` ONLY for SET LOCAL (validate UUIDs first)
   - NEVER use `$executeRawUnsafe` for data queries
   - Use `app.user_id` not `app.current_user` (reserved keyword)
   - Application role MUST NOT be superuser
   - All tenant tables MUST have `FORCE ROW LEVEL SECURITY`

2. **Webhook Non-Idempotency**
   - ALWAYS check `StripeWebhookEvent.processed` first
   - Use database transaction for webhook processing

3. **Missing Indexes**
   - ADD indexes before deploying (see `docs/architecture.md` for full list)
   - Monitor slow queries with `pg_stat_statements`

4. **Hard-Coded Secrets**
   - Use `ConfigService` for all env vars
   - Validate env schema with Zod at startup

5. **Cross-Org Data Leaks**
   - Test multi-tenancy isolation in EVERY feature
   - Use factories to create test data

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
feat: add consent revocation endpoint
fix: prevent cross-org data leak in audit export
chore: update Prisma to 5.22.1
docs: add deployment troubleshooting section
test: add RLS isolation test for payments
refactor: extract queue constants from jobs.module
```

### Git Hooks (husky)

**Pre-commit** — runs on `git commit`:

1. **Secret scanning** (`scripts/check-secrets.sh`) — blocks Stripe live keys, AWS keys, private keys, `.env` files
2. **lint-staged** — runs Prettier on staged `.ts`/`.tsx`/`.json`/`.md` files

**Pre-push** — runs on `git push`:

1. **Type check** (`pnpm type-check`) — full `tsc --noEmit` across all packages (~2-3s cached)
2. **Lint** (`pnpm lint`) — ESLint across all packages (~3-4s cached)

This catches the same errors CI checks, avoiding slow CI round-trips. Turbo caching makes subsequent runs near-instant.

Bypass with `--no-verify` (use sparingly).

### CI Pipeline (GitHub Actions)

Runs on every PR to `main` and pushes to `main`:

| Job            | Time   | What it checks                                                        |
| -------------- | ------ | --------------------------------------------------------------------- |
| **quality**    | ~1 min | `format:check`, `lint`, `type-check`, `pnpm audit`                    |
| **unit-tests** | ~2 min | `pnpm test` (308 tests, no infra needed)                              |
| **e2e-tests**  | ~5 min | `pnpm test:e2e` (65 tests, Postgres + Redis service containers)       |
| **build**      | ~2 min | `pnpm build` (API + Web production build)                             |
| **AI review**  | ~1 min | PR diff sent to OpenRouter → posts review comment (separate workflow) |

**AI Review** (`ai-review.yml`):

- Triggers after CI passes (`workflow_run`), sends diff to configurable model via OpenRouter
- Default model: Kimi K2.5 (`moonshotai/kimi-k2.5`), changeable via `AI_REVIEW_MODEL` Actions variable
- Reviews for: RLS violations, security issues, missing idempotency, GDPR gaps, input validation
- Posts findings as PR comment before senior dev review
- Requires `OPENROUTER_API_KEY` secret in GitHub repo settings

**Not in CI** (run manually or nightly):

- Playwright browser E2E (19 tests) — requires full stack, too slow/brittle for every PR

### What Runs Where

| Check                    | Pre-commit             | CI                | AI Review   | Claude Code                  |
| ------------------------ | ---------------------- | ----------------- | ----------- | ---------------------------- |
| Secret scanning          | `check-secrets.sh`     | —                 | —           | `pre-edit-validate.js`       |
| Format                   | lint-staged (Prettier) | `format:check`    | —           | —                            |
| Type check               | Pre-push               | `pnpm type-check` | —           | —                            |
| Lint                     | Pre-push               | `pnpm lint`       | —           | —                            |
| Unit tests               | —                      | `pnpm test`       | —           | —                            |
| API E2E tests            | —                      | `pnpm test:e2e`   | —           | —                            |
| Build verification       | —                      | `pnpm build`      | —           | —                            |
| Dependency audit         | —                      | `pnpm audit`      | —           | —                            |
| RLS / multi-tenancy      | —                      | —                 | Diff review | `pre-edit-validate.js`       |
| Security vulnerabilities | —                      | —                 | Diff review | `pre-edit-validate.js`       |
| Audit logging checks     | —                      | —                 | Diff review | `pre-router-audit.js`        |
| Payment idempotency      | —                      | —                 | Diff review | `pre-payment-validate.js`    |
| GDPR compliance          | —                      | —                 | Diff review | —                            |
| Frontend patterns        | —                      | —                 | —           | `pre-frontend-validate.js`   |
| Migration RLS reminder   | —                      | —                 | —           | `post-migration-validate.js` |
| DEVLOG reminder          | —                      | —                 | —           | `post-commit-devlog.js`      |
| Scaffolding              | —                      | —                 | —           | Skills (`/new-router`, etc.) |

### PR Process

1. Create feature branch from `main`
2. Make changes, commit with conventional commit messages
3. Push and open PR (template auto-fills checklist)
4. CI runs automatically — all 4 jobs must pass
5. Senior dev reviews
6. Squash merge to `main`

### Release Tagging

Use semver tags for releases:

```
git tag -a v1.0.0 -m "MVP release"
git push origin v1.0.0
```

Format: `v{major}.{minor}.{patch}` — e.g., `v1.0.0`, `v1.1.0`, `v1.0.1`

---

## Environment Promotion

### Environments

| Environment    | Compose File                 | Env File                                     | Deploy Trigger                    |
| -------------- | ---------------------------- | -------------------------------------------- | --------------------------------- |
| **Local**      | `docker-compose.yml`         | `.env` (from `.env.example`)                 | Manual (`docker compose up`)      |
| **Staging**    | `docker-compose.staging.yml` | `.env.staging` (from `.env.staging.example`) | Auto on merge to `main`           |
| **Production** | `docker-compose.prod.yml`    | `.env.prod` (from `.env.prod.example`)       | Manual dispatch in GitHub Actions |

### Promotion Flow

```
local → PR → CI passes → merge to main → auto-deploy staging → verify → manual deploy production
```

### What Differs Per Environment

| Setting       | Local                       | Staging                     | Production         |
| ------------- | --------------------------- | --------------------------- | ------------------ |
| `NODE_ENV`    | development                 | production                  | production         |
| Stripe keys   | `sk_test_`                  | `sk_test_`                  | `sk_live_`         |
| Log level     | default                     | debug                       | default (info)     |
| Memory limits | none                        | lower (384M API)            | higher (512M API)  |
| ClamAV        | optional (`--profile full`) | optional (`--profile full`) | recommended        |
| Database      | `prospector`                | `prospector_staging`        | `prospector`       |
| Volumes       | shared dev volumes          | `staging_*` prefixed        | production volumes |

### Deploying

**Staging** (automatic):
Merging to `main` triggers `.github/workflows/deploy.yml` → builds → SSHs to staging server → `docker compose up`.

**Production** (manual):
Go to Actions → Deploy → Run workflow → select "production" → optionally specify a git tag.

**GitHub Environments** required secrets/vars:

- `STAGING_HOST`, `STAGING_USER`, `STAGING_SSH_KEY`, `STAGING_DOMAIN`, `STAGING_APP_DIR`
- `PRODUCTION_HOST`, `PRODUCTION_USER`, `PRODUCTION_SSH_KEY`, `PRODUCTION_DOMAIN`, `PRODUCTION_APP_DIR`

Production environment should have **required reviewers** enabled in GitHub settings for approval gates.

---

## Development Workflow

### Claude Code Skills

```
# Backend
/db-reset             # Reset database and apply RLS policies
/db-reset --test      # Reset test database
/new-router <name>    # Scaffold tRPC router with RLS tests
/new-module <name>    # Scaffold NestJS module with service, tests, exports
/new-processor <name> # Scaffold BullMQ job processor with service
/new-migration <name> # Add Prisma model + migration + RLS policies
/stripe-webhook <evt> # Add Stripe webhook handler with idempotency
/test-rls             # Run RLS integration tests

# Frontend
/new-page <name>      # Scaffold Next.js page (auth, dashboard, or public)
/new-component <name> # Scaffold React component (form, list, dialog, or basic)
/new-hook <name>      # Scaffold React hook (query, mutation, or state)
/new-e2e <feature>    # Scaffold Playwright E2E test with helpers
```

### Claude Code Hooks (run automatically)

**Pre-edit:**

- `pre-edit-validate.js` — Blocks secrets, warns missing RLS context on all Prisma query methods
- `pre-payment-validate.js` — Warns when payment/webhook code lacks idempotency
- `pre-frontend-validate.js` — Validates frontend patterns (use client, shadcn, org context)
- `pre-router-audit.js` — Warns when router has sensitive ops without audit logging

**Post-edit:**

- `post-schema.js` — Auto-regenerates Prisma client after schema changes
- `post-email-template.js` — Reminds to add text version for HTML emails
- `post-migration-validate.js` — Reminds to add RLS policies for new tables in migrations
- `post-commit-devlog.js` — Reminds to update `docs/DEVLOG.md` after git commits

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
docker-compose up -d          # PostgreSQL, Redis, MinIO
pnpm install
pnpm db:generate              # Generate Prisma client
pnpm db:push                  # Sync schema to database
pnpm dev                      # API: 4000, Web: 3000
```

### Running Tests

```bash
pnpm test                     # Unit tests (308: 191 API + 117 Web)
pnpm test:e2e                 # API E2E (65 tests, needs docker-compose up)
pnpm --filter @prospector/web test:e2e  # Playwright (19 tests, needs dev servers)
```

Full testing guide: [docs/testing.md](docs/testing.md)

### Database Management

```bash
pnpm db:migrate               # Run migrations
pnpm db:studio                # Prisma Studio
pnpm db:seed                  # Seed test data
pnpm db:reset                 # Reset database
```

### Environment Variables

**Frontend (`apps/web/.env.local`):**

```bash
NEXT_PUBLIC_API_URL=http://localhost:4000
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_xxx
API_URL=http://localhost:4000  # SSR-only
```

**Backend (`apps/api/.env`):**

```bash
DATABASE_URL=postgresql://app_user:password@localhost:5432/prospector
REDIS_URL=redis://localhost:6379
JWT_SECRET=your-secret-key
STRIPE_SECRET_KEY=sk_test_xxx
STRIPE_WEBHOOK_SECRET=whsec_xxx
```

### Database Setup Notes

**First-time:** `docker-compose up -d` auto-runs `scripts/init-db.sh`, creating the `app_user` role.

**After changing init-db.sh:** Must `docker compose down -v` then `docker-compose up -d` (PostgreSQL only runs init on first creation).

**Verify config:**

```bash
docker-compose exec postgres psql -U prospector -c \
  "SELECT usename, usesuper FROM pg_user WHERE usename = 'app_user';"
# Expected: app_user | f
```

---

## Post-MVP Roadmap

### Immediate (pre-launch)

- [x] Git pre-commit hook for secrets (husky + `scripts/check-secrets.sh`)
- [x] CI pipeline (GitHub Actions: lint, type-check, unit tests, E2E, build)
- [x] CD pipeline (GitHub Actions: staging auto-deploy, production manual dispatch)
- [x] Staging environment (`docker-compose.staging.yml`, `.env.staging.example`)
- [x] Dependency scanning (Dependabot + `pnpm audit` in CI)
- [x] Security policy (`SECURITY.md`)
- [ ] Enforce email verification in all submission paths
- [ ] Zod validation for env vars at API startup

### Short-term

- [ ] Email provider integration (SendGrid recommended)
- [ ] Error monitoring (Sentry)
- [ ] Database backups (WAL-G to S3 daily, Redis RDB hourly)
- [ ] S3 versioning for file storage

### Medium-term (Phase 2 — SaaS)

- [ ] Managed services (ECS/Fargate or Fly.io)
- [ ] Multi-tenant SaaS platform
- [ ] OAuth providers (Google, GitHub)
- [ ] CQRS for read-heavy paths

---

## References

- [Next.js](https://nextjs.org/docs) | [tRPC](https://trpc.io/docs) | [NestJS](https://docs.nestjs.com)
- [Prisma](https://www.prisma.io/docs) | [BullMQ](https://docs.bullmq.io) | [tus](https://tus.io)
- [Stripe](https://stripe.com/docs/api) | [PostgreSQL RLS](https://www.postgresql.org/docs/current/ddl-rowsecurity.html)
- [Transactional Outbox](https://microservices.io/patterns/data/transactional-outbox.html)

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
