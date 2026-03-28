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

## Key File Locations

Per-directory CLAUDE.md files contain domain-specific details:

- **`packages/db/CLAUDE.md`** — RLS rules (authoritative), schema files, migration workflow
- **`apps/api/CLAUDE.md`** — Hook registration, tRPC procedures, auth, webhooks
- **`apps/web/CLAUDE.md`** — tRPC client, providers, auth utilities, conventions

Full file index: [docs/file-index.md](docs/file-index.md) | Project structure: [docs/architecture.md](docs/architecture.md)

---

## Tech Stack

**Frontend:** Next.js 16, React 19, TypeScript (strict), Tailwind + shadcn/ui (New York), tRPC (internal), TanStack Query, tus-js-client, date-fns

**Backend:** Fastify 5, TypeScript (strict), Drizzle ORM, BullMQ 5, Zitadel (auth), Stripe, nodemailer

**API surfaces:** tRPC (built), oRPC REST + OpenAPI 3.1 (built). GraphQL (Pothos + Yoga) extracted to feature branch — re-merge when demand materializes

**Data:** PostgreSQL 16+ (RLS via Drizzle `pgPolicy`), Redis 7+, Garage (S3-compatible)

**Infra:** Docker Compose (self-hosted), Caddy (TLS + routing), Hetzner VPS

---

## Critical Patterns

### 1. Multi-Tenancy with RLS (CRITICAL)

**See `packages/db/CLAUDE.md`** for the authoritative RLS rules, `withRls()` usage, code examples, and full NEVER list.

Summary: RLS policies are in Drizzle schema via `pgPolicy`. Org context set via `SET LOCAL` inside transactions. Never query tenant data without setting context. Never make `app_user` a superuser.

### 2. Authentication (Zitadel OIDC)

**See `apps/api/CLAUDE.md`** for hook chain, token types, and auth details.

Summary: Zitadel handles all authentication. API validates tokens via Fastify `onRequest` hook. User lifecycle synced via Zitadel webhooks.

### 3. File Uploads (tusd)

Client → tusd sidecar (chunked, resumable) → pre-create hook validates → post-finish hook creates record → BullMQ → ClamAV scan → clean/quarantine. Uses tus-js-client on frontend, tusd sidecar in Docker Compose.

### 4. Payments (Stripe Checkout)

**See `apps/api/CLAUDE.md`** for PCI NEVER list and webhook idempotency patterns.

Summary: Stripe Checkout only (zero PCI scope). Two-step idempotency (INSERT event, check `processed` status). Never log card numbers or store card data.

### 5. Frontend

**See `apps/web/CLAUDE.md`** for tRPC client setup, providers, auth utilities, and conventions.

---

## Known Quirks & Gotchas

Domain-specific quirks are in per-directory CLAUDE.md files. Cross-cutting quirks below:

| Quirk                                                 | Details                                                                                                                                                                              |
| ----------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **Docker Compose env_file**                           | `env_file:` sets container env only. For YAML `${VAR}` substitution, use `--env-file .env` on CLI                                                                                    |
| **PostgreSQL init-db.sh**                             | Only runs on first DB creation. `docker compose down -v` to re-run                                                                                                                   |
| **PgBouncer: migrations must bypass**                 | `DATABASE_URL` (port 5432) for migrations. `DATABASE_APP_URL` (port 6432) through PgBouncer. Use `SET LOCAL` (not `SET`) — transaction pooling reuses connections                    |
| **WSL husky hooks need nvm PATH**                     | Husky v9 runs under `sh`/`dash`; hooks add nvm node bin to PATH directly                                                                                                             |
| **CI: workspace deps need build before Vitest**       | Vitest resolves workspace packages via `exports` → `dist/`. CI must build deps first                                                                                                 |
| **`drizzle-kit generate` TUI blocks automation**      | Write manual migrations in non-interactive shells; snapshot files may need regeneration interactively                                                                                |
| **Playwright `webServer.env` replaces `process.env`** | Must spread `...process.env` in `webServer.env` to ensure env vars reach dev servers                                                                                                 |
| **Zitadel issuer ± trailing slash**                   | JWKS verifier uses array issuer `[base, base + "/"]` to match both. Don't normalize                                                                                                  |
| **hivemind for dev servers**                          | `pnpm dev` uses hivemind. Use `pnpm dev:clean` to kill orphans. `Procfile.dev` sets `PORT=` explicitly per process to override hivemind's default                                    |
| **Caddy `DOMAIN` env var controls TLS**               | Real domain → LetsEncrypt. `localhost` → self-signed. Set in `.env.staging`/`.env.prod`                                                                                              |
| **Zitadel Actions v2 payload format**                 | `event_type`/`created_at`/`event_payload` (not camelCase). `ZITADEL-Signature` header: `t=<ts>,v1=<hmac>` over `<ts>.<body>`. Handler maps `user.human.*` → `user.*` via alias table |
| **GitHub: secrets don't trim whitespace**             | Verify with `echo "Length: ${#VAR} chars"` in workflow                                                                                                                               |
| **Garage admin API `UpdateClusterLayout` broken**     | Use CLI (`/garage layout assign`) via RPC. `start-garage.sh` handles this                                                                                                            |
| **Test fixtures must match DB constraints**           | Valid UUIDs, valid enum values, all non-nullable fields. Invalid fixtures pass type-check but fail at runtime                                                                        |
| **PostgreSQL migration behaviors**                    | `CREATE OR REPLACE FUNCTION` silently overwrites. RLS policies can cause infinite recursion across tables — test with `SET app.current_org_id` in psql                               |

