# Production Hardening: enableRLS, SSRF, Unbounded Queries

## Context

Three P2/P3 production hardening items remain from Codex reviews (2026-03-19). All are defense-in-depth fixes — RLS is active in the migration but the schema definition is inconsistent, SSRF validation is partially applied, and three queries lack safety limits. Closing these before Coolify deployment.

## Fix 1: userKeys missing `.enableRLS()`

**Problem:** `userKeys` table has 3 `pgPolicy` definitions but no `.enableRLS()` call. The migration (0024) correctly has `ENABLE ROW LEVEL SECURITY` + `FORCE ROW LEVEL SECURITY`, so production is protected — but the Drizzle schema is inconsistent, and future `drizzle-kit generate` could produce a migration that drops RLS.

**File:** `packages/db/src/schema/user-keys.ts`

**Change:** Add `.enableRLS()` after line 63's closing `]` → `]).enableRLS();`

**Migration:** Generate migration via `pnpm db:generate`. The migration should add `ALTER TABLE "user_keys" ENABLE ROW LEVEL SECURITY` + `FORCE ROW LEVEL SECURITY` (idempotent — already present from 0024, Postgres ignores duplicate ENABLE).

## Fix 2: SSRF validation in hub-client.service.ts

**Problem:** 4 `fetch()` calls, only 1 has `validateOutboundUrl()` (line 199). The other 3 (lines 38, 104, 141) skip validation. All use `env.HUB_DOMAIN` (admin-configured env var, not user input), but defense-in-depth requires validation — a misconfigured env var pointing to a private IP could enable SSRF.

**File:** `apps/api/src/services/hub-client.service.ts`

**Changes (3 locations):**

1. **`registerWithHub()` (before line 38):** Add URL construction + validation:

   ```typescript
   const url = `https://${env.HUB_DOMAIN}/federation/v1/hub/register`;
   const devMode = env.NODE_ENV === "development" || env.NODE_ENV === "test";
   await validateOutboundUrl(url, { devMode });
   ```

   Then use `url` in the fetch call.

2. **`pushFingerprint()` (before line 104):** Add after existing URL construction (line 94):

   ```typescript
   const devMode = env.NODE_ENV === "development" || env.NODE_ENV === "test";
   await validateOutboundUrl(url, { devMode });
   ```

3. **`queryHubFingerprints()` (before line 141):** Add after existing URL construction (line 130):
   ```typescript
   const devMode = env.NODE_ENV === "development" || env.NODE_ENV === "test";
   await validateOutboundUrl(url, { devMode });
   ```

**Pattern:** Matches `initiateHubAttestedTrust()` at line 199 (same file) and `trust.service.ts:90-104`.

**Not changed:** Line 199 (`initiateHubAttestedTrust`) — already protected.

**DRY consideration:** Extract `devMode` to a module-level helper or constant to avoid repeating `env.NODE_ENV === 'development' || env.NODE_ENV === 'test'` in 4 places. Check if `initiateHubAttestedTrust` already computes it the same way.

## Fix 3: Unbounded queries — add safety LIMIT

**Problem:** Three queries return all matching rows with no LIMIT. While practical row counts are small (correspondence per submission, history per submission, files per manuscript version), defense-in-depth requires a cap.

**Approach:** Add a hard safety LIMIT (not full pagination) since these are internal/detail-view methods where callers expect all results. Use a reasonable cap constant.

### 3a. `correspondence.service.ts:70` — `listBySubmission()`

**File:** `apps/api/src/services/correspondence.service.ts`

**Change:** Add `.limit(500)` to the query chain (after `.orderBy()`). 500 is generous — submissions rarely have more than ~50 messages.

### 3b. `submission.service.ts:730` — `getHistory()`

**File:** `apps/api/src/services/submission.service.ts`

**Change:** Add `.limit(1000)` to the query chain. History is append-only status transitions — even busy submissions won't exceed hundreds.

### 3c. `file.service.ts:80` — `listByManuscriptVersion()`

**File:** `apps/api/src/services/file.service.ts`

**Change:** Add `.limit(100)` to the query chain. Manuscript versions have practical file limits (main document + supplementary materials).

## Files Modified

| File                                              | Change                                     |
| ------------------------------------------------- | ------------------------------------------ |
| `packages/db/src/schema/user-keys.ts`             | Add `.enableRLS()`                         |
| `packages/db/migrations/NNNN_*.sql`               | Generated migration (enableRLS idempotent) |
| `apps/api/src/services/hub-client.service.ts`     | Add 3x `validateOutboundUrl()` calls       |
| `apps/api/src/services/correspondence.service.ts` | Add `.limit(500)`                          |
| `apps/api/src/services/submission.service.ts`     | Add `.limit(1000)`                         |
| `apps/api/src/services/file.service.ts`           | Add `.limit(100)`                          |

## Files NOT Modified

- `apps/api/src/lib/url-validation.ts` — no changes needed
- `packages/db/migrations/0024_user_keys.sql` — already correct
- Any test files — these are defense-in-depth hardening, existing tests cover functionality

## Verification

1. `pnpm db:generate` — verify migration is generated for enableRLS
2. `pnpm db:migrate` — apply migration (should be idempotent)
3. `pnpm type-check` — no type errors
4. `pnpm test` — all unit tests pass
5. `pnpm lint` — no lint errors
6. Grep for `fetch(` in `hub-client.service.ts` — every call preceded by `validateOutboundUrl`
7. Grep for `.from(correspondence)`, `.from(submissionHistory)`, `.from(files)` — verify LIMIT present on the three targeted queries
