# Colophony API — Fastify Backend

## Key Paths

| What              | Path                              |
| ----------------- | --------------------------------- |
| App entry         | `src/main.ts`                     |
| Env config (Zod)  | `src/config/env.ts`               |
| Fastify hooks     | `src/hooks/`                      |
| Service layer     | `src/services/`                   |
| tRPC router       | `src/trpc/router.ts`              |
| tRPC client types | `src/trpc/client-types.ts`        |
| tRPC init         | `src/trpc/init.ts`                |
| tRPC context      | `src/trpc/context.ts`             |
| tusd webhook      | `src/webhooks/tusd.webhook.ts`    |
| Zitadel webhook   | `src/webhooks/zitadel.webhook.ts` |

---

## Hook Registration Order (from `main.ts`)

```
rateLimit → auth → orgContext → dbContext → audit
```

Each hook decorates the Fastify request:

| Hook               | Decorates                        | Purpose                                                     |
| ------------------ | -------------------------------- | ----------------------------------------------------------- |
| `rateLimitPlugin`  | —                                | Redis-based sliding window rate limiting (runs before auth) |
| `authPlugin`       | `request.authContext`            | Validates OIDC token or X-Api-Key, extracts user identity   |
| `orgContextPlugin` | `request.authContext.orgId/role` | Resolves `X-Organization-Id` header, checks membership      |
| `dbContextPlugin`  | `request.dbTx`                   | Opens RLS transaction via `SET LOCAL` with org/user context |
| `auditPlugin`      | `request.audit`                  | Provides `audit(action, details)` helper for logging        |

**RLS runtime contract:** `dbContext` hook calls `SET LOCAL` to set `app.current_org` and `app.user_id` inside a per-request transaction. RLS policy definitions are in `packages/db/CLAUDE.md`.

---

## Authentication

Dual auth: Zitadel OIDC tokens for interactive users, API keys for programmatic access.

**Default-deny model:** The auth hook rejects all requests to non-public routes that lack a valid `Authorization` header or `X-Api-Key` header (returns 401). Public routes are explicitly allowlisted in `auth.ts` via `PUBLIC_EXACT` and `PUBLIC_PREFIXES`. This provides defense-in-depth — even if a tRPC procedure accidentally uses `publicProcedure`, the hook layer still requires auth unless the route is explicitly allowlisted.

**Auth precedence:** Bearer token (OIDC) is checked first. `X-Api-Key` is the fallback when no `Authorization` header is present. When both are present, Bearer wins.

- **Interactive users:** Zitadel OIDC tokens (access + refresh) — sets `authMethod: 'oidc'`
- **API consumers:** API keys via `X-Api-Key` header — sets `authMethod: 'apikey'`
- **Dev bypass:** Set `DEV_AUTH_BYPASS=true` to allow unauthenticated requests in development when `ZITADEL_AUTHORITY` is not configured. Never effective in production.

### API Key Authentication

- **Key format:** `col_live_<32 hex chars>` (41 chars total, 128 bits of entropy)
- **Storage:** SHA-256 hash stored in `api_keys` table. Plain text shown once on creation, never stored.
- **Org-scoped:** Each key belongs to an organization. `createdBy` tracks the creating user.
- **Auth context:** Uses the creator's `userId` for audit trail and RLS. Pre-sets `orgId` from the key.
- **Scopes:** Stored in `scopes` JSONB column. Enforcement deferred to Track 2 (REST/GraphQL surfaces).
- **Lookup:** `verify_api_key()` SECURITY DEFINER function bypasses RLS for cross-org hash lookup.
- **`lastUsedAt`:** Updated fire-and-forget via `touch_api_key_last_used()` SECURITY DEFINER function.
- **CRUD:** tRPC router at `apiKeys.*`. Only ADMIN can create/revoke/delete. All org members can list.
- **Fail closed:** If the key creator is no longer an org member, the org-context hook rejects with 403.

User lifecycle events are synced from Zitadel to the local DB via webhooks.

---

## API Surfaces

| Surface     | Audience              | Status    | Auth               |
| ----------- | --------------------- | --------- | ------------------ |
| **tRPC**    | Internal web frontend | **Built** | Zitadel OIDC token |
| **REST**    | Public API, Zapier    | _Planned_ | API key or OIDC    |
| **GraphQL** | Power users           | _Planned_ | API key or OIDC    |

All surfaces share the same service layer and Zod schemas from `@colophony/types`.

---

## tRPC Procedure Builders (`src/trpc/init.ts`)

| Builder           | Middleware chain | Guarantees                                    |
| ----------------- | ---------------- | --------------------------------------------- |
| `publicProcedure` | none             | No auth required                              |
| `authedProcedure` | `isAuthed`       | `ctx.authContext` is non-null                 |
| `orgProcedure`    | `hasOrgContext`  | `ctx.authContext.orgId/role` + `ctx.dbTx` set |
| `adminProcedure`  | `isAdmin`        | `orgProcedure` + `role === 'ADMIN'`           |