**Version pin:** Drizzle ORM latest stable (schema API evolving). Other pins in per-directory CLAUDE.md files.

---

## Security Status

All security controls in place (rate limiting, auth, RLS, audit, input validation, webhook verification). All production TODOs complete (backups, credential rotation, RLS verification). See `docs/release-checklist.md`.

---

## Git Workflow

**NEVER push directly to `main`.** Protected branch — requires PR + CI + senior dev review. The `pre-push-branch.js` hook blocks direct pushes.

- **Branching:** `feat/<topic>`, `fix/<topic>`, `chore/<topic>` from `main`. Squash merge.
- **Commits:** [Conventional Commits](https://www.conventionalcommits.org/) — scope with component name (e.g., `feat(hopper): ...`).
- **Commit cadence:** At stable checkpoints. Always before risky ops, ending a session, or switching context.
- **Push cadence:** When you have a reviewable unit, are stepping away, or want CI feedback. Don't push broken states.

### Git Hooks (husky)

| Hook           | Checks                                                                                                                               |
| -------------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| **Pre-commit** | Secret scanning (`scripts/check-secrets.sh`), lint-staged (Prettier + ESLint `--max-warnings 0`)                                     |
| **Pre-push**   | `pnpm type-check` (tsc --noEmit, `db` + `api`), `pnpm lint`, Docker Compose validation (if changed), shell syntax check (if changed) |

### CI Pipeline (GitHub Actions)

Jobs: quality, unit-tests, rls-tests, queue-tests, service-integration-tests, security-tests, webhook-tests, python-sdk-tests, 9 Playwright suites, build. See `.github/workflows/ci.yml`.

**Path filtering:** Playwright suites run selectively based on changed files (`.github/scripts/detect-changes.sh`). Shared paths trigger all suites. Push to `main` runs everything. Fast jobs always run on non-docs PRs.

---

## Development Workflow

### Claude Code Hooks (run automatically)

**Pre-edit:** `pre-edit-validate.js` (secrets, RLS context), `pre-payment-validate.js` (idempotency), `pre-frontend-validate.js` (use client, shadcn, org context), `pre-router-audit.js` (audit logging), `pre-push-branch.js` (blocks push to main)

**Post-edit:** `post-edit-lint.js` (eslint on changed file — fix warnings immediately, do not defer), `post-schema.js` (db:generate reminder), `post-email-template.js` (text version), `post-migration-validate.js` (RLS for new tables), `post-commit-devlog.js` (DEVLOG reminder)

### Code Review Integration

- `/codex-review [plan|diff|branch]` — Codex CLI review
- `/opencode-review [plan|diff|branch]` — OpenCode CLI review

For interactive Codex in tmux: source nvm, `nvm use v22.22.0`, then `codex`. Use `codex resume` or `codex fork --last` for follow-up.

### Decision Surfacing in Plan Mode

Before writing the implementation plan, enumerate architectural gray areas as decision points with options and recommendations. Wait for user confirmation before proceeding. Skip for mechanical refactoring, fully-specified backlog items, or when user says "just do it."

### Plan Review: Codex Integration

Every non-trivial plan must be reviewed before presenting to the user:

1. Write the plan → 2. Run `/codex-review plan` automatically → 3. Adjust for critical issues → 4. Present to user

Skip for trivial plans (typo fix, single config change, doc-only update).

### Plan Specificity Standard

Plans must include: exact file paths, concrete type/interface names, function signatures with types, named test cases with assertions, import changes, and files that should NOT change. Goal: another developer could diff implementation against the plan. Mark exploratory items as `[exploratory]`.

### Plan Override Log

Log deliberate divergences from approved plans in a `## Plan Overrides` section of the PR description:

| File | Planned | Actual | Rationale |

Log when: files added/removed vs plan, exports differ, test cases changed substantially. Skip for: formatting, in-scope bug fixes, additional test cases.

### File Size Guideline

Soft limit of 500 lines per source file. Review trigger, not a hard gate.

### MCP Servers

postgres, redis, context7, stripe, playwright, docker. Config: `.claude/mcp-servers.example.json`.

### Starting Development

```bash
pnpm docker:up                # Core infra + Zitadel (or --full for ClamAV, --core to skip Zitadel)
pnpm install && pnpm db:migrate && pnpm db:seed
pnpm zitadel:setup            # After volume wipe
pnpm dev                      # hivemind: API:4000, Web:3000
```

**Other commands:** `pnpm db:generate`, `pnpm db:reset`, `pnpm db:seed:staging`, `pnpm db:validate-migrations`, `pnpm db:add-migration <name>`, `pnpm sdk:export-spec`, `pnpm sdk:generate`

**Monitoring:** `docker compose --profile monitoring up -d` (Prometheus:9090, Grafana:3001, AlertManager:9093, Loki:3100)

**CLI scripts** (all self-document with `--help`): `scripts/webhook-health.sh`, `scripts/grafana-query.sh`, `scripts/server-logs.sh`, `scripts/sentry-issues.sh`, `scripts/zitadel-admin.sh`

### Running Tests

```bash
pnpm test                     # Unit tests
pnpm test:e2e                 # API E2E (needs docker-compose up)
pnpm --filter @colophony/web test:e2e  # Playwright (needs dev servers)
```

Full testing guide: [docs/testing.md](docs/testing.md)

### Environment Variables

Canonical definition with Zod validation: `apps/api/src/config/env.ts` (66 variables, all defaults and descriptions inline).

---

## Development Tracks

All 10 tracks complete. Track 6 (Plugins) extracted to feature branch. See [docs/architecture.md Section 6](docs/architecture.md).
