# Colophony API — Fastify Backend

## Key Paths

| What              | Path                                       |
| ----------------- | ------------------------------------------ |
| App entry         | `src/main.ts`                              |
| Env config (Zod)  | `src/config/env.ts`                        |
| Fastify hooks     | `src/hooks/`                               |
| Service layer     | `src/services/`                            |
| Manuscript svc    | `src/services/manuscript.service.ts`       |
| tRPC router       | `src/trpc/router.ts`                       |
| tRPC client types | `src/trpc/client-types.ts`                 |
| tRPC init         | `src/trpc/init.ts`                         |
| tRPC context      | `src/trpc/context.ts`                      |
| REST router       | `src/rest/router.ts`                       |
| REST context      | `src/rest/context.ts`                      |
| REST error mapper | `src/rest/error-mapper.ts`                 |
| REST org handlers | `src/rest/routers/organizations.ts`        |
| GraphQL schema    | `src/graphql/schema.ts`                    |
| GraphQL builder   | `src/graphql/builder.ts`                   |
| GraphQL guards    | `src/graphql/guards.ts`                    |
| GraphQL resolvers | `src/graphql/resolvers/`                   |
| GraphQL router    | `src/graphql/router.ts`                    |
| GDPR service      | `src/services/gdpr.service.ts`             |
| Embed routes      | `src/routes/embed.routes.ts`               |
| Embed token svc   | `src/services/embed-token.service.ts`      |
| Embed submit svc  | `src/services/embed-submission.service.ts` |
| tusd webhook      | `src/webhooks/tusd.webhook.ts`             |
| Zitadel webhook   | `src/webhooks/zitadel.webhook.ts`          |
| Stripe webhook    | `src/webhooks/stripe.webhook.ts`           |
| Documenso webhook | `src/webhooks/documenso.webhook.ts`        |
| Inngest client    | `src/inngest/client.ts`                    |
| Inngest functions | `src/inngest/functions/`                   |
| Inngest serve     | `src/inngest/serve.ts`                     |
| CMS adapters      | `src/adapters/cms/`                        |
| Documenso adapter | `src/adapters/documenso.adapter.ts`        |
| Outbox poller     | `src/workers/outbox-poller.worker.ts`      |
| Federation trust  | `src/federation/trust.routes.ts` (S2S)     |
| Trust admin       | `src/federation/trust-admin.routes.ts`     |
| Trust service     | `src/services/trust.service.ts`            |
| HTTP signatures   | `src/federation/http-signatures.ts`        |
| Federation auth   | `src/federation/federation-auth.ts`        |
| Sim-sub routes    | `src/federation/simsub.routes.ts` (S2S)    |
| Sim-sub admin     | `src/federation/simsub-admin.routes.ts`    |
| Sim-sub service   | `src/services/simsub.service.ts`           |
| Fingerprint svc   | `src/services/fingerprint.service.ts`      |
| Transfer routes   | `src/federation/transfer.routes.ts` (S2S)  |
| Transfer admin    | `src/federation/transfer-admin.routes.ts`  |
| Transfer service  | `src/services/transfer.service.ts`         |

### Service Method Naming

| Suffix       | Meaning                                                  |
| ------------ | -------------------------------------------------------- |
| `WithAccess` | Checks owner-or-editor access via `ServiceContext.actor` |
| `AsOwner`    | Checks ownership (submitterId === actor.userId) + audits |
| `WithAudit`  | Wraps a mutation with audit logging                      |

Pure data methods keep `(tx, ...)` signatures for worker/internal use. Access-aware methods accept `ServiceContext` and throw `ForbiddenError`/`NotFoundError` — callers use `mapServiceError()` to translate to surface-specific errors.

---

## Hook Registration Order (from `main.ts`)

```
rateLimit (IP) → auth → rateLimitAuth (user) → orgContext → dbContext → audit
```

Each hook decorates the Fastify request:

| Hook                  | Decorates                        | Purpose                                                                 |
| --------------------- | -------------------------------- | ----------------------------------------------------------------------- |
| `rateLimitPlugin`     | `app.rateLimitRedis`             | IP-based rate limiting (DEFAULT_MAX, runs before auth — DoS shield)     |
| `rateLimitAuthPlugin` | —                                | User-based rate limiting (AUTH_MAX, runs after auth, overrides headers) |
| `authPlugin`          | `request.authContext`            | Validates OIDC token or X-Api-Key, extracts user identity               |
| `orgContextPlugin`    | `request.authContext.orgId/role` | Resolves `X-Organization-Id` header, checks membership                  |
| `dbContextPlugin`     | `request.dbTx`                   | Opens RLS transaction via `SET LOCAL` with org/user context             |
| `auditPlugin`         | `request.audit`                  | Provides `audit(action, details)` helper for logging                    |

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
- **Scopes:** Stored in `scopes` JSONB column. Enforced by `requireScopes` middleware on REST + tRPC + GraphQL surfaces. OIDC/test auth bypasses scope checks.
- **Lookup:** `verify_api_key()` SECURITY DEFINER function bypasses RLS for cross-org hash lookup.
- **`lastUsedAt`:** Updated fire-and-forget via `touch_api_key_last_used()` SECURITY DEFINER function.
- **CRUD:** tRPC router at `apiKeys.*`. Only ADMIN can create/revoke/delete. All org members can list.
- **Fail closed:** If the key creator is no longer an org member, the org-context hook rejects with 403.

User lifecycle events are synced from Zitadel to the local DB via webhooks.

---

## API Surfaces

| Surface     | Audience              | Status                                         | Auth               |
| ----------- | --------------------- | ---------------------------------------------- | ------------------ |
| **tRPC**    | Internal web frontend | **Built**                                      | Zitadel OIDC token |
| **REST**    | Public API, Zapier    | **Built** (oRPC + OpenAPI 3.1 at `/v1/docs`)   | API key or OIDC    |
| **GraphQL** | Power users           | **Built** (Pothos + Yoga, queries + mutations) | API key or OIDC    |

All surfaces share the same service layer and Zod schemas from `@colophony/types`.

---

## tRPC Procedure Builders (`src/trpc/init.ts`)

| Builder           | Middleware chain | Guarantees                                    |
| ----------------- | ---------------- | --------------------------------------------- |
| `publicProcedure` | none             | No auth required                              |
| `authedProcedure` | `isAuthed`       | `ctx.authContext` is non-null                 |
| `orgProcedure`    | `hasOrgContext`  | `ctx.authContext.orgId/role` + `ctx.dbTx` set |
| `userProcedure`   | `hasUserContext` | `ctx.authContext` + `ctx.dbTx` (no org)       |
| `adminProcedure`  | `isAdmin`        | `orgProcedure` + `role === 'ADMIN'`           |

Also exported: `createRouter`, `mergeRouters`.

---

## Payments (Stripe Checkout)

Stripe Checkout only (zero PCI scope). Webhook handler built at `src/webhooks/stripe.webhook.ts`.

**NEVER:**

- Log card numbers or CVV
- Store card data in database
- Process a webhook without idempotency check
- Skip transaction wrapping for webhook processing

---

## Webhook Idempotency

### Zitadel (built)

`src/webhooks/zitadel.webhook.ts` — verifies `x-zitadel-signature` header, registered in an isolated Fastify scope with `fastify-raw-body`. Two-step idempotency: INSERT event into `zitadel_webhook_events`, then SELECT `processed` status. If `processed = true`, skip. If `processed = false` (crash recovery or new event), reprocess. Timestamp freshness check rejects events older than `WEBHOOK_TIMESTAMP_MAX_AGE_SECONDS` or >60s in the future. Out-of-order guard via `setWhere`/`WHERE` on `lastEventAt`. Webhook-specific rate limiting via Redis Lua script (key prefix `:wh:zitadel:`).

### tusd (built)

`src/webhooks/tusd.webhook.ts` — pre-create validates auth/submission/limits, post-finish creates file record idempotently (checks `storageKey` exists before insert). Registered in isolated Fastify scope at `/webhooks/tusd`. Auth: validates forwarded `Authorization` header via JWKS, resolves Zitadel `sub` → local user UUID via `resolveLocalUserId()`. Fails closed when auth cannot be verified.

### Stripe (built)

`src/webhooks/stripe.webhook.ts` — verifies `stripe-signature` header via `constructEvent()` (with configurable timestamp tolerance), registered in an isolated Fastify scope with `fastify-raw-body`. Two-step idempotency: INSERT event into `stripe_webhook_events`, then SELECT `processed` status. If `processed = true`, skip. If `processed = false` (crash recovery), reprocess. RLS org context set via `set_config('app.current_org', ...)` from Stripe session metadata (Zod-validated).

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

### S3 Cleanup Worker

