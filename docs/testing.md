# Testing Guide

Comprehensive testing reference for the Colophony platform.
For architecture details, see [docs/architecture.md](./architecture.md).

---

## Running Tests

```bash
# Unit tests — API + packages (~1584 tests, 156 suites)
pnpm test

# Coverage report (all packages)
pnpm test:cov

# Coverage — per-package
pnpm --filter @colophony/api test:cov
pnpm --filter @colophony/web test:cov
pnpm --filter @colophony/types test:cov
pnpm --filter @colophony/auth-client test:cov
pnpm --filter @colophony/api-client test:cov
pnpm --filter @colophony/plugin-sdk test:cov
pnpm --filter @colophony/create-plugin test:cov

# Web unit tests — Jest (~543 tests, 74 suites)
pnpm --filter @colophony/web test

# RLS integration tests (~122 tests, requires postgres-test container)
pnpm --filter @colophony/api test:rls

# Security invariant tests (~20 tests, requires postgres-test container)
pnpm --filter @colophony/api test:security

# Service integration tests (~63 tests, requires postgres-test container)
pnpm --filter @colophony/api test:services

# Webhook integration tests (~38 tests, requires postgres-test container)
pnpm --filter @colophony/api test:webhooks

# Queue/worker integration tests (~19 tests, requires postgres-test + redis)
pnpm --filter @colophony/api test:queues

# Playwright browser E2E — submissions only (20 tests, requires dev servers)
pnpm --filter @colophony/web test:e2e

# Playwright — upload flow (6 tests, requires tusd + MinIO)
pnpm --filter @colophony/web test:e2e:uploads

# Playwright — embed form (10 tests, requires dev servers)
pnpm --filter @colophony/web test:e2e:embed

# Playwright — OIDC flow (6 tests, requires Zitadel)
pnpm --filter @colophony/web test:e2e:oidc

# Playwright — Slate pipeline (30 tests, requires dev servers)
pnpm --filter @colophony/web test:e2e:slate

# Playwright — Writer Workspace (21 tests, requires dev servers)
pnpm --filter @colophony/web test:e2e:workspace

# Playwright — Form Builder (16 tests, requires dev servers)
pnpm --filter @colophony/web test:e2e:forms

# Playwright — Organization & Settings (14 tests, requires dev servers)
pnpm --filter @colophony/web test:e2e:organization

# Playwright — Submission Analytics (6 tests, requires dev servers)
pnpm --filter @colophony/web test:e2e:analytics

# Playwright — Federation Admin (16 tests, requires dev servers)
pnpm --filter @colophony/web test:e2e:federation

# Playwright — all projects
pnpm --filter @colophony/web test:e2e:all

# Playwright interactive UI mode
pnpm --filter @colophony/web test:e2e:ui
```

**Prerequisites:**

- PostgreSQL test DB: `docker compose up -d postgres-test` (RLS + webhook tests)
- For Playwright: `npx playwright install` (first time only, downloads Chromium)
- For Playwright: `pnpm db:seed` (seed data required for read-only tests)
- Dev servers auto-started by `playwright.config.ts` — or run `pnpm dev` manually

---

## Current Test Status

**~1944 tests passing** across 8 tiers:

| Tier                      | Files | Tests | Runner          | Location                           |
| ------------------------- | ----- | ----- | --------------- | ---------------------------------- |
| API unit tests            | 156   | ~1584 | Vitest          | `apps/api/src/**/*.spec.ts`        |
| Package unit tests        | 4     | ~38   | Vitest          | `packages/*/src/**/*.spec.ts`      |
| Web unit tests            | 11    | ~108  | Jest + jsdom    | `apps/web/src/**/*.spec.*`         |
| RLS integration tests     | 11    | ~122  | Vitest (custom) | `apps/api/src/__tests__/rls/`      |
| Security invariant tests  | 3     | ~20   | Vitest (custom) | `apps/api/src/__tests__/security/` |
| Service integration tests | 6     | ~63   | Vitest (custom) | `apps/api/src/__tests__/services/` |
| Webhook integration tests | 4     | ~38   | Vitest (custom) | `apps/api/src/__tests__/webhooks/` |
| Queue integration tests   | 6     | ~19   | Vitest (custom) | `apps/api/src/__tests__/queues/`   |
| Playwright browser E2E    | 26    | ~142  | Playwright      | `apps/web/e2e/`                    |

