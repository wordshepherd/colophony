# Testing Guide

Comprehensive testing reference for the Colophony platform.
For architecture details, see [docs/architecture.md](./architecture.md).

---

## Running Tests

```bash
# Unit tests (308 tests: 191 API + 117 Web, 26 suites)
pnpm test

# Watch mode
pnpm test:watch

# Coverage report
pnpm test:cov

# RLS integration tests (70 tests, requires postgres-test container)
pnpm --filter @colophony/api test:rls

# API E2E tests (65 tests, requires docker-compose up)
pnpm test:e2e

# Playwright browser E2E tests (19 tests, requires dev servers)
pnpm --filter @colophony/web test:e2e

# Playwright interactive UI mode
pnpm --filter @colophony/web test:e2e:ui
```

**Prerequisites for E2E tests:**

- PostgreSQL test DB: `docker-compose up postgres-test`
- Redis: `docker-compose up redis`
- For Playwright: `npx playwright install` (first time only, downloads Chromium)
- For Playwright: dev servers running (`pnpm dev`) or auto-started by `playwright.config.ts`

---

## Current Test Status

**462 tests passing** across 5 tiers:

| Tier                   | Count | Suites | Location                                 |
| ---------------------- | ----- | ------ | ---------------------------------------- |
| API unit tests         | 191   | 13     | `apps/api/test/unit/`                    |
| Web unit tests         | 117   | 13     | `apps/web/src/**/__tests__/`             |
| RLS integration tests  | 70    | 6      | `apps/api/src/__tests__/rls/`            |
| API E2E tests          | 65    | 5      | `apps/api/test/e2e/` + `app.e2e-spec.ts` |
| Playwright browser E2E | 20    | 3      | `apps/web/e2e/`                          |

**Unit test breakdown (API):**

- `audit.service.spec.ts` — 13 tests
- `gdpr.service.spec.ts` — 17 tests
- `retention.service.spec.ts` — 14 tests
- `outbox.service.spec.ts` — 14 tests
- `virus-scan.service.spec.ts`
- `email.service.spec.ts`
- `payments.service.spec.ts`
- `auth.service.spec.ts`
- `submission-workflow.spec.ts`
- `file-utils.spec.ts`
- `rate-limit.service.spec.ts`

**API E2E test breakdown:**

- `auth.e2e-spec.ts` — 15 tests (register, login, refresh, logout, me)
- `submissions.e2e-spec.ts` — 28 tests (CRUD, status transitions, cross-org isolation)
- `gdpr.e2e-spec.ts` — 15 tests (consent, DSAR, export, deletion)
- `payments.e2e-spec.ts` — 6 tests (Stripe not configured, auth checks)
- `app.e2e-spec.ts` — 1 test (health check)

**Playwright E2E test breakdown:**

- `submissions/submission-list.spec.ts` — 7 tests (heading, new button, status tabs, seed data, navigation, submitted filter, rejected empty state)
- `submissions/submission-create.spec.ts` — 5 tests (form fields, validation, title-only draft, full draft, appears in list)
- `submissions/submission-detail.spec.ts` — 8 tests (detail view, edit/delete buttons, pre-filled edit, save changes, submit flow, withdraw flow, delete confirmation)

---

## Coverage Targets

| Scope                        | Target |
| ---------------------------- | ------ |
| Overall                      | 85%+   |
| Business logic (services)    | 90%+   |
| API endpoints (tRPC routers) | 80%+   |
| Integration tests            | 70%+   |

---

## Test Architecture

### Unit Tests

**API unit tests** (`apps/api/test/unit/`):

- Mock all external dependencies (Prisma, Redis, BullMQ, Stripe, email)
- Test business logic in isolation
- Uses Jest with NestJS `@nestjs/testing` for DI

**Web unit tests** (`apps/web/src/**/__tests__/`):

- Co-located with source files
- Uses Jest + React Testing Library + `@testing-library/react-hooks`
- Mock tRPC client and browser APIs (localStorage)
- Test components, hooks, and utility functions

### API E2E Tests

**Test app module** (`test/e2e-app.module.ts`):

