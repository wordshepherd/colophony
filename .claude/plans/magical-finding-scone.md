# Testing Optimization Plan

## Context

Static review of testing infrastructure identified 6 CI/config improvements plus E2E brittleness issues. All development tracks are complete, making this a good time to harden the test foundation. The goal is to close gaps between what CI reports and what's actually tested, reduce config drift, and improve E2E selector resilience.

## Scope & Phasing

**This PR (chore/testing-optimization):** Items 1-6 (CI/config fixes). These are infrastructure changes with no feature code impact.

**Separate PR (later):** E2E brittleness fixes — these touch component files (adding `data-testid`) and spec files. Keeping them separate isolates UI changes from CI plumbing. Noted in backlog.

---

## 1. Fix the CI contract around @colophony/db

**Problem:** CI line 146 calls `pnpm --filter @colophony/db test` but `packages/db/package.json` has no `test` script. pnpm exits 0 silently — CI passes with zero assertions.

**Fix:** Replace the `test` call with the existing verification scripts that actually validate something.

**Files to modify:**

- `packages/db/package.json` — Add `"test": "tsx --env-file=.env src/verify-migrations.ts --check"` script that runs the migration verification. This way the `pnpm test` turbo pipeline still works and actually asserts something.
- `.github/workflows/ci.yml` line 146 — Change `pnpm --filter @colophony/db test` to `pnpm --filter @colophony/db verify && pnpm --filter @colophony/db validate-enums`. These scripts need a database connection, so they must move out of the `unit-tests` job (which has no Postgres service) into a dedicated step or existing Postgres-backed job.

**Design decision:** The `unit-tests` job has no Postgres service. Options:

- **A.** Move the db check to the `rls-tests` job (already has Postgres, low overhead to add a step) — recommended
- **B.** Add a dedicated `db-tests` job with Postgres — more CI minutes, cleaner separation
- **C.** Remove the `@colophony/db test` call from `unit-tests` entirely and add a note explaining it has no unit tests

**Recommendation:** Option A — add a "Verify DB migrations" step at the top of `rls-tests` before the RLS tests run (migrations are already applied by the RLS test setup, so `verify` is a cheap sanity check). Remove `@colophony/db test` from the `unit-tests` job line.

**Files:**

- `.github/workflows/ci.yml` — Remove `pnpm --filter @colophony/db test &&` from unit-tests (line 146). Add step to rls-tests job after workspace build: `pnpm --filter @colophony/db verify` with `DATABASE_URL` env var.

---

## 2. Add a dedicated webhook CI job

**Problem:** `test:webhooks` script exists and works locally but has no CI job. Webhook tests need Postgres (same as RLS, services, security tests).

**Fix:** Add a `webhook-tests` job to CI with Postgres service, matching the pattern of `service-integration-tests` and `security-tests`.

**Files:**

- `.github/workflows/ci.yml` — Add `webhook-tests` job after `security-tests`. Copy the Postgres-only service pattern from `security-tests`. Run: `pnpm --filter @colophony/api test:webhooks` with same env vars (`DATABASE_TEST_URL`, `DATABASE_APP_URL`).

**Also update:**

- `CLAUDE.md` CI Pipeline table — add `webhook-tests` row

---

## 3. Include specialized suites in coverage

**Problem:** Coverage job (lines 151-227) only runs `test:cov` which excludes RLS, webhooks, security, services, and queues directories. The reported coverage number understates the actual test surface.

**Fix:** Run coverage variants for the specialized suites and merge their LCOV output into the combined report.

**Approach:** Add `--coverage` flag to the specialized test commands and merge the resulting LCOV files. The specialized configs don't have coverage configured, so we need to add coverage settings to each.

**Files:**

- `apps/api/vitest.config.rls.ts` — Add `coverage` block (same provider/include/exclude/reporters as base config)
- `apps/api/vitest.config.webhooks.ts` — Same
- `apps/api/vitest.config.security.ts` — Same
- `apps/api/vitest.config.services.ts` — Same
- `apps/api/vitest.config.queues.ts` — Same
- `.github/workflows/ci.yml` coverage job — After the main API coverage run, run each specialized suite with `--coverage` using a different `reportsDirectory` (e.g., `coverage-rls/`, `coverage-webhooks/`, etc.). Add all LCOV files to the merge step. This requires Postgres + Redis services on the coverage job.

**Note:** This makes the coverage job heavier (needs Postgres + Redis, runs 6 test suites). An alternative is to publish separate coverage artifacts per specialized job and merge in a downstream job. The former is simpler; the latter is faster (parallel). Given these are relatively quick suites, running them sequentially in the coverage job is acceptable.

**Files (coverage job additions):**

- `.github/workflows/ci.yml` — Add Postgres + Redis services to coverage job. Add steps for each specialized suite with `--coverage`. Update LCOV_FILES array to include all reports. Update artifact upload paths.

---

## 4. Add Python SDK test enforcement

**Problem:** Python SDK is generated from OpenAPI spec but has no tests and no CI enforcement. Generated code could have import errors or type issues that go undetected.

**Fix:** Add pytest as a dev dependency, create a minimal smoke test, and add a CI job.

**Files to create:**

