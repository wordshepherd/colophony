# Plan: READER Role Enforcement

## Context

The READER role exists in the org roles enum (ADMIN/EDITOR/READER) but is currently "decorative." READERs are blocked from mutations by `assertEditorOrAdmin()` on the backend, but the frontend doesn't distinguish them from EDITORs — they see all UI elements and only get 403 errors when attempting writes. The `isReader` flag in `useOrganization()` is broken (means "has any membership" instead of "has READER role").

**Goal:** Make READER a proper read-only role: fix the semantic bug in `isReader`, add the one missing backend guard, and ensure the frontend hides write-action UI for READERs.

## Design Decisions

### Sidebar Navigation for READERs

**Decision:** Keep Editor/Slate/Admin sections hidden for READERs (current behavior via `isEditor` guard is correct). READERs access submitter-facing pages only.

### Pipeline Comments

**Decision:** Add `assertEditorOrAdmin` to `addCommentWithAudit` — this is the only mutation missing a role check. READERs should not write pipeline comments.

### Analytics Access

**Decision:** Leave analytics endpoints gated behind `assertEditorOrAdmin` (current behavior). Writer personal analytics are already available without role checks.

---

## Changes

### 1. Fix `isReader` semantics + add `canWrite` flag

**File:** `apps/web/src/hooks/use-organization.ts` (line 101)

- Change `isReader` from `!!currentOrg` to `currentOrg?.role === "READER"`
- Add `canWrite` convenience flag: `!!currentOrg && currentOrg.role !== "READER"`
- Add `canWrite` to the returned object

### 2. Backend: Add missing pipeline comment guard

**File:** `apps/api/src/services/pipeline.service.ts` (line 477, `addCommentWithAudit` method)

- Add `assertEditorOrAdmin(ctx.actor.role)` as the first line of `addCommentWithAudit`
- Import already exists at line 29: `import { assertEditorOrAdmin } from './errors.js'`
- Add `.limit(1000)` to `listComments` (line 496) and `listHistory` (line 508) — unbounded query fix (Codex review finding)

### 3. Update `useOrganization` hook tests

**File:** `apps/web/src/hooks/__tests__/use-organization.spec.tsx`

Update existing test assertions:

- **"should detect ADMIN role"** (line 149): `isReader` → `false`, add `canWrite: true`
- **"should detect EDITOR role"** (line 157): `isReader` → `false`, add `canWrite: true`
- **"should detect READER role"** (line 165): `isReader` stays `true`, add `canWrite: false`
- **"should recover to first org roles when stored org is stale"** (line 174): `isReader` → `false`, add `canWrite: true`

### 4. Add sidebar READER test

**File:** `apps/web/src/components/layout/__tests__/sidebar.spec.tsx`

Add test case:

- **"should hide Editor, Slate, and Admin sections for READER"**: Set `mockIsEditor = false`, `mockIsAdmin = false`, render `<Sidebar />`, assert Editor Dashboard / Slate Dashboard / Organization not in document, assert My Submissions is visible. (This mirrors existing tests but makes the READER-specific scenario explicit.)

### 5. Add pipeline comment role guard test

**File:** `apps/api/src/services/pipeline.service.spec.ts` (new or append to existing)

Check if spec file exists. If not, create minimal spec with two test cases:

- **"addCommentWithAudit rejects READER role"**: ctx with `actor.role = 'READER'`, assert throws ForbiddenError
- **"addCommentWithAudit allows EDITOR role"**: ctx with `actor.role = 'EDITOR'`, mock getById returns item, assert no ForbiddenError

### 6. E2E: READER role restrictions

**File:** `apps/web/e2e/helpers/reader-fixtures.ts` (new)

Create fixtures following `apps/web/e2e/helpers/workspace-fixtures.ts` pattern:

- Use `writer@example.com` (READER role in quarterly-review org, already seeded)
- API key scopes: read-only (`organizations:read`, `submissions:read`, `users:read`, `periods:read`)
- `authedPage` fixture with READER auth state

**File:** `apps/web/e2e/organization/reader-role.spec.ts` (new)

Test cases:

1. **"READER does not see editor navigation"**: navigate to `/submissions`, assert sidebar has no "Editor Dashboard", no "Slate Dashboard", no "Organization" heading. Assert "My Submissions" visible.
2. **"READER sees org settings as read-only"**: navigate to `/organizations/settings`, assert page loads, assert no "Save" or "Update" button visible, assert no "Danger Zone" section.
3. **"READER cannot see invite member button"**: navigate to `/organizations/settings`, click Members tab, assert member list loads, assert "Invite Member" button not visible.

---

## Files Changed

| File                                                        | Type          | Description                                        |
| ----------------------------------------------------------- | ------------- | -------------------------------------------------- |
| `apps/web/src/hooks/use-organization.ts`                    | Modify        | Fix `isReader`, add `canWrite`                     |
| `apps/web/src/hooks/__tests__/use-organization.spec.tsx`    | Modify        | Update assertions for `isReader`/`canWrite`        |
| `apps/api/src/services/pipeline.service.ts`                 | Modify        | Add `assertEditorOrAdmin` to `addCommentWithAudit` |
| `apps/web/src/components/layout/__tests__/sidebar.spec.tsx` | Modify        | Add READER navigation test                         |
| `apps/api/src/services/pipeline.service.spec.ts`            | Create/Modify | Pipeline comment role guard tests                  |
| `apps/web/e2e/helpers/reader-fixtures.ts`                   | Create        | E2E fixtures for READER tests                      |
| `apps/web/e2e/organization/reader-role.spec.ts`             | Create        | E2E tests for READER restrictions                  |

**Codex review findings addressed:**

- E2E fixtures moved to `apps/web/e2e/helpers/` (project convention)
- Pipeline `listComments`/`listHistory` unbounded queries capped with `.limit(1000)`
- Pipeline defense-in-depth (orgId filters on query methods) — out of scope for this PR, noted for separate hardening pass

## Files NOT Changed

- `apps/api/src/services/errors.ts` — `assertEditorOrAdmin` already correct
- `apps/api/src/trpc/init.ts` — no new procedure builder needed
- `apps/api/src/services/submission-vote.service.ts` — READER reviewer exception already works
- `apps/api/src/services/submission-discussion.service.ts` — READER reviewer exception already works
- All Slate components — existing `isAdmin`/`isEditor` guards already hide write actions
- All webhook/federation components — behind `isAdmin` sidebar gate
- Sidebar component itself — already correctly gates with `isEditor`/`isAdmin`

## Verification

1. **Unit tests**: `pnpm --filter @colophony/api test -- pipeline.service` (new guard test)
2. **Web tests**: `pnpm --filter @colophony/web test -- use-organization sidebar` (updated assertions)
3. **E2E**: `pnpm --filter @colophony/web test:e2e -- reader-role` (new READER E2E)
4. **Manual check**: Switch to a READER-role org in the UI, verify sidebar hides Editor/Slate/Admin, verify Settings shows read-only