- Mirrors `AppModule` but excludes `JobsModule` (BullMQ)
- A `MockJobsModule` provides a no-op `VirusScanService` globally
- All real modules (auth, storage, GDPR, audit, etc.) are loaded

**Superuser DB connection rationale:**
E2E tests use the superuser (`test:test`) for the Prisma singleton because `createContext()` needs to query `organization_members` but RLS requires `current_org` to be set first (chicken-and-egg). RLS isolation is verified separately in unit/integration tests using the dual-client pattern.

**CI environment variables:**

| Variable            | Purpose                                                  | CI Value                                                           |
| ------------------- | -------------------------------------------------------- | ------------------------------------------------------------------ |
| `DATABASE_TEST_URL` | Superuser connection (test setup, main Prisma singleton) | `postgresql://test:test@localhost:5433/colophony_test`             |
| `DATABASE_APP_URL`  | Non-superuser connection (RLS E2E test)                  | `postgresql://app_user:app_password@localhost:5433/colophony_test` |
| `REDIS_URL`         | Redis for BullMQ, sessions, rate limits                  | `redis://localhost:6379`                                           |

**Important:** `DATABASE_APP_URL` must be separate from `DATABASE_TEST_URL`. The RLS E2E test (`getAppPrisma()`) uses `DATABASE_APP_URL` to connect as `app_user` (non-superuser). If it falls back to `DATABASE_TEST_URL`, both clients are superuser and RLS is silently bypassed.

**Execution model:**

- Sequential: `--runInBand` required — suites share PostgreSQL and Redis
- `--forceExit` required — Redis/Prisma connections persist after tests
- Database + Redis cleaned between each test via `cleanDatabase()` (DB truncate + `FLUSHDB`)
- Rate limits disabled: `RATE_LIMIT_DEFAULT_MAX=10000` and `RATE_LIMIT_AUTH_MAX=10000` in `e2e-setup.ts`

**Test helpers** (`test/e2e-helpers.ts`):

- `createTestApp()` — bootstraps NestJS app from `E2eAppModule`
- `registerUser()` — registers + auto-verifies email
- `trpcMutation()` / `trpcQuery()` — typed HTTP calls to tRPC
- `cleanDatabase()` — truncates all tables + flushes Redis

**Test factories** (`test/utils/factories/`):

- `createOrg()`, `createUser()`, `createSubmission()` — direct DB inserts via admin Prisma

### Playwright Browser E2E Tests

**Location:** `apps/web/e2e/`

**Architecture:**

- **Auth strategy:** Fake OIDC user injected into `localStorage` via `addInitScript()` (satisfies `ProtectedRoute`/`useAuth` checks), then `page.route()` intercepts tRPC requests to swap the fake Bearer token for a real API key header (`X-Api-Key`). This exercises the real API key auth path — no Zitadel instance needed.
- **Fixtures** (`e2e/helpers/fixtures.ts`): Custom Playwright `test` provides `seedOrg`, `seedUser`, `testApiKey` (created per test, cleaned up after), and `authedPage` (page with auth injected).
- **DB helpers** (`e2e/helpers/db.ts`): Superuser Drizzle pool for direct DB operations — org/user lookups, API key/submission CRUD for test setup/teardown.
- **Global setup** (`e2e/global-setup.ts`): Validates seed data exists before any tests run. Requires `pnpm db:seed`.
- **Seed data:** Read-only tests use seed data directly; mutation tests create fresh data via DB helpers and clean up after.
- Strict selectors: `getByRole('heading', ...)`, `getByLabel()`, `getByRole('button', ...)`, `getByRole('tab', ...)`

**Running:**

```bash
npx playwright install                    # First time (downloads Chromium)
docker-compose up -d                      # PostgreSQL required
pnpm db:seed                              # Seed data required
pnpm --filter @colophony/web test:e2e    # Auto-starts API + Web dev servers
pnpm --filter @colophony/web test:e2e:ui # Interactive UI mode
```

The `playwright.config.ts` `webServer` config auto-starts API (reuses existing) and Web (always fresh — test OIDC env vars must match `injectAuth` storage key) dev servers. No Zitadel, MinIO, or Redis required (`VIRUS_SCAN_ENABLED=false` in API webServer env).

### RLS Integration Tests