- `sdks/python/tests/__init__.py` — Empty
- `sdks/python/tests/test_smoke.py` — Import smoke tests: verify the main client imports, models import without error, and a basic client instantiation works

**Files to modify:**

- `sdks/python/pyproject.toml` — Add `[tool.poetry.group.dev.dependencies]` with `pytest = "^8.0"`. Add `[tool.pytest.ini_options]` section.
- `.github/workflows/ci.yml` — Add `python-sdk-tests` job: setup Python 3.12, `pip install poetry`, `cd sdks/python && poetry install && poetry run pytest`

**Also update:**

- `CLAUDE.md` CI Pipeline table — add `python-sdk-tests` row

---

## 5. Consolidate Vitest config

**Problem:** 5 specialized configs (`rls`, `webhooks`, `security`, `services`, `queues`) duplicate the same settings (environment, globals, setupFiles, testTimeout, fileParallelism, pool, forks, env). Drift has already occurred — `webhooks` has `singleFork: true` at the wrong nesting level (`test.singleFork` instead of `test.poolOptions.forks.singleFork`), and `queues` uses `test.forks` instead of `test.poolOptions.forks`.

**Fix:** Create a shared base config and use `mergeConfig` in each specialized config.

**Files to create:**

- `apps/api/vitest.config.integration-base.ts` — Shared base for all integration test configs:

  ```typescript
  import { defineConfig } from "vitest/config";

  export const integrationBase = defineConfig({
    test: {
      environment: "node",
      globals: false,
      setupFiles: ["../../test/vitest-console-setup.ts"],
      testTimeout: 30_000,
      fileParallelism: false,
      pool: "forks",
      poolOptions: {
        forks: {
          singleFork: true,
        },
      },
      env: {
        DATABASE_URL:
          process.env.DATABASE_APP_URL ??
          "postgresql://app_user:app_password@localhost:5433/colophony_test",
      },
    },
  });
  ```

**Files to modify:**

- `apps/api/vitest.config.rls.ts` — Import base, `mergeConfig(integrationBase, { test: { include: [...] } })`
- `apps/api/vitest.config.webhooks.ts` — Same, add `NODE_ENV: 'test'` env override. **Fix:** Remove incorrect `singleFork` at top level.
- `apps/api/vitest.config.security.ts` — Same
- `apps/api/vitest.config.services.ts` — Same
- `apps/api/vitest.config.queues.ts` — Same, keep extra setupFiles and Redis env vars. **Fix:** Move `forks` into `poolOptions.forks`.

**Note:** The base `vitest.config.ts` (unit tests) stays separate — it has different include/exclude patterns, runs in parallel, and has coverage thresholds. No value in merging it with the integration base.

---

## 6. Tighten determinism in web tests

**Problem:** `apps/web/test/setup.ts:57` mocks `crypto.randomUUID` with `Math.random()`, producing non-deterministic UUIDs. Combined with Jest's `--randomize` flag, failures involving UUIDs are hard to reproduce.

**Fix:** Replace `Math.random()` with a deterministic counter that produces predictable, unique UUIDs per test run.

**Files to modify:**

- `apps/web/test/setup.ts` lines 54-59 — Replace:
  ```typescript
  // Mock crypto.randomUUID with deterministic counter
  let uuidCounter = 0;
  Object.defineProperty(globalThis, "crypto", {
    value: {
      randomUUID: () => {
        const count = (++uuidCounter).toString(16).padStart(12, "0");
        return `00000000-0000-4000-8000-${count}`;
      },
    },
  });
  ```
  Reset counter in `afterEach`:
  ```typescript
  uuidCounter = 0;
  ```

This produces valid UUID v4 format strings (`00000000-0000-4000-8000-000000000001`, `...002`, etc.) that are deterministic within each test and reset between tests.

---

## Files NOT changing

- `apps/web/e2e/**` — E2E brittleness improvements are out of scope for this PR
- `apps/web/src/components/**` — No `data-testid` additions in this PR
- `apps/api/vitest.config.ts` — Base unit test config stays as-is
- `apps/web/jest.config.ts` — Jest config stays as-is (Vitest migration is a separate P3 backlog item)

---

## Verification

1. **Local checks:**
   - `pnpm --filter @colophony/api test` — Unit tests still pass
   - `pnpm --filter @colophony/api test:rls` — RLS tests pass with consolidated config
   - `pnpm --filter @colophony/api test:webhooks` — Webhook tests pass
   - `pnpm --filter @colophony/api test:security` — Security tests pass
   - `pnpm --filter @colophony/api test:services` — Service tests pass
   - `pnpm --filter @colophony/api test:queues` — Queue tests pass
   - `pnpm --filter @colophony/web test` — Web unit tests pass with deterministic UUIDs
   - `cd sdks/python && poetry install && poetry run pytest` — Python SDK smoke tests pass

2. **CI validation:**
   - Push branch, verify all existing jobs still pass
   - Verify new `webhook-tests` job runs and passes
   - Verify new `python-sdk-tests` job runs and passes
   - Verify coverage job includes specialized suite LCOV data
   - Verify `@colophony/db test` no longer silently passes in unit-tests

3. **Config drift check:**
   - Verify all 5 integration configs import from `vitest.config.integration-base.ts`
   - Verify `poolOptions.forks.singleFork` is correctly nested in all configs
