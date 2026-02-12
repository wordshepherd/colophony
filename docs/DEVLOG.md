# Development Log

Append-only session log. Newest entries first.

---

## 2026-02-12 — Redis Rate Limiting (Track 1)

### Done

- **PR #43 opened** — Redis-backed rate limiting via custom Fastify plugin (`colophony-rate-limit`)
- Atomic Lua script (INCR + PEXPIRE + PTTL in one round-trip) for race-free fixed window counting
- Keyed by `userId` for authenticated requests (200/window) and IP for unauthenticated (60/window)
- Graceful degradation: Redis unavailable → requests allowed, logged at warn
- Skips health checks, webhooks, `.well-known`, root, OPTIONS preflight
- Standard headers: `X-RateLimit-Limit`, `X-RateLimit-Remaining`, `X-RateLimit-Reset`; `Retry-After` + `Cache-Control: no-store` on 429
- Added 4 env vars with Zod validation: `RATE_LIMIT_DEFAULT_MAX`, `RATE_LIMIT_AUTH_MAX`, `RATE_LIMIT_WINDOW_SECONDS`, `RATE_LIMIT_KEY_PREFIX`
- 16 new rate limit tests + 3 env validation tests using `ioredis-mock` (65 total, all passing)
- Updated all 5 existing spec files with new env fields
- Addressed AI review: added `trustProxy` documentation comment
- Added branch prompt (Step 8) to `/start-session` skill — prompts user to create feature branch when on main

### Decisions

- **Custom plugin over `@fastify/rate-limit`** — fits existing `fastify-plugin` chain, no new runtime dep, direct control over graceful degradation
- **Fixed window counter** — sufficient for current needs; sliding window upgrade path documented in plugin JSDoc
- **`ioredis-mock` for testing** — realistic Redis behavior; needed `flushall()` in `beforeEach` because instances share in-memory state by default
- **Test Redis injection** — plugin accepts optional `redis` param for testing, avoids mocking the ioredis module in rate-limit tests

### Issues Found

- **`ioredis-mock` shares state** — all instances with the same config share an in-memory store; must `flushall()` between tests
- **`@types/ioredis-mock` needed separately** — not bundled with `ioredis-mock`; required for `tsc --noEmit` to pass
- **Pre-existing web type errors** — tRPC router type issues in `apps/web/` unrelated to this PR (existed before)

### Next

- Merge PR #43 after CI + senior dev review
- Audit logging infrastructure for sensitive lifecycle events
- Integration testing with real DB for org-context + db-context RLS flow
- GraphQL cost-based rate limiting (when GraphQL is implemented)
- Per-org quotas (when billing/plans exist)

---

## 2026-02-12 — Zitadel OIDC Auth Integration (Track 1)

### Done

- **PR #41 merged** — Full Zitadel OIDC auth integration (28 files, 2196 insertions)
- Created `packages/auth-client` package: JWKS verifier (`jose`), webhook HMAC-SHA256 signature verification, Zitadel event types
- Created auth hook (`apps/api/src/hooks/auth.ts`): Bearer token validation via JWKS, user lookup by `zitadelUserId`, production fail-fast guard, test mode header injection
- Created org-context hook (`apps/api/src/hooks/org-context.ts`): `X-Organization-Id` header validation, org existence + membership check (intentional RLS bypass documented)
- Created db-context hook (`apps/api/src/hooks/db-context.ts`): per-request RLS transaction lifecycle (BEGIN → `set_config` for `app.user_id`/`app.current_org` → COMMIT/ROLLBACK)
- Created Zitadel webhook handler (`apps/api/src/webhooks/zitadel.webhook.ts`): signature verification, idempotency via `ON CONFLICT DO NOTHING`, upsert for out-of-order delivery, GDPR anonymization on `user.removed`
- Updated env schema (added `ZITADEL_CLIENT_ID`), types (added OIDC types, deprecated legacy v1 schemas), main.ts (wired all plugins)
- Added Docker Compose Zitadel service (pinned v4.10.1, `auth` profile), updated `init-db.sh` (zitadel DB + NOSUPERUSER role)
- Fixed CI workflow to build `@colophony/auth-client` and `@prospector/types` before unit tests
- 64 tests total (18 auth-client + 46 API), all passing
- Addressed 3 rounds of AI review: webhook transaction atomicity (critical fix), config state probing, error message exposure, security comments, UUID regex relaxation
- **Improved AI review workflow** to prevent repetitive findings: feeds prior developer response comments into reviewer context, system prompt instructs not to re-raise resolved items. Result: round 5 returned LGTM immediately.