- **Queue**: `s3-cleanup` — jobs enqueued from `gdprService.deleteUser()` after transaction commit
- **Flow**: Iterates storage keys, deletes from clean or quarantine bucket, logs audit event
- **Retries**: 5 attempts, exponential backoff from 60s, 30-day fail retention
- **Always active**: Not gated on `VIRUS_SCAN_ENABLED` — runs whenever GDPR deletion occurs

### Env Vars

| Variable             | Default     | Purpose                                     |
| -------------------- | ----------- | ------------------------------------------- |
| `CLAMAV_HOST`        | `localhost` | ClamAV daemon TCP host                      |
| `CLAMAV_PORT`        | `3310`      | ClamAV daemon TCP port                      |
| `VIRUS_SCAN_ENABLED` | `true`      | Enable/disable virus scans                  |
| `DEV_AUTH_BYPASS`    | `false`     | Allow unauthed requests in dev (no Zitadel) |

---

## Quirks

| Quirk                                            | Details                                                                                                                                                                                                                                                                                                                                                                                                         |
| ------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Zitadel webhook signatures**                   | Verify `x-zitadel-signature` header on all webhook payloads. Use shared secret from Zitadel Actions config                                                                                                                                                                                                                                                                                                      |
| **BullMQ Redis password**                        | Uses `REDIS_HOST`/`REDIS_PORT`/`REDIS_PASSWORD` (not `REDIS_URL`). Pass password in worker/queue config                                                                                                                                                                                                                                                                                                         |
| **tRPC TS2742 under NodeNext**                   | Resolved in tRPC v11. `declaration: true` now works in API tsconfig. Web app still resolves `AppRouter` via source path alias pointing to `src/trpc/client-types.ts` (bundler resolution). All web-facing type exports go through `client-types.ts`                                                                                                                                                             |
| **`@fastify/raw-body` doesn't exist**            | Official `@fastify/` scoped package not published on npm. Use `fastify-raw-body` (community package, v5.0.0 for Fastify 5)                                                                                                                                                                                                                                                                                      |
| **tusd v2 webhook payload format**               | tusd v2.8.0 sends `{ Type: "pre-create"\|"post-finish", Event: { Upload, HTTPRequest } }` instead of v1's `Hook-Name` header + `{ Upload, HTTPRequest }` body. Our handler supports both formats. The `Event` envelope is unwrapped before dispatch.                                                                                                                                                            |
| **Fastify 5 preHandler short-circuit**           | To stop request processing in a `preHandler` hook, you MUST `return reply.status(N).send(...)`. Using `void reply.send(); return;` does NOT work — Fastify still runs the handler, causing `ERR_HTTP_HEADERS_SENT` crash. This bit us in webhook rate limiters.                                                                                                                                                 |
| **oRPC OpenAPI needs Zod 4 converter**           | `OpenAPIReferencePlugin` requires explicit `schemaConverters: [new ZodToJsonSchemaConverter()]` from `@orpc/zod/zod4`. Without it, all schemas become `{}` and routes with path params throw 500. The default `@orpc/zod` export is Zod 3 only.                                                                                                                                                                 |
| **tRPC v11 no superjson**                        | `httpBatchLink` uses plain JSON — `Date` objects become ISO strings over the wire. Input schemas must use `z.coerce.date()` (not `z.date()`) for date fields sent from the client. Output schemas are unaffected since Drizzle returns real Date objects server-side.                                                                                                                                           |
| **`validateEnv()` must be lazy**                 | Call `validateEnv()` inside handler functions, NOT at module level. Module-level calls execute at import time, breaking any test that imports the router tree (9 test files failed when GDPR router used module-level `validateEnv()`). See `files.ts` for correct pattern.                                                                                                                                     |
| **tusd `-cors-allow-headers` replaces defaults** | When passing custom headers to tusd's `-cors-allow-headers` flag, you MUST include all standard tus protocol headers (`Authorization`, `Origin`, `Content-Type`, `Upload-Length`, `Upload-Offset`, `Tus-Resumable`, `Upload-Metadata`, `Upload-Defer-Length`) because the flag **replaces** the built-in defaults rather than appending. Missing tus headers causes CORS preflight failures for the tus client. |

## Version Pins

| Package | Pinned | Notes                                               |
| ------- | ------ | --------------------------------------------------- |
| Fastify | 5.x    | Major version; check plugin compat before upgrading |
| tRPC    | 11.x   | Internal only; upgraded from v10 with Zod 4         |
| Stripe  | 20.3   | —                                                   |
| BullMQ  | 5      | —                                                   |
