# Development Log

Append-only session log. Newest entries first.

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