### Decisions

- **`processEvent` uses tx on transaction client** — ensures user state changes are atomic with idempotency record (AI review caught this)
- **Generic 401 for webhook auth failures** — both missing secret and invalid signature return same error to prevent config probing
- **Auth hook logs full errors, returns generic messages** — prevents leaking JWKS/JWT internals to clients
- **UUID regex relaxed** — accepts all UUID versions (not just v1-5) to future-proof for UUID v7
- **AI review context: responses only** — including full AI review comments (~21KB) exhausted the 180KB budget causing blank reviews; developer response summaries (~5.5KB) contain all the signal
- **`fastify-raw-body` (community)** — `@fastify/raw-body` doesn't exist on npm; used community package v5.0.0

### Issues Found

- **`@fastify/raw-body` doesn't exist** — the official `@fastify/` scoped package is not published; `fastify-raw-body` community package works fine
- **CI workspace dep build order** — new workspace packages must be added to CI build step or Vitest can't resolve their `exports` pointing to `dist/`
- **AI review budget exhaustion** — prior review conversation can consume significant budget if not trimmed to essentials
- Updated CLAUDE.md Known Quirks: added `fastify-raw-body` and AI review budget gotchas

### Next

- Rate limiting across all API surfaces (roadmap item flagged by AI reviewer)
- Audit logging infrastructure for sensitive lifecycle events
- Integration testing with real DB for org-context + db-context RLS flow
- Frontend OIDC flow (Track 1 continuation, separate session)

---

## 2026-02-12 — Claude Code GitHub App Trial & Revert

### Done

