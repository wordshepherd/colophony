# Post-OpenCode Review Audit (From 2026-02-25 Switch)

Scope: Implementations logged after the session `2026-02-25 — Federation Data Model Cleanup + OpenCode Review Skill` in `docs/devlog/2026-02.md`.

Method: Read devlog sessions after the switch point, inspect corresponding code paths, and flag issues affecting security, reliability, performance, or long-term maintainability.

## Findings (Incremental)

### 1) [Security] Outbound webhook URLs are not constrained (SSRF pivot risk in multi-tenant hosting)

- Evidence:
  - `createWebhookEndpointSchema` and `updateWebhookEndpointSchema` accept any URL: `packages/types/src/webhook.ts:29-49`.
  - Worker posts directly to `endpointUrl` without host/IP allow/deny checks: `apps/api/src/workers/webhook.worker.ts:48-59`.
- Why it matters: any org admin can configure callbacks to internal/private network targets reachable from the API runtime, which is a classic SSRF pivot and can be used for lateral movement/exfiltration in hosted deployments.
- Recommendation: enforce `https` and block private/loopback/link-local/metadata IP ranges after DNS resolution (IPv4+IPv6), with optional explicit allowlist for self-hosted mode.

### 2) [Security/Privacy] Embed status tokens have no expiry or rotation policy

- Evidence:
  - Verification function matches hash only, with no TTL/expiry condition: `packages/db/migrations/0044_status_token.sql:5-16`.
  - Runtime verification also does hash lookup only: `apps/api/src/services/status-token.service.ts:58-80`.
- Why it matters: leaked links remain valid indefinitely, allowing long-lived external visibility into submission metadata.
- Recommendation: add `status_token_expires_at`, enforce expiry in `verify_status_token()`, and rotate token on resubmission/status-sensitive transitions.

### 3) [Reliability/Performance] Aging analytics/reminder paths are unbounded and can degrade under large orgs

- Evidence:
  - Analytics query materializes all aging submissions and buckets in memory with no `LIMIT`/pagination: `apps/api/src/services/submission-analytics.service.ts:264-339`.
  - Reminder source query returns all aging submissions for an org: `apps/api/src/services/submission.service.ts:1252-1303`.
  - Cron includes full `agingSubmissions` list in each editor email payload: `apps/api/src/inngest/functions/submission-response-reminder.ts:61-111`.
- Why it matters: large datasets can spike memory, execution time, and email payload size; repeated payload duplication per editor multiplies cost.
- Recommendation: cap results, paginate analytics details, and send summarized reminder emails (count + top N oldest + dashboard link).

### 4) [Security/Reliability] Federation rate limiting fails open on Redis errors

- Evidence:
  - Catch block explicitly allows request when Redis eval fails: `apps/api/src/federation/federation-rate-limit.ts:75-81`.
- Why it matters: during Redis outages/degradation, federation endpoints lose abuse protection exactly when systems are already stressed.
- Recommendation: configurable fail mode (`fail_open` vs `fail_closed`), with at least a minimal in-process fallback limiter when Redis is unavailable.

### 5) [Reliability/Test Coverage] Critical federation paths were explicitly left untested after the review-tool switch

- Evidence:
  - Devlog records unresolved gaps: trust handshake not tested, hub-first path not tested: `docs/devlog/2026-02.md:744-747`.
- Why it matters: these are cross-instance trust and duplicate-detection paths where regressions can silently break federation correctness/security assumptions.
- Recommendation: add automated integration tests for real handshake flow and hub-first query/decision path before additional federation changes.

### 6) [Future Development/Safety] Webhook endpoint lookup relies on implicit RLS and ignores its `orgId` argument

- Evidence:
  - `getActiveEndpointsForEvent(tx, _orgId, eventType)` never applies org filter: `apps/api/src/services/webhook.service.ts:135-148`.
- Why it matters: today this is safe only because callers wrap it in `withRls({ orgId })`. A future call site using superuser context could unintentionally fan out events across tenants.
- Recommendation: enforce explicit `organizationId` predicate in query even when RLS is expected (`eq(webhookEndpoints.organizationId, orgId)`).

### 7) [Reliability/Data Consistency] Saved preset limits/default semantics are race-prone

- Evidence:
  - `count` check then insert is non-atomic (can exceed 20 under concurrent requests): `apps/api/src/services/queue-preset.service.ts:47-55,70-78`.
  - Default-handling updates then inserts with no DB constraint ensuring a single default preset per user: `apps/api/src/services/queue-preset.service.ts:57-68`.
  - Schema has no partial unique index like `(organization_id, user_id) WHERE is_default`: `packages/db/src/schema/saved-queue-presets.ts:31-45`.
- Why it matters: inconsistent UI behavior (multiple defaults) and policy drift under concurrent writes.
- Recommendation: add DB constraints (partial unique index for default, trigger or bounded insert guard) and make create/update transactional with conflict-safe logic.