> Counts use `~` prefix because they shift as tests are added. Run `pnpm test` to get exact numbers.

**API unit test coverage areas:**

- Config: `env.spec.ts`
- Hooks: `auth`, `audit`, `db-context`, `org-context`, `rate-limit` (2 files)
- Server: `main.spec.ts`
- Queues: `file-scan.queue.spec.ts`
- REST: `error-mapper`, `require-scopes`, 6 routers
- Services: 7 service specs
- tRPC: `error-mapper`, 6 router specs
- Webhooks: `stripe`, `tusd`, `zitadel`
- Workers: `file-scan.worker.spec.ts`

**Package unit tests:**

- `@colophony/auth-client`: `jwks.spec.ts`, `types.spec.ts`, `webhook-signature.spec.ts`
- `@colophony/api-client`: `client.spec.ts`

**Web unit tests:**

- Hooks: `use-auth.spec.ts`, `use-slug-check.spec.ts`, `use-file-upload.spec.ts`, `use-organization.spec.tsx`
- Components: `protected-route.spec.tsx`, `user-menu.spec.tsx`, `sidebar.spec.tsx`, `org-switcher.spec.tsx`, `create-org-form.spec.tsx`
- Lib: `trpc.spec.ts`, `utils.spec.ts`

**Playwright E2E test breakdown:**

- `submissions/submission-list.spec.ts` — 7 tests (heading, new button, status tabs, seed data, navigation, submitted filter, rejected empty state)
- `submissions/submission-create.spec.ts` — 5 tests (form fields, validation, title-only draft, full draft, appears in list)
- `submissions/submission-detail.spec.ts` — 8 tests (detail view, edit/delete buttons, pre-filled edit, save changes, submit flow, withdraw flow, delete confirmation)
- `uploads/file-upload.spec.ts` — 6 tests (upload + list, progress, DB scan status, delete, MIME reject, multi-file)
- `oidc/login.spec.ts` — 4 tests (redirect to Zitadel, login flow, return path, logout)
- `oidc/auth-guard.spec.ts` — 2 tests (protected route redirect, callback error UI)
- `embed/embed-form.spec.ts` — 8 tests (identity step, invalid token, email validation, form fields, title required, full submit, minimal submit, expired token)
- `embed/embed-wizard.spec.ts` — 2 tests (wizard page navigation, multi-page submit)
- `slate/publications.spec.ts` — 6 tests (heading, list, filter, search, create, detail)
- `slate/pipeline.spec.ts` — 8 tests (heading, list, filter, detail, transitions, comments)
- `slate/issues.spec.ts` — 7 tests (heading, list, create, detail, assembly tab, add item, remove item)
- `slate/contracts.spec.ts` — 5 tests (heading, list, templates, create template, template detail)
- `slate/cms-connections.spec.ts` — 4 tests (heading, list, filter, create)
- `analytics/submission-analytics.spec.ts` — 6 tests (overview cards, filters, status/funnel charts, time series, response time/aging, date filter update)
- `federation/federation-admin.spec.ts` — 16 tests (overview, peer management, sim-sub, transfers, migrations, audit log, hub admin)

---

## Coverage Targets

Thresholds are set at **measured baseline minus 5%** (buffer for normal code churn). Thresholds are ratcheted up monthly as coverage improves. CI enforces thresholds via the `coverage` job; coverage reports are uploaded as artifacts (`coverage-reports`, 14-day retention).

| Package                    | Stmts | Branches | Functions | Lines | Baseline date |
| -------------------------- | ----- | -------- | --------- | ----- | ------------- |
| `@colophony/api`           | 50%   | 44%      | 45%       | 51%   | 2026-03       |
| `@colophony/web`           | 42%   | 65%      | 31%       | 42%   | 2026-03       |
| `@colophony/types`         | 36%   | 41%      | 48%       | 36%   | 2026-03       |
| `@colophony/auth-client`   | 95%   | 95%      | 95%       | 95%   | 2026-03       |
| `@colophony/api-client`    | 95%   | 85%      | 95%       | 95%   | 2026-03       |
| `@colophony/plugin-sdk`    | 55%   | 50%      | 36%       | 55%   | 2026-03       |
| `@colophony/create-plugin` | 71%   | 63%      | 70%       | 71%   | 2026-03       |