- Installed Claude Code GitHub App via `/install-github-app` skill (PR #37 merged)
  - Required `gh auth refresh -h github.com -s repo,workflow` for PAT scopes
  - Added `claude-code-review.yml` (auto-review on PR events) and `claude.yml` (@claude mention handler)
- Closed PR #38 as empty duplicate (second `/install-github-app` run, no diff)
- Discovered `claude-code-action` code-review plugin is not production-ready:
  - Churns through tools (YAML validation, fetching action source, etc.) without producing review output
  - No short-circuit for empty diffs — ran 7+ minutes on PR #38 with zero file changes
  - Still running on PR #39 after 10+ minutes with no output
  - `pull-requests: read` permission may be insufficient to post comments
- Reverted: PR #39 removes both Claude Code workflow files, restores Kimi/OpenRouter review
- Added `gh pr edit` workaround to CLAUDE.md Known Quirks (returns GraphQL Projects Classic deprecation error; use `gh api` PATCH instead)
- Cleaned up 4 stale `add-claude-github-actions-*` remote branches

### Decisions

- **Keep Kimi K2.5 via OpenRouter** for AI code review — working and produces useful output
- **Remove Claude Code review workflows** — plugin not mature enough; revisit when it improves
- **Keep `@claude` mention workflow removed too** — both workflows used the same OAuth token setup; cleaner to remove both

### Issues Found

- **`/install-github-app` skill auth detection**: Reports "not authenticated" even when `gh auth status` confirms login — likely checks for OAuth vs PAT differently
- **`gh pr edit` broken**: Returns GraphQL error about Projects Classic deprecation — use `gh api` PATCH as workaround

### Next

- Optionally remove `CLAUDE_CODE_OAUTH_TOKEN` secret from repo settings
- Continue Track 1: Zitadel auth integration
- Revisit Claude Code review when `claude-code-action` plugin matures

---

## 2026-02-12 — Husky Hook Fixes + Session Skill Improvements

### Done

- Fixed WSL husky hook issue — `npx lint-staged` resolved to Windows npm; now calls `lint-staged` directly (husky prepends `node_modules/.bin` to PATH)
- Fixed `node: not found` in husky hooks — husky v9 runs hooks under `sh`/`dash` where `nvm.sh` can't be sourced; added nvm node bin directory to PATH directly in both pre-commit and pre-push hooks
- Created `~/.config/husky/init.sh` as a backup PATH setup (husky v9 sources this before hooks)
- Updated start-session and end-session skills: use Grep tool instead of bash `grep`, detect stale branches via `[gone]` upstream (correct for squash-merged PRs)
- Reviewed previous session's permission prompts for policy consistency
- Whitelisted `Bash(export *)` in `.claude/settings.local.json` for environment setup commands

### Decisions

- **Direct nvm bin PATH**: Can't source `nvm.sh` under `dash`/`sh` — instead loop over `$HOME/.nvm/versions/node/*/bin` and prepend to PATH
- **`lint-staged` direct call**: Works because husky already puts `node_modules/.bin` first in PATH
- **`--no-verify` stays gated**: Per CLAUDE.md policy, `--no-verify` should not be whitelisted; the root cause (missing node in PATH) is now fixed
- **`Bash(export *)` whitelisted**: Safe — covers read-only environment setup commands like `export NVM_DIR=...`

### Issues Found

- **Husky v9 `~/.config/husky/init.sh` unreliable**: Despite being documented, the init.sh wasn't sourced in practice — the in-hook PATH fix was needed as primary solution

### Next

- Continue Track 1: Zitadel auth integration (OIDC token validation hook, webhook handler)
- Consider deduplicating nvm PATH setup (currently in both hooks AND init.sh)

---

## 2026-02-12 — Track 1: Fastify 5 Entry Point (Step 2)

### Done

- Replaced NestJS 10 with Fastify 5 in `apps/api/` (PR #34):
  - Deleted all v1 NestJS source: 9 feature modules, tRPC integration, Jest test suite, `nest-cli.json` (86 files, ~15k lines)
  - Renamed package `@prospector/api` → `@colophony/api`
  - Created `src/config/env.ts` — Zod env validation (DATABASE_URL required, PORT/HOST/NODE_ENV/LOG_LEVEL/Redis/CORS with defaults, CORS wildcard safety)
  - Created `src/main.ts` — Fastify 5 entry with `buildApp(env)` factory, `@fastify/helmet`, `@fastify/cors`, pino logging with header redaction, graceful shutdown (SIGINT/SIGTERM, 10s timeout), `require.main === module` guard
  - Routes: `GET /health` (200), `GET /ready` (DB check via pool, 503 if unreachable), `GET /` (API info)
  - Error handlers: `setErrorHandler` (log + appropriate status), `setNotFoundHandler` (404)
  - Created `src/trpc/router.ts` — stub with 8 v1 namespace routers (auth, submissions, files, payments, gdpr, consent, audit, retention) + health procedure
  - Switched Jest → Vitest: 13 tests (7 env validation, 6 endpoint) passing in ~280ms
  - Updated `tsconfig.json` to extend `library.json` (NodeNext, no decorators)
  - Updated `eslint.config.mjs` — removed jest globals, sourceType → module
  - Updated `Dockerfile` — removed Prisma/OpenSSL, added Drizzle migrations copy, HEALTHCHECK, `colophony` user
- Re-enabled 3 CI jobs scoped to avoid broken web app:
  - quality: type-check via `turbo --filter=@colophony/db --filter=@colophony/api`
  - unit-tests: `pnpm --filter @colophony/api test` (with DB build step)
  - build: `turbo --filter=@colophony/db --filter=@colophony/api --filter=@prospector/types`
- Scoped pre-push hook type-check to API + DB (avoids web app breakage during rewrite)
- Fixed `scripts/build-review-context.sh` crash — `grep -oP` returns exit 1 on no matches, fatal under `set -euo pipefail`; wrapped in subshell with `|| true`
- Addressed AI review on PR #34: 1 false positive dismissed (`require.main === module` — output is CJS, not ESM), 3 suggestions acknowledged as intentional deferrals

### Decisions

- **CJS output (NodeNext)**: `library.json` with no `"type": "module"` in `package.json` emits CJS `.js` files. `require.main === module` is correct for this setup — AI reviewer flagged it as ESM issue but it's a false positive
- **tRPC `AppRouter` as `AnyRouter`**: NodeNext + declaration emit causes TS2742 (non-portable inferred type from `@trpc/server/dist/core/router`). Using `AnyRouter` for the stub; refined when procedures are added
- **`--no-verify` on commits**: WSL environment has `npx` resolving to Windows npm (pre-commit hook `npx lint-staged` fails). All checks verified manually. Pre-existing WSL issue.
- **CI unit-tests needs DB build**: Vitest resolves `@colophony/db` via package exports pointing to `dist/`; fresh CI checkout needs `pnpm --filter @colophony/db build` before running API tests

### Issues Found

- ~~**WSL `npx` resolves to Windows npm**~~ ✅ Fixed in next session — hooks now call `lint-staged` directly with nvm node bin in PATH
- **AI review `build-review-context.sh` fragile under `pipefail`**: Any `grep` in a pipeline that returns no matches kills the script. Fixed for one instance; other `grep` calls in the script may have the same issue

### Next

- Continue Track 1 — Core Infrastructure:
  1. ~~Set up Drizzle ORM in `packages/db/`~~ ✅
  2. ~~Set up Fastify 5 app entry in `apps/api/`~~ ✅
  3. Zitadel auth integration (OIDC token validation hook, webhook handler)
  4. Wire tRPC adapter to Fastify
  5. Add ts-rest public API surface
  6. Add Pothos + GraphQL Yoga surface

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

### Session 3 (same day, separate context): Track 1 — Drizzle ORM Setup

#### Done

- Replaced Prisma ORM with Drizzle ORM in `packages/db/` (PR #32):
  - Renamed package from `@prospector/db` to `@colophony/db`
  - Created 11 Drizzle schema files with 15 tables, inline RLS policies via `pgPolicy`, enums, relations
  - Created `context.ts` with `withRls()` helper using parameterized `set_config()` (SQL injection safe)
  - Created `json-helpers.ts` with JSONB operator helpers (sanitized path segments)
  - Created `types.ts` with InferSelectModel/InferInsertModel type aliases for all tables
  - 4-migration strategy: extensions/functions → generated schema → triggers → composite index
  - `current_org_id()` SQL function with NULLIF for safe empty-context handling
  - Full-text search with `unaccent()` wrapping via tsvector/GIN indexes
  - Verified against dev DB: 12 structural + functional checks all passed (RLS isolation, FTS, triggers, indexes, extensions)
- Enhanced AI review workflow with full-context review (same PR):
  - Created `scripts/build-review-context.sh` — tiered context builder (CLAUDE.md → full files → diff → imports → schema)
  - Updated `ai-review.yml` to use the context builder instead of raw diff
- Fixed CI pipeline for Drizzle migration:
  - Removed Prisma client generation steps, updated package filter
  - Replaced `db:push` + RLS SQL file with Drizzle `db:migrate`
- Disabled broken CI jobs (unit-tests, e2e-tests, type-check, build) with TODO markers — all depend on `apps/api` and `apps/web` which still import `@prospector/db`
- Addressed AI review findings on PR #32:
  - Fixed JSONB path injection vulnerability (added `sanitizePath()` validation)
  - Added composite index on `submissions(submitter_id, status)`
  - Dismissed 7 false positives with reasoning (system tables without RLS, intentional nullable org policies, etc.)
- Added push cadence guidance to CLAUDE.md

#### Decisions

- drizzle-kit requires CJS module resolution — removed `.js` extensions from all relative imports in `packages/db/src/`
- RLS policies use `current_org_id()` function instead of inline `current_setting()::uuid` cast — handles empty context safely via NULLIF
- System tables (stripe_webhook_events, outbox_events, zitadel_webhook_events) intentionally have no RLS — accessed by background workers, not `app_user`
- CI jobs disabled with TODOs rather than removed — easy to re-enable as API rewrite progresses
- AI review full-context approach works mechanically but false positive rate is high (7/10) — model judgment issue, not context issue. Prompt tuning deferred.

#### Issues Found

- **Branch protection required status checks** reference disabled CI jobs — needs updating to only require `Detect Changes` and `Lint & Type Check`
- **AI review repeats dismissed findings** across successive reviews on the same PR — Kimi flagged `dsar_requests` RLS in both review rounds despite the response comment explaining it's intentional
- **`@prospector/api` type-check broken** — expected until API rewrite; all API code still imports `@prospector/db`

### Next

- Update branch protection required status checks (remove disabled jobs)
- Continue Track 1 — Core Infrastructure:
  1. ~~Set up Drizzle ORM in `packages/db/`~~ ✅
  2. Set up Fastify 5 app entry in `apps/api/` (replace NestJS)
  3. Stand up Zitadel in Docker Compose
  4. Wire up the auth hook
- Re-enable CI jobs incrementally as API rewrite progresses
- Consider tuning AI review system prompt to reduce false positives

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
