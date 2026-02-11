# Development Log

Append-only session log. Newest entries first.

---

## 2026-02-11 — v2 Bootstrap: Tooling Transition

### Done

- Tagged v1 MVP as `v1.0.0-mvp` (annotated tag on current HEAD)
- Full CLAUDE.md rewrite (499 lines) for Colophony v2 stack: Fastify 5, Drizzle ORM, Zitadel, ts-rest, Pothos + GraphQL Yoga
  - Suite components table (Hopper, Slate, Relay, Register)
  - All v2 target file locations, tech stack, critical patterns
  - Security checklist reset, new known quirks, updated version pins
  - Development tracks table, updated env vars (Zitadel, Federation)
- Updated 4 blocking hooks for Drizzle/Fastify patterns:
  - `pre-edit-validate.js` — Prisma query methods → Drizzle (`.select()`, `.insert()`, etc.)
  - `pre-payment-validate.js` — Prisma/NestJS patterns → Drizzle/Fastify
  - `pre-router-audit.js` — tRPC router detection → Fastify route/handler detection
  - `post-schema.js` — Prisma client generation → Drizzle migration reminder
- Updated `hooks.json` event patterns (`schema.prisma` → `schema/*.ts`, `routers/*.router.ts` → `routes/*.ts` + `.route.ts` + `.handler.ts`, added `drizzle/**/*.sql`)
- Rewrote 7 backend skills for Colophony stack:
  - `new-router.md` → `new-route.md` (ts-rest contract + Fastify handler + Drizzle + Vitest)
  - `new-module.md` → `new-service.md` (plain service class, no NestJS decorators)
  - `new-processor.md` (BullMQ Worker function, no NestJS `@Processor`)
  - `new-migration.md` (Drizzle schema + `pgPolicy` + `enableRLS()` + drizzle-kit)
  - `stripe-webhook.md` (Fastify route + Drizzle idempotency)
  - `test-rls.md` (Drizzle pgPolicy, no separate rls-policies.sql)
  - `db-reset.md` (Drizzle migrations instead of Prisma db push)
- Removed old v1 skill files (`new-router.md`, `new-module.md`)
- Restructured all skills from flat `skill-name.md` to `skill-name/SKILL.md` directory format
- Addressed AI review findings on PR #19 (RLS context and transaction safety):
  - `new-processor` skill: require `organizationId` in job data, use `withOrgContext` for all tenant-scoped queries in workers
  - `stripe-webhook` skill: wrap idempotency check + process + mark in a single `db.transaction` to prevent race conditions
  - `new-service` skill: document that tenant-scoped operations need a transaction with RLS context