Also exported: `createRouter`, `mergeRouters`.

---

## Payments (Stripe Checkout)

Stripe Checkout only (zero PCI scope). Stripe integration is planned — no handler exists yet.

**NEVER:**

- Log card numbers or CVV
- Store card data in database
- Process a webhook without idempotency check
- Skip transaction wrapping for webhook processing

---

## Webhook Idempotency

### Zitadel (built)

`src/webhooks/zitadel.webhook.ts` — verifies `x-zitadel-signature` header, registered in an isolated Fastify scope with `fastify-raw-body`.

### tusd (built)

`src/webhooks/tusd.webhook.ts` — pre-create validates auth/submission/limits, post-finish creates file record idempotently (checks `storageKey` exists before insert). Registered in isolated Fastify scope at `/webhooks/tusd`. Auth: validates forwarded `Authorization` header via JWKS, resolves Zitadel `sub` → local user UUID via `resolveLocalUserId()`. Fails closed when auth cannot be verified.

### Stripe (planned)

When built: check processed status in `stripe_webhook_events` table before handling. Use database transaction. Record event ID after processing.

---

## BullMQ Workers

### Queue/Worker Pattern

- **Queues**: `src/queues/<name>.queue.ts` — singleton queue, `enqueue*()` helper, `close*()` for shutdown
- **Workers**: `src/workers/<name>.worker.ts` — `start*Worker(env)` / `stop*Worker()` lifecycle functions
- **Barrel exports**: `src/queues/index.ts` and `src/workers/index.ts`

### RLS in Workers

Workers have no HTTP context. Use `withRls({ orgId })` for all DB operations on tenant tables. Each logical phase (status update, audit log) should be wrapped in its own `withRls()` call. S3 operations happen outside `withRls` since they don't touch the DB.

```typescript
// Phase 1: update status
await withRls({ orgId: job.data.organizationId }, async (tx) => {
  await fileService.updateScanStatus(tx, fileId, 'SCANNING');
});
// Phase 2: S3/external ops (no RLS needed)
// Phase 3: update status + audit
await withRls({ orgId: job.data.organizationId }, async (tx) => {
  await fileService.updateScanStatus(tx, fileId, 'CLEAN');
  await auditService.log(tx, { ... });
});
```

### Shutdown

Workers and queues are started in `main.ts` and closed during graceful shutdown. Always close workers before queues.

### File Scan Worker

- **Queue**: `file-scan` — jobs enqueued from tusd post-finish webhook _after_ DB commit
- **Job idempotency**: `jobId: fileId` prevents duplicate scans from duplicate webhook calls
- **Flow**: PENDING → SCANNING → CLEAN/INFECTED/FAILED
- **Fail closed**: ClamAV errors → FAILED status → downloads blocked → BullMQ retries (3 attempts, exponential backoff)
- **Feature flag**: `VIRUS_SCAN_ENABLED` (default `true`). When `false`, files are marked CLEAN immediately in the tusd webhook

### Env Vars

| Variable             | Default     | Purpose                                     |
| -------------------- | ----------- | ------------------------------------------- |
| `CLAMAV_HOST`        | `localhost` | ClamAV daemon TCP host                      |
| `CLAMAV_PORT`        | `3310`      | ClamAV daemon TCP port                      |
| `VIRUS_SCAN_ENABLED` | `true`      | Enable/disable virus scans                  |
| `DEV_AUTH_BYPASS`    | `false`     | Allow unauthed requests in dev (no Zitadel) |

---

## Quirks

| Quirk                                 | Details                                                                                                                                                                                                                                                                                                                  |
| ------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **Zitadel webhook signatures**        | Verify `x-zitadel-signature` header on all webhook payloads. Use shared secret from Zitadel Actions config                                                                                                                                                                                                               |
| **BullMQ Redis password**             | Uses `REDIS_HOST`/`REDIS_PORT`/`REDIS_PASSWORD` (not `REDIS_URL`). Pass password in worker/queue config                                                                                                                                                                                                                  |
| **tRPC TS2742 under NodeNext**        | `typeof appRouter` can't be named without internal `@trpc/server/dist/core/router` reference. Workaround: `declaration: false` in API tsconfig. Web app resolves `AppRouter` via source path alias pointing to `src/trpc/client-types.ts` (bundler resolution). All web-facing type exports go through `client-types.ts` |
| **`@fastify/raw-body` doesn't exist** | Official `@fastify/` scoped package not published on npm. Use `fastify-raw-body` (community package, v5.0.0 for Fastify 5)                                                                                                                                                                                               |

## Version Pins

| Package | Pinned | Notes                                               |
| ------- | ------ | --------------------------------------------------- |
| Fastify | 5.x    | Major version; check plugin compat before upgrading |
| tRPC    | 10.45  | Internal only; Zod error behavior specific to v10   |
| Stripe  | 20.3   | —                                                   |
| BullMQ  | 5      | —                                                   |