**Threshold policy:** `max(0, measured - 5)`. Prevents CI from breaking on normal churn while catching large regressions. To update: run `pnpm test:cov` locally, update thresholds in the relevant `vitest.config.ts` or `jest.config.ts`, and update this table.

### Changed-Line Coverage (diff-cover)

In addition to global thresholds, PRs enforce **80% coverage on changed lines** using [diff-cover](https://github.com/Bachmann1234/diff-cover). This prevents PRs from adding large amounts of uncovered code even when the global average stays above the floor.

**How it works:**

1. All 7 package lcov reports are merged into `coverage-merged.lcov`
2. `diff-cover` compares changed lines (vs `origin/main`) against the merged report
3. If <80% of changed lines are covered, the CI job fails

**Exclusions:** Test files (`*.spec.ts`, `*.test.ts`, `*.spec.tsx`, `*.test.tsx`) and `node_modules` are excluded — test code doesn't need to be covered by other tests.

**Push to main:** diff-cover steps are skipped on push events; only global thresholds apply.

**Local testing:**

```bash
pnpm test:cov
cat apps/api/coverage/lcov.info apps/web/coverage/lcov.info \
    packages/types/coverage/lcov.info packages/api-client/coverage/lcov.info \
    packages/auth-client/coverage/lcov.info packages/plugin-sdk/coverage/lcov.info \
    packages/create-plugin/coverage/lcov.info > coverage-merged.lcov
pip install diff-cover==9.2.4
diff-cover coverage-merged.lcov --compare-branch origin/main --fail-under 80
```

---

## Test Architecture

### API Unit Tests

**Location:** `apps/api/src/**/*.spec.ts` (co-located with source)

**Config:** `apps/api/vitest.config.ts` — `globals: false` (explicit imports required), excludes `src/__tests__/rls/`.

**Pattern:** Fastify instances + `vi.mock()` for all external dependencies (Drizzle DB, Redis, BullMQ, Stripe, email). Tests use `app.inject()` (Fastify's built-in test helper) — no supertest.

```typescript
// Representative pattern from auth.spec.ts
import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";
import Fastify, { type FastifyInstance } from "fastify";
import authPlugin from "./auth.js";

// Mock external deps with vi.mock
vi.mock("@colophony/db", () => ({
  db: { query: { users: { findFirst: vi.fn() } } },
  eq: vi.fn((_col: unknown, val: unknown) => val),
  users: { zitadelUserId: "zitadel_user_id" },
  pool: { query: vi.fn().mockResolvedValue({ rows: [{ "?column?": 1 }] }) },
}));

describe("auth plugin", () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    app = Fastify({ logger: false });
    await app.register(authPlugin, {
      env: {
        /* test env */
      },
    });
    app.get("/protected", async (request) => ({
      authContext: request.authContext,
    }));
  });

  afterAll(async () => {
    await app.close();
  });

  it("returns 401 when no auth header", async () => {
    const response = await app.inject({
      method: "GET",
      url: "/protected",
    });
    expect(response.statusCode).toBe(401);
  });
});
```

Key differences from v1: no NestJS `@nestjs/testing` or DI — Fastify plugins are registered directly. No supertest — `app.inject()` is built in. Explicit Vitest imports (no `globals: true`).

### Web Unit Tests

**Location:** `apps/web/src/**/*.spec.ts` / `.spec.tsx` (co-located with source)

**Config:** `apps/web/jest.config.ts` — Jest + ts-jest + jsdom. Not yet migrated to Vitest.

**Pattern:**

- Mocks `next/navigation` (`useRouter`, `useSearchParams`, `usePathname`)
- Mocks tRPC client via `@/lib/trpc` module mock
- Mocks `@colophony/types` schema exports
- Uses React Testing Library (`@testing-library/react`)
- `moduleNameMapper` resolves `@/*` path aliases and cross-package imports

### RLS Integration Tests

**Location:** `apps/api/src/__tests__/rls/` (8 test files, ~89 tests)

Uses the **dual-pool pattern** with Drizzle ORM + raw `pg` pools to test actual PostgreSQL RLS enforcement:

```typescript
// Admin pool (superuser) — bypasses RLS for test data setup/teardown
const adminPool = new Pool({
  connectionString: "postgresql://test:test@localhost:5433/colophony_test",
});

// App pool (NOSUPERUSER NOBYPASSRLS) — RLS-enforced queries
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
| `organization-service.test.ts`   | —     | Org service operations under RLS                             |
| `audit-write-path.test.ts`       | —     | Audit write path under RLS                                   |

**Config:** `apps/api/vitest.config.rls.ts` — `singleFork: true` (sequential execution, shared pools), `fileParallelism: false`.

**Running:**

```bash
# Requires postgres-test container
docker compose up -d postgres-test
pnpm --filter @colophony/api test:rls
```

**Key design:**

- Dedicated Vitest config — excluded from default `pnpm test` to avoid failures without Docker
- `globalSetup()` (called manually in `beforeAll`) creates `app_user` role portably (works in CI and locally)
- `withTestRls()` helper sets `app.current_org`/`app.user_id` via `set_config` inside a transaction
- Faker-based factories (`createTwoOrgScenario`) prevent collision errors in watch mode
- `DATABASE_URL` overridden in vitest config to point at `app_user` connection — exercises real RLS on `@colophony/db` shared exports

### Webhook Integration Tests

**Location:** `apps/api/src/__tests__/webhooks/` (3 test files, ~28 tests)

Tests verify the full webhook handler path: HTTP request → signature/auth verification → idempotency check → DB writes → audit logging.

**Real:** PostgreSQL (test DB, `app_user` connection), Fastify instance with webhook routes, Drizzle ORM, audit logging via `insert_audit_event()` SECURITY DEFINER function.

**Mocked:** Stripe SDK (`constructEvent`), Zitadel signature verification, BullMQ (`enqueueFileScan`), S3 operations. Redis rate limiting degrades gracefully when unavailable.

**Config:** `apps/api/vitest.config.webhooks.ts` — `singleFork: true`, `fileParallelism: false`, `DATABASE_URL` pointed at test DB, `NODE_ENV: 'test'`.

**Running:**

```bash
# Requires postgres-test container
docker compose up -d postgres-test
pnpm --filter @colophony/api test:webhooks
```

**Key design:**

- Reuses RLS test helpers (db-setup, factories, cleanup) — no duplication
- `buildWebhookApp()` creates a Fastify instance with all 3 webhook scopes (same registration as `main.ts`)
- DB assertions use admin pool (bypasses RLS) to verify state changes
- tusd tests exercise RLS via `withRls()` on submissions/submission_files tables

### Queue/Worker Integration Tests

**Location:** `apps/api/src/__tests__/queues/` (6 test files, ~19 tests)

Tests verify the full enqueue → BullMQ picks up → processor runs → DB state changes pipeline for all queue workers: file-scan, email, webhook, s3-cleanup, outbox-poller, and transfer-fetch.

**Real:** PostgreSQL (test DB, `app_user` connection via `withRls()`), Redis (BullMQ queues + workers), Drizzle ORM, audit logging.

**Mocked:** S3 storage adapter, ClamAV (`clamscan`), email adapter, `globalThis.fetch`, Inngest client, SSRF validation, Prometheus metrics, Sentry, logger.

**Config:** `apps/api/vitest.config.queues.ts` — `singleFork: true`, `fileParallelism: false`, `DATABASE_URL` + `REDIS_HOST`/`REDIS_PORT` pointed at test infra.

**Running:**

```bash
# Requires postgres-test + redis containers
docker compose up -d postgres-test redis
pnpm --filter @colophony/api test:queues
```

**Key design:**

- Each file starts its own worker in `beforeAll` and stops it in `afterAll`
- `QueueEvents` + `job.waitUntilFinished()` for idiomatic wait (no polling)
- Retry tests override default backoff with `{ type: 'fixed', delay: 100 }` to avoid 30s+ delays
- Reuses RLS test helpers (db-setup, factories, cleanup) + adds queue-specific factories
- Redis is flushed between test files via `flushRedis()` (FLUSHDB)

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
docker compose up -d                      # PostgreSQL required
pnpm db:seed                              # Seed data required
pnpm --filter @colophony/web test:e2e    # Auto-starts API + Web dev servers
pnpm --filter @colophony/web test:e2e:ui # Interactive UI mode
```

The `playwright.config.ts` `webServer` config auto-starts API (port 4010) and Web (port 3010) dev servers on dedicated E2E ports. The `submissions` project requires no Zitadel, MinIO, or Redis (`VIRUS_SCAN_ENABLED=false` in API webServer env).

#### Upload E2E Tests (uploads project)

Requires tusd + MinIO for real file upload flow:

```bash
# Start tusd + MinIO with E2E overrides (webhook→port 4010, forwards X-Api-Key)
docker compose -f docker-compose.yml -f docker-compose.e2e.yml up tusd minio minio-setup -d

# Run upload tests
pnpm --filter @colophony/web test:e2e:uploads
```

Auth strategy: API key interception on tus requests (same pattern as tRPC). The tusd webhook validates API keys via `X-Api-Key` forwarded header.

#### OIDC E2E Tests (oidc project)

Requires a real Zitadel instance for actual OIDC login flow:

```bash
# Start Zitadel
docker compose --profile auth up -d

# Provision Zitadel project, OIDC app, and test user (idempotent)
pnpm --filter @colophony/web e2e:setup-oidc

# Run OIDC tests
pnpm --filter @colophony/web test:e2e:oidc
```

The setup script creates a Zitadel project, OIDC app (Authorization Code + PKCE), and test user, then inserts the user into the Colophony DB. Config is written to `apps/web/e2e/.zitadel-e2e-config.json` (gitignored).

**CI environment variables:**

| Variable            | Purpose                              | CI Value                                                           |
| ------------------- | ------------------------------------ | ------------------------------------------------------------------ |
| `DATABASE_TEST_URL` | Superuser connection (test setup)    | `postgresql://test:test@localhost:5433/colophony_test`             |
| `DATABASE_APP_URL`  | Non-superuser connection (RLS tests) | `postgresql://app_user:app_password@localhost:5433/colophony_test` |

**Important:** `DATABASE_APP_URL` must be separate from `DATABASE_TEST_URL`. RLS tests connect as `app_user` (non-superuser, NOBYPASSRLS). If it falls back to `DATABASE_TEST_URL`, both clients are superuser and RLS is silently bypassed.

#### Embed E2E Tests (embed project)

Public embed forms — no OIDC needed. Tests exercise token verification, identity collection, form filling, and submission. Uses its own fixtures (`e2e/helpers/embed-fixtures.ts`) and DB helpers (`e2e/helpers/embed-db.ts`) that share the admin pool from `db.ts`.

```bash
pnpm --filter @colophony/web test:e2e:embed
```

---

## MCP-Assisted QA

### Available MCP Tools

| Server            | Use Case                                                                                   |
| ----------------- | ------------------------------------------------------------------------------------------ |
| `chrome-devtools` | Navigate flows, click/fill forms, inspect network requests, take screenshots, read console |
| `playwright`      | Browser automation for repeatable test generation                                          |
| `postgres`        | Direct DB queries for data integrity checks                                                |
| `redis`           | BullMQ job inspection, queue state verification                                            |
| `docker`          | Container health checks, log inspection                                                    |

### When to Use MCP vs Playwright

| Scenario                                 | Use                                                    |
| ---------------------------------------- | ------------------------------------------------------ |
| Exploratory testing, investigating a bug | Chrome DevTools MCP                                    |
| Verifying a fix once                     | Chrome DevTools MCP                                    |
| Pre-release smoke test (first time)      | Chrome DevTools MCP                                    |
| Same smoke test repeated 3+ times        | Promote to Playwright E2E                              |
| Visual/layout verification               | Chrome DevTools MCP (screenshot)                       |
| Regression test for a fixed bug          | Playwright E2E                                         |
| Complex multi-step flow verification     | Chrome DevTools MCP first, then Playwright if repeated |

### Automation Promotion Pipeline

1. **Manual/MCP check** — log in `docs/qa-log.md` with `[AUTOMATE]` tag when repeated
2. **Backlog item** — create backlog entry: `[P3] Automate: [check description] — (qa-log YYYY-MM-DD)`
3. **Playwright test** — scaffold with `/new-e2e`, add to appropriate project
4. **Remove from release checklist** — move from "Gaps" to "CI Pipeline" section

### QA Session Workflow

1. Launch Chrome: `google-chrome --remote-debugging-port=9222`
2. Navigate to dev server: `http://localhost:3000`
3. Use Chrome DevTools MCP tools to interact with the application
4. Log findings in `docs/qa-log.md`
5. Tag repeated checks with `[AUTOMATE]` for future Playwright promotion

---

## Critical Test Cases

### 1. Multi-Tenancy Isolation

```typescript
// From rls-direct-isolation.test.ts
import { describe, it, expect, beforeAll } from "vitest";
import { eq } from "drizzle-orm";
import { globalSetup } from "./helpers/db-setup";
import { truncateAllTables } from "./helpers/cleanup";
import { withTestRls } from "./helpers/rls-context";
import { createTwoOrgScenario, type TwoOrgScenario } from "./helpers/factories";
import { submissions } from "@colophony/db";

let scenario: TwoOrgScenario;

beforeAll(async () => {
  await globalSetup();
  await truncateAllTables();
  scenario = await createTwoOrgScenario();
});

it("org A context sees only org A submissions", async () => {
  const rows = await withTestRls(
    { orgId: scenario.orgA.id, userId: scenario.userA.id },
    (tx) => tx.select().from(submissions),
  );
  expect(rows).toHaveLength(1);
  expect(rows[0].id).toBe(scenario.submissionA.id);
});

it("org A context cannot find org B submission by ID", async () => {
  const rows = await withTestRls(
    { orgId: scenario.orgA.id, userId: scenario.userA.id },
    (tx) =>
      tx
        .select()
        .from(submissions)
        .where(eq(submissions.id, scenario.submissionB.id)),
  );
  expect(rows).toHaveLength(0);
});
```

### 2. Stripe Webhook Idempotency

```typescript
// From stripe.webhook.spec.ts — simplified
import { describe, it, expect, vi, beforeEach } from "vitest";
import Fastify from "fastify";

describe("idempotency", () => {
  it("skips already-processed event (processed=true)", async () => {
    // Mock DB to return processed=true for the event
    mockClientQuery.mockImplementation((sqlStr: string) => {
      if (typeof sqlStr === "string" && sqlStr.includes("SELECT processed")) {
        return { rows: [{ processed: true }] };
      }
      return { rows: [] };
    });

    const response = await sendWebhook(app);
    expect(response.statusCode).toBe(200);
    expect(response.json().status).toBe("already_processed");
    // Business logic not executed
    expect(mockTxInsert).not.toHaveBeenCalled();
    expect(mockAuditLog).not.toHaveBeenCalled();
  });

  it("reprocesses partially-processed event (crash recovery)", async () => {
    // INSERT ON CONFLICT DO NOTHING (existing), SELECT returns processed=false
    mockClientQuery.mockImplementation((sqlStr: string) => {
      if (typeof sqlStr === "string" && sqlStr.includes("SELECT processed")) {
        return { rows: [{ processed: false }] };
      }
      return { rows: [] };
    });

    const response = await sendWebhook(app);
    expect(response.statusCode).toBe(200);
    expect(response.json().status).toBe("processed");
    expect(mockTxInsert).toHaveBeenCalled(); // Crash recovery: reprocess
  });
});
```

---

## Flakiness Detection & Quarantine

### Shuffle Ordering

All unit test suites run with randomized test ordering to detect order-dependent tests:

- **Vitest** (API + packages): `sequence: { shuffle: true }` in each `vitest.config.ts`
- **Jest** (web): `--randomize` flag in the `test` script

Vitest prints the shuffle seed in output — use `--sequence.seed=<N>` to reproduce a specific ordering.

Integration test configs (`vitest.config.rls.ts`, `vitest.config.services.ts`, `vitest.config.webhooks.ts`, `vitest.config.queues.ts`, `vitest.config.security.ts`) are **excluded from shuffle** because they use `singleFork: true` + `fileParallelism: false` with shared database state where test ordering matters.

### No Retries

Vitest defaults to 0 retries and we keep it that way. No `retry` config is set in any config file. Tests must pass deterministically on the first attempt.

### Quarantine Convention

Flaky tests that cannot be immediately fixed should be renamed with a `.flaky.test.ts` suffix (e.g., `my-feature.flaky.test.ts`). Quarantined tests are:

- **Excluded from test runs** — Vitest configs exclude `src/**/*.flaky.test.ts`; Jest config excludes `\.flaky\.test\.` via `testPathIgnorePatterns`
- **Blocked by CI** — the `quality` job detects newly added `.flaky.test.` files via `git diff` and fails the PR. This prevents accumulation of quarantined tests — fix flaky tests instead of quarantining new ones
- **Visible in code review** — the `.flaky.test.ts` suffix makes quarantined tests obvious in file listings and PRs

The intent is that quarantine is a temporary state for pre-existing tests. New tests must not be quarantined — fix the flakiness before merging.

---

## Risk-Based Test Matrix

### Domain × Test Layer Coverage

Each cell indicates whether tests exist for that domain at that layer. Key: filled = covered, dash = not applicable or not needed.

| Domain                    | Unit (service)                                       | Unit (route/router) | Unit (web)                | Service integration         | RLS                         | Queue/worker           | E2E                         |
| ------------------------- | ---------------------------------------------------- | ------------------- | ------------------------- | --------------------------- | --------------------------- | ---------------------- | --------------------------- |
| **Hopper** (submissions)  | forms, submissions, embed                            | REST + tRPC routers | hooks, components         | submission, form-validation | submissions, files, history | file-scan              | submissions, uploads, embed |
| **Slate** (pipeline)      | pipeline, publications, issues, contracts, CMS       | REST + tRPC routers | —                         | —                           | pipeline items              | —                      | slate (30 tests)            |
| **Federation**            | trust, simsub, fingerprint, transfer, migration, hub | federation routes   | —                         | federation S2S (15 tests)   | —                           | —                      | federation admin (16 tests) |
| **Workspace**             | portfolio, writer-analytics, CSR                     | tRPC routers        | writer components         | portfolio, CSR              | —                           | —                      | workspace (21 tests)        |
| **Forms**                 | form-builder, form-validation                        | tRPC routers        | —                         | form-validation             | —                           | —                      | forms (16 tests)            |
| **Organization**          | org service, members                                 | REST + tRPC routers | org-switcher, create-org  | org service                 | org_members                 | —                      | organization (14 tests)     |
| **Uploads**               | file service                                         | tusd webhook        | file-upload hook          | —                           | submission_files            | file-scan worker       | uploads (6 tests)           |
| **Embed**                 | embed-token, embed-submission                        | embed routes        | —                         | —                           | submissions                 | —                      | embed (10 tests)            |
| **Analytics**             | submission-analytics                                 | tRPC routers        | analytics components      | —                           | —                           | —                      | analytics (6 tests)         |
| **Relay** (notifications) | email, webhook, notification-pref                    | tRPC routers        | —                         | —                           | —                           | email, webhook workers | —                           |
| **Auth**                  | auth hook, API keys                                  | —                   | use-auth, protected-route | —                           | api_keys                    | —                      | OIDC (6 tests)              |
| **Payments**              | —                                                    | stripe webhook      | —                         | stripe webhook integration  | payments                    | —                      | —                           |
| **Plugins**               | plugin-sdk, create-plugin                            | plugin routes       | plugin-slot, extensions   | —                           | —                           | —                      | —                           |

### High-Risk Low-Coverage Hotspots

Domains with significant code complexity but thinner test coverage relative to their risk:

1. **Relay (notifications)** — Email and webhook workers have queue integration tests, but no E2E tests exercise the full notification flow (event → Inngest → queue → delivery). Email template rendering is untested beyond worker-level.

2. **Slate pipeline transitions** — E2E covers happy-path transitions, but the service layer's transition validation logic (status machine, permission checks per transition) has unit tests only via route-level specs. A dedicated service integration test would catch RLS interaction issues.

3. **Federation S2S trust chain** — Trust establishment, HTTP signature verification, and peer discovery have service integration tests, but the full multi-instance flow (instance A → hub → instance B) is only tested at the unit level with mocked HTTP.

4. **Plugin system** — Plugin SDK has unit tests for adapters and hooks, but plugin lifecycle (install → configure → activate → deactivate) is only tested at the unit level. No integration test exercises a real plugin with the API.

5. **GDPR data deletion** — `gdprService.deleteUser()` touches many tables across domains. Unit test coverage exists, but the full cascade (user data → files → S3 cleanup worker → audit) has no end-to-end verification.

### Minimum Test Layers by Domain Type

Reference standard for what test layers each domain type should have:

| Domain type                                       | Unit (service) | Unit (route) | Service integration | RLS                         | E2E         |
| ------------------------------------------------- | -------------- | ------------ | ------------------- | --------------------------- | ----------- |
| **Data-mutation** (CRUD + state machine)          | Required       | Required     | Recommended         | Required (if tenant-scoped) | Recommended |
| **Integration** (webhooks, queues, external APIs) | Required       | Required     | Required            | —                           | Optional    |
| **Read-heavy** (analytics, reporting, search)     | Required       | Required     | Optional            | Required (if tenant-scoped) | Recommended |
| **Auth/security** (auth, permissions, SSRF)       | Required       | Required     | Required            | Required                    | Required    |
| **UI-heavy** (forms, wizards, dashboards)         | Optional       | —            | —                   | —                           | Required    |

This matrix is documentation only — no automated gates enforce it. Use it during code review and when planning new features to ensure adequate coverage.

---

### Web uses Jest, not Vitest

Web unit tests (`apps/web`) use Jest + ts-jest + jsdom. The rest of the codebase uses Vitest. Migration planned but not yet done. Web tests use `jest.mock()` / `jest.fn()`, not `vi.mock()` / `vi.fn()`.

### `pnpm test` excludes web tests

The root `pnpm test` only runs API and package Vitest tests. Web tests run separately via `pnpm --filter @colophony/web test` because they use a different runner (Jest). In CI, web tests run as part of the `unit-tests` job.

### RLS tests call `globalSetup()` manually in `beforeAll`

There is no Vitest-level `globalSetup` in `vitest.config.rls.ts`. Instead, each RLS test file calls `await globalSetup()` in its `beforeAll` block. This is because the setup creates the `app_user` role and runs migrations, which needs the admin pool — and Vitest global setup files don't share the test process's module scope.

### Drizzle `migrate()` workaround

RLS test `globalSetup()` applies migrations by reading `_journal.json` and executing SQL files manually rather than using `drizzle-kit migrate`. This avoids the drizzle-kit TUI prompt that blocks automation.

### Playwright `webServer.env` replaces `process.env`

Playwright's `webServer.env` config **replaces** (not merges) the child process environment. The config must load `.env` files via `dotenv` and spread `...process.env` to ensure `DATABASE_URL` and other vars reach dev servers.

### Dedicated E2E ports

Playwright tests use separate ports (API: 4010, Web: 3010) to avoid conflicting with the development servers (API: 4000, Web: 3000). Configured in `apps/web/playwright.config.ts`.

### Turborepo `^build` dependency

Vitest resolves workspace packages via `exports` field pointing to `dist/`. CI must run `pnpm build` for dependency packages (`@colophony/db`, `@colophony/types`, `@colophony/auth-client`, `@colophony/api-client`) before running tests.

### RLS `singleFork: true` requirement

RLS tests use `singleFork: true` + `fileParallelism: false` because test files share database pools and rely on sequential `set_config` + `COMMIT`/`ROLLBACK` within transactions. Parallel execution would cause GUC context bleed between tests.

### Console error/warn enforcement

Global setup files spy on `console.error` and `console.warn` in `beforeEach`/`afterEach`. Any unexpected calls fail the test with an actionable message. Setup files:

- **Vitest:** `test/vitest-console-setup.ts` — wired into all `vitest.config.*.ts` files via `setupFiles`
- **Jest:** `apps/web/test/console-setup.ts` — imported from `apps/web/test/setup.ts`

**Allowlists** for known patterns (e.g., Radix UI accessibility warnings) are defined in each setup file. To allowlist a new pattern, add a regex to `ALLOWED_ERROR_PATTERNS` or `ALLOWED_WARN_PATTERNS`.

**Auto-skip:** Tests that install their own spy (e.g., `vi.spyOn(console, 'error').mockImplementation(...)`) are auto-detected via identity check — the `afterEach` hook sees that `console.error` is no longer its spy and skips enforcement for that method.