**Location:** `apps/api/src/__tests__/rls/` (6 test files, 70 tests)

Uses the **dual-client pattern** with Drizzle ORM + raw `pg` pools to test actual PostgreSQL RLS enforcement:

```typescript
// Admin pool (superuser) - for test data setup/teardown (bypasses RLS)
const adminPool = new Pool({
  connectionString: "postgresql://test:test@localhost:5433/colophony_test",
});

// App pool (non-superuser, NOSUPERUSER NOBYPASSRLS) - for RLS-enforced queries
const appPool = new Pool({
  connectionString:
    "postgresql://app_user:app_password@localhost:5433/colophony_test",
});
```

**Test files:**

| File                             | Tests | Coverage                                                     |
| -------------------------------- | ----- | ------------------------------------------------------------ |
| `rls-infrastructure.test.ts`     | 14    | FORCE RLS, role security, GUC functions, policy existence    |
| `rls-direct-isolation.test.ts`   | 12    | submissions, submission_periods, payments, org_members       |
| `rls-indirect-isolation.test.ts` | 8     | submission_files, submission_history (subquery policies)     |
| `rls-nullable-isolation.test.ts` | 9     | audit_events, retention_policies, user_consents              |
| `rls-write-prevention.test.ts`   | 12    | Cross-org INSERT/UPDATE/DELETE with SQLSTATE 42501           |
| `rls-no-context.test.ts`         | 15    | Empty context behavior (0 rows strict, global-only nullable) |

**Running:**

```bash
# Requires postgres-test container
docker compose up -d postgres-test
pnpm --filter @colophony/api test:rls
```

**Key design:**

- Dedicated `vitest.config.rls.ts` with `singleFork: true` (sequential execution, shared pools)
- Excluded from default `pnpm test` to avoid failures without Docker
- `globalSetup()` creates `app_user` role portably (works in CI and locally)
- Faker-based factories prevent collision errors in watch mode

---

## Critical Test Cases

### 1. Multi-Tenancy Isolation

```typescript
import { createContextHelpers } from "@colophony/db";

it("should prevent cross-org data leakage", async () => {
  // Setup with admin client (bypasses RLS)
  const org1 = await createOrg();
  const org2 = await createOrg();
  const submission1 = await createSubmission({ orgId: org1.id });
  const submission2 = await createSubmission({ orgId: org2.id });

  // Test with app client (enforces RLS)
  const { withOrgContext } = createContextHelpers(appPrisma);
  const results = await withOrgContext(org1.id, user1.id, async (tx) => {
    return tx.submission.findMany();
  });

  expect(results).toHaveLength(1);
  expect(results[0].id).toBe(submission1.id);
});
```

### 2. Payment Idempotency

```typescript
it("should handle duplicate webhook events", async () => {
  const event = { id: "evt_123", type: "checkout.session.completed" };

  await webhookHandler.handle(event);
  await webhookHandler.handle(event); // Duplicate

  const payments = await findPayments({ eventId: event.id });
  expect(payments).toHaveLength(1); // Only one payment created
});
```

### 3. GDPR Export/Erasure

```typescript
it("should export all user data", async () => {
  const user = await createUser();
  await createSubmissions(user.id, 5);

  const zipPath = await gdprService.exportUserData(user.id);
  const archive = await unzip(zipPath);

  expect(archive).toContainFiles([
    "profile.json",
    "submissions.json",
    "payments.json",
    "audit-log.json",
  ]);
});
```

---

## Known Test Quirks

### tRPC v10.45 Zod Errors Return 400

Input validation (Zod) errors return `BAD_REQUEST` (400). Tests assert `toBe(400)` with `BAD_REQUEST` error code.

### NestJS 10.4 Express 4 Path Syntax

`setGlobalPrefix` exclude pattern must use `trpc/(.*)` (Express 4), not `trpc/*path` (Express 5).

### TrpcController URL Stripping

The `@Controller('trpc')` prefix must be manually stripped from `req.url` before passing to tRPC middleware — NestJS controllers don't strip prefixes like Express sub-routers.

### `--forceExit` Required

Redis/Prisma connections persist after tests complete. `--forceExit` is standard for NestJS E2E tests.