- Fixed CI pipeline for AI review workflow (PRs #20 and #21):
  - PR #20: avoid `ARG_MAX` by piping large PR diffs via stdin instead of shell arguments
  - PR #21: eliminate all shell variable expansion for large content using heredocs and temp files
- Rewrote `ai-review.yml` to handle large diffs safely (file-based approach, no shell interpolation)
- Created 5 new v2 research documents:
  - `docs/architecture-v2-planning.md` (~3700 lines)
  - `docs/api-layer-v2-research.md` (~1300 lines)
  - `docs/competitive-analysis.md` (~1150 lines)
  - `docs/form-builder-research.md` (~1330 lines)
  - `docs/research/plugin-extension-system.md` (~1550 lines)

### Prior sessions (same day, separate contexts)

- Architecture v2 research: 8 research agents covering competitive analysis, backend frameworks, ORM/data access, auth services, hosting, API layer, form builder, federation protocol, plugin system
- Architecture v2 planning document (`docs/architecture-v2-planning.md`, ~3700 lines)
- API layer v2 research document (`docs/api-layer-v2-research.md`, ~1300 lines) — fully updated for Fastify/Drizzle
- Form builder research document (`docs/form-builder-research.md`)
- Component naming: Hopper, Slate, Relay, Register — propagated through all docs
- Bulk rename: Prospector → Colophony, PFP → CFP, @prospector/_ → @colophony/_
- Expanded interaction effects [3] (Drizzle + Zitadel webhook sync) and [4] (Zitadel + Federation identity layering) with full implementation guides

### Decisions

- Same repo for v2 (no fresh repo) — preserves git history, DEVLOG, CI config
- v1 code preserved under `v1.0.0-mvp` tag for reference
- Hooks and skills must be updated BEFORE starting v2 coding (they'd actively fight the new stack)
- Frontend skills (new-page, new-component, new-hook, new-e2e) left unchanged — Next.js/React patterns are the same in v2
- Session skills (start-session, end-session, check-ai-review) left unchanged — workflow-only, no stack dependencies
- AI review on PR #19 surfaced legitimate RLS gaps in skill templates — addressed before merge

### Issues Found

- **AI review `ARG_MAX`**: GitHub Actions shell steps hit argument length limits when passing large PR diffs as variables. Fixed by switching to file-based approach with heredocs (PRs #20, #21)
- **Shell expansion in CI**: `$` characters in TypeScript template literals were being expanded by bash in the AI review workflow. Fixed by eliminating all shell variable interpolation for content payloads

### Session 2 (same day, separate context): Session Workflow Hardening

#### Done

- Completed end-of-session catch-up for previous incomplete session (DEVLOG update, PR #22)
- Fixed DEVLOG research document count typo flagged by AI review (PR #23)
- Added incomplete session detection to `/start-session` skill (PR #24):
  - Checks DEVLOG date vs latest commit date, stale local branches, current branch already merged
  - Alerts user and offers catch-up housekeeping before briefing
- Added stale branch cleanup to `/end-session` skill (PR #24)
- Addressed 3 rounds of AI review on PR #24:
  - Round 1: shell portability (`grep -oP` → `grep -oE`, `head -20` → `grep -m1`, `tr` → `sed`)
  - Round 2: missing `git fetch`, broken merged-branch detection (`^\*` exclusion bug), quoted branch names
  - Round 3: `main` false positive in merged-branch check
- Added commit cadence guidance to CLAUDE.md (PR #25)
- Added docs-only CI skip via `dorny/paths-filter` (PR #28):
  - Initial attempt with `paths-ignore` blocked merging (rulesets require all status checks)
  - Switched to job-level filtering: lightweight `Detect Changes` job runs `dorny/paths-filter`, four CI jobs skip via `if:` when docs-only
  - Skipped jobs satisfy rulesets (unlike never-started workflows)
  - Fixed permissions: job-level `permissions` replaces all defaults, needed both `contents: read` and `pull-requests: read`
  - Replaced `dorny/paths-filter` with shell-based detection (PR #30) — `dorny` pattern semantics proved unreliable across multiple attempts (`paths-ignore`, negative patterns, `every` quantifier all failed). Shell check uses `gh pr diff --name-only` + `grep` to count non-docs files.

#### Decisions

- Detect missed `/end-session` at session start (not via exit hooks) — more reliable, can actually act on it
- Commit at stable checkpoints — branch history is squash-merged anyway, frequent commits aid recovery
- Skip CI for docs/markdown only — pre-commit Prettier is sufficient, AI review adds no value on DEVLOGs
- Keep CI for skill files — AI reviewer caught 3 real bugs in skill shell commands this session
- AI reviewer tends to repeat dismissed findings across rounds — dismiss confidently when the rationale hasn't changed
- Avoid `dorny/paths-filter` — unreliable pattern semantics; simple shell scripts are more debuggable

### Next

- Start Track 1 — Core Infrastructure:
  1. Set up Drizzle ORM in `packages/db/` (replace Prisma schema)
  2. Set up Fastify 5 app entry in `apps/api/` (replace NestJS)
  3. Stand up Zitadel in Docker Compose
  4. Wire up the auth hook

---

## 2026-02-10 — Dependabot Triage & ESLint Cleanup

### Done

- Verified `workflow_run` AI review trigger works: CI on PR → AI review posts comment (confirmed on PR #1)
- Created GitHub labels (`dependencies`, `ci`, `docker`) for Dependabot
- Merged Dependabot PRs #1 (`actions/checkout` v4→v6) and #2 (`actions/setup-node` v4→v6)
- Closed Dependabot PRs #3, #4 (Node 25-alpine — non-LTS, project pinned to Node 20)
- Added `ignore` rules to `dependabot.yml` to block major Node version bumps in Docker images
- Fixed all 19 ESLint warnings in web app (unused imports/vars, `useMemo` for exhaustive-deps)
- Fixed 3 ESLint warnings in API (floating promises)
- Updated GitHub token permissions: organization read/write access to projects

### Decisions

- Dependabot Docker updates ignore major Node bumps — upgrade to next LTS manually
- `workflow_run` AI review correctly skips pushes to main (only reviews PRs)

### Next

- Email verification enforcement
- Zod validation for env vars at API startup

---

## 2026-02-10 — CI Debugging & Pre-Push Hook

### Done

- Fixed all 4 CI jobs (Lint, Type Check, Unit Tests, E2E) across 8 iterative commits on PR #5
- Added pre-push hook (`.husky/pre-push`) — runs `pnpm type-check` + `pnpm lint` before every push
- Changed AI review to `workflow_run` trigger (only runs after CI passes)
- Added `DATABASE_APP_URL` env var to CI for non-superuser RLS testing

### Issues Found

- **RLS E2E false pass**: `appPrisma` used `DATABASE_TEST_URL` which CI set to superuser — both clients were superuser, RLS silently bypassed. Fixed with separate `DATABASE_APP_URL`
- **tRPC Zod errors are 400, not 500**: tests and docs claimed `INTERNAL_SERVER_ERROR`; actual behavior is `BAD_REQUEST`. `ts-jest` never caught this because it transpiles without type-checking
- **Web tsc resolves API source via path alias**: `@prospector/api/*` → `../api/src/*` means web's `tsc --noEmit` type-checks NestJS decorators without `experimentalDecorators`
- **Prisma field name drift**: `previousStatus`/`newStatus` in code vs `fromStatus`/`toStatus` in schema; `userId_organizationId` vs `organizationId_userId` (Prisma generates names in schema declaration order)
- **`next-env.d.ts` lint error**: auto-generated triple-slash references trigger ESLint
- **`gcTime` vs `cacheTime`**: TanStack Query v4 uses `cacheTime`; `gcTime` is v5

### Decisions

- Pre-push (not pre-commit) for type-check/lint — keeps commits fast, catches errors before CI
- Pre-commit stays lean: secret scanning + Prettier only
- All these errors were invisible locally because `ts-jest` only transpiles (no type checking) and local Docker had full RLS setup

### Next

- Merge PR #5, verify `workflow_run` AI review triggers from `main`
- Consider cleaning up the 19 ESLint warnings in web app

---

## 2026-02-10 — AI Code Review Pipeline

### Done

- Created `.github/workflows/ai-review.yml` — AI-powered PR review via OpenRouter
  - Triggers on PR open/update to `main`
  - Sends diff + PR context to configurable model (default: Kimi K2.5)
  - System prompt tuned for project-specific concerns (RLS, idempotency, GDPR, PCI, audit logging)
  - Posts structured review as PR comment with severity levels (LGTM / Minor / Issues)
  - Error handling: posts failure notice with link to workflow run
- Updated CLAUDE.md: CI pipeline table, "What Runs Where" matrix (added AI Review column)

### Decisions

- Model is configurable via `AI_REVIEW_MODEL` GitHub Actions variable (swap without code changes)
- Default: `moonshotai/kimi-k2.5` via OpenRouter
- AI review is advisory (posts comment, doesn't block merge) — senior dev makes final call
- Diff truncated at 200K chars to stay within model context limits
- Low temperature (0.2) for consistent, focused reviews
- Ignores formatting/style (handled by Prettier/ESLint in CI)

### Next

- Add `OPENROUTER_API_KEY` secret to GitHub repo settings after initial push
- Optionally set `AI_REVIEW_MODEL` variable to override default

---

## 2026-02-10 — Environment Promotion & Dev Practices

### Done

- Created `.editorconfig` (consistent formatting across editors)
- Created `.node-version` (Node 20, matches package.json + CI)
- Created `.github/CODEOWNERS` (dmahaffey owns all, extra scrutiny on DB/CI)
- Added `pnpm audit --audit-level=high` to CI quality job
- Created `.github/dependabot.yml` (weekly npm + GH Actions, monthly Docker)
- Created `docker-compose.staging.yml` (mirrors prod, lower resources, debug logging)
- Created `.env.staging.example` (staging env template with test Stripe keys)
- Created `.github/workflows/deploy.yml` — CD pipeline: staging auto on merge, production manual dispatch with approval
- Created `SECURITY.md` (vulnerability disclosure policy)
- Added Environment Promotion section to CLAUDE.md (local → staging → prod flow, what differs, deploy process)
- Added release tagging convention to Git Workflow section
- Updated `.gitignore` for `.env.staging`
- Updated roadmap: checked off CD, staging, Dependabot, SECURITY.md items

### Decisions

- Staging auto-deploys on merge to main; production requires manual dispatch + reviewer approval
- Staging uses separate `staging_*` Docker volumes and `prospector_staging` database
- Staging gets debug logging and relaxed rate limits (200/50 vs 100/20)
- Dependabot groups minor/patch npm updates into single PRs to reduce noise
- `pnpm audit` is `continue-on-error: true` — warns but doesn't block CI (avoids transient advisory churn)

### Next

- `pnpm install` to activate husky (needs initial commit first)
- Initial commit and push to create `main` branch
- Configure GitHub environments (staging/production secrets + required reviewers)
- Email verification enforcement
- Zod validation for env vars at API startup

---

## 2026-02-10 — Dev Practices & CI/CD Setup

### Done

- Added husky + lint-staged pre-commit hooks (secret scanning + format/lint staged files)
- Created `scripts/check-secrets.sh` — blocks Stripe live keys, AWS keys, private keys, .env files
- Created `.github/workflows/ci.yml` — 4-job pipeline: quality, unit-tests, e2e-tests, build
- Created `.github/pull_request_template.md` with security checklist
- Added Git Workflow section to CLAUDE.md (branching, conventional commits, PR process, "what runs where" table)
- New hooks: `pre-router-audit.js` (audit logging), `post-migration-validate.js` (RLS), `post-commit-devlog.js`
- New skills: `/new-migration` (Prisma model + RLS), `/new-e2e` (Playwright test scaffold)
- Fixed `pre-edit-validate.js` RLS check to cover all 15 Prisma query methods (was only `findMany`)
- Added Docker MCP server to `.claude/mcp-servers.example.json`

### Decisions

- Conventional Commits for commit messages (feat/fix/chore/docs/test/refactor)
- Squash merge to main — keeps history clean
- CI runs lint + type-check + unit tests + API E2E on every PR; Playwright E2E stays manual/nightly
- Claude Code hooks handle pattern-level validation (RLS, audit, idempotency) that CI can't catch
- Post-commit hook for DEVLOG.md instead of a skill — enforces usage automatically

### Next

- `pnpm install` to activate husky (needs initial commit first)
- Initial commit and push to create `main` branch
- Email verification enforcement
- Zod validation for env vars at API startup

---

## 2026-02-10 — Documentation Restructuring

### Done

- Created `docs/architecture.md` — full architecture reference (694 lines)
- Created `docs/testing.md` — testing guide with all quirks and bugs (315 lines)
- Created `docs/DEVLOG.md` — this file
- Rewrote `CLAUDE.md` — trimmed from 1016 to 346 lines, added key file locations table, known quirks, updated security checklist
- Archived `docs/HANDOFF.md` — replaced with redirect notice (13 lines, was 448)

### Decisions

- CLAUDE.md keeps operational patterns (NEVER lists, pitfalls) but moves full code blocks to architecture.md
- Testing quirks and production bugs consolidated in testing.md for future reference
- DEVLOG.md replaces the weekly progress tracking in CLAUDE.md and HANDOFF.md
- Version pins documented explicitly (Prisma 5.22, tRPC 10.45, NestJS 10.4, TanStack Query 4.36, etc.)

### Next

- Docker Compose production config refinements
- Self-hosted installation script polish
- ~~Pre-commit hook for secrets~~ (done — see session above)
- Email verification enforcement (currently skippable)

---

## 2026-01-06 through 2026-02-09 — MVP Build (Weeks 1-5)

### Done

- **Week 1**: Turborepo monorepo, Prisma schema (17+ tables), RLS policies, JWT + refresh token auth, rate limiting + security headers
- **Week 2**: tRPC routers (submissions, files, payments, auth), tusd file uploads, ClamAV virus scanning, Stripe payments, email service
- **Week 3**: GDPR export/erasure, audit logging (15+ actions), retention policies, DSAR handling, outbox pattern, consent management
- **Week 4**: Next.js frontend with shadcn/ui, auth UI, submission forms with tus-js-client uploads, editor dashboard, Stripe Checkout flow
- **Week 5**: 392 tests (191 API unit + 117 Web unit + 65 API E2E + 19 Playwright), Docker Compose production config, deployment docs, beta deployment (10 bugs found and fixed)

### Decisions

- tRPC over REST for MVP (type safety, faster iteration)
- RLS with FORCE for multi-tenancy (database-level isolation)
- Stripe Checkout only (zero PCI scope)
- Transactional outbox for reliable notifications
- Superuser DB for E2E tests (RLS tested separately via dual-client pattern)

### Issues Found

- See [docs/testing.md](./testing.md) — "Production Bugs Found During Testing" section for all 18 bugs discovered and fixed