### TanStack Query v4 `isLoading` with Disabled Queries

In TanStack Query v4, `isLoading` is `true` even when the query is disabled (`enabled: false`). The fix in `use-auth.ts` checks `fetchStatus !== 'idle'` instead.

---

## E2E False-Positive Audit

All 5 priorities from the false-positive audit have been resolved:

### Priority 1: Tightened Status Code Assertions

tRPC Zod validation assertions check `toBe(400)` with `BAD_REQUEST` error code.

| File               | Test               | Assertion                   |
| ------------------ | ------------------ | --------------------------- |
| `auth.e2e-spec.ts` | invalid email      | `toBe(400)` + `BAD_REQUEST` |
| `auth.e2e-spec.ts` | short password     | `toBe(400)` + `BAD_REQUEST` |
| `gdpr.e2e-spec.ts` | wrong confirmation | `toBe(400)` + `BAD_REQUEST` |

### Priority 2: Fixed Multi-Status Acceptance in Payments

- `payments.e2e-spec.ts:134` — now `toBe(500)` with `/not initialized/i`
- `payments.e2e-spec.ts:65` — restored to `toBe(412)` (router throws `PRECONDITION_FAILED`)

### Priority 3: RLS E2E Coverage

Added test using `getAppPrisma()` (non-superuser) to verify RLS blocks cross-org reads at the database level.

### Priority 4: Strengthened GDPR Assertions

- DSAR `dueAt` verified as 30-31 days from now
- Consent grant verifies audit trail entry in database

### Priority 5: Expanded Submission State Machine Coverage

Added negative tests for invalid transitions:

- `DRAFT` → `ACCEPTED` (invalid)
- `REJECTED` → `UNDER_REVIEW` (invalid)
- `ACCEPTED` → `DRAFT` (invalid)

---

## Production Bugs Found During Testing

### API E2E Test Phase

1. **tRPC routing broken** — `trpc/*path` in `main.ts` used Express 5 syntax. Fixed to `trpc/(.*)`.
2. **tRPC 404 on all procedures** — `TrpcController` wasn't stripping `/trpc` prefix from `req.url`.
3. **Circular dependency** — `StorageModule` → `VirusScanService` → `JobsModule` circular import via barrel exports. Fixed barrel export order.
4. **GdprModule not global** — `GdprService` wasn't available to other modules. Added `@Global()`.

### Playwright E2E Phase

1. **Circular dependency in JobsModule** — `jobs.module` ↔ `storage` barrel exports. Fixed by extracting queue constants to `modules/jobs/constants.ts`.
2. **API auth.me flattening mismatch** — Endpoint flattened `memberships` but frontend expected nested Prisma structure. Fixed by returning raw `user.memberships`.
3. **Auth loading state with disabled query** — TanStack Query v4 `isLoading` true when disabled. Fixed with `fetchStatus !== 'idle'` check.
4. **Unit test import paths stale** — Queue constants moved to `constants.ts` but unit tests still imported from `jobs.module`. Fixed imports.

### Beta Deployment Phase

1. **`.gitignore` missing `.env.prod`** — Secrets file exposure risk.
2. **Docker Compose env_file vs --env-file** — `env_file:` only sets container runtime env, not YAML `${VAR}` substitution.
3. **`init-prod.sh` shebang incompatible with Alpine** — `#!/bin/bash` → `#!/bin/sh`.
4. **`npx prisma` downloading Prisma 7.x** — npm resolution, not pnpm. Fixed with direct binary path.
5. **Prisma schema engine OpenSSL mismatch** — Added `openssl` to Alpine `apk add`.
6. **Prisma client "did not initialize yet"** — `pnpm deploy --prod` misses generated client files. Added `cp -r` step.
7. **Prisma query engine OpenSSL 1.1 vs 3.x** — Added `apk add openssl` before `prisma generate`.
8. **Redis ECONNREFUSED in BullMQ** — Missing `REDIS_HOST`/`REDIS_PORT`/`REDIS_PASSWORD` env vars.
9. **Stale database credentials** — Old PostgreSQL volume. Resolved with `docker compose down -v`.
10. **Port conflict** — Default port 8080 in use. Made configurable via `HTTP_PORT`.
