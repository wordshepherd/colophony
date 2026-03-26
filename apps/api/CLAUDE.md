# Colophony API — Fastify Backend

## Key Paths

| What               | Path                                                           |
| ------------------ | -------------------------------------------------------------- |
| App entry          | `src/main.ts`                                                  |
| Env config (Zod)   | `src/config/env.ts`                                            |
| Fastify hooks      | `src/hooks/`                                                   |
| Service layer      | `src/services/`                                                |
| Manuscript svc     | `src/services/manuscript.service.ts`                           |
| tRPC router        | `src/trpc/router.ts`                                           |
| tRPC client types  | `src/trpc/client-types.ts`                                     |
| tRPC init          | `src/trpc/init.ts`                                             |
| tRPC context       | `src/trpc/context.ts`                                          |
| REST router        | `src/rest/router.ts`                                           |
| REST context       | `src/rest/context.ts`                                          |
| REST error mapper  | `src/rest/error-mapper.ts`                                     |
| REST org handlers  | `src/rest/routers/organizations.ts`                            |
| Form service       | `src/services/form.service.ts`                                 |
| Form validation    | `src/services/form-validation.service.ts`                      |
| GDPR service       | `src/services/gdpr.service.ts`                                 |
| Embed routes       | `src/routes/embed.routes.ts`                                   |
| Embed token svc    | `src/services/embed-token.service.ts`                          |
| Embed submit svc   | `src/services/embed-submission.service.ts`                     |
| tusd webhook       | `src/webhooks/tusd.webhook.ts`                                 |
| Zitadel webhook    | `src/webhooks/zitadel.webhook.ts`                              |
| Stripe webhook     | `src/webhooks/stripe.webhook.ts`                               |
| Documenso webhook  | `src/webhooks/documenso.webhook.ts`                            |
| Inngest client     | `src/inngest/client.ts`                                        |
| Inngest functions  | `src/inngest/functions/`                                       |
| Inngest serve      | `src/inngest/serve.ts`                                         |
| Email adapters     | `src/adapters/email/` (SmtpEmailAdapter, SendGridEmailAdapter) |
| Storage adapter    | `src/adapters/storage/` (S3StorageAdapter)                     |
| Payment adapter    | `src/adapters/payment/` (StripePaymentAdapter)                 |
| Registry accessor  | `src/adapters/registry-accessor.ts`                            |
| Config builder     | `src/colophony.config.ts`                                      |
| Email templates    | `src/templates/email/` (MJML)                                  |
| Content converters | `src/converters/` (text, docx, smart-typography, barrel)       |
| Content queue      | `src/queues/content-extract.queue.ts`                          |
| Content worker     | `src/workers/content-extract.worker.ts`                        |
| Content svc        | `src/services/content-extraction.service.ts`                   |
| Email queue        | `src/queues/email.queue.ts`                                    |
| Email worker       | `src/workers/email.worker.ts`                                  |
| Email service      | `src/services/email.service.ts`                                |
| Notif pref svc     | `src/services/notification-preference.service.ts`              |
| Webhook queue      | `src/queues/webhook.queue.ts`                                  |
| Webhook worker     | `src/workers/webhook.worker.ts`                                |
| Webhook service    | `src/services/webhook.service.ts`                              |
| CMS adapters       | `src/adapters/cms/`                                            |
| Documenso adapter  | `src/adapters/documenso.adapter.ts`                            |
| Outbox poller      | `src/workers/outbox-poller.worker.ts`                          |
| SSE notif stream   | `src/sse/notification-stream.ts` (hijacked, manual CORS)       |
| Redis pub/sub      | `src/sse/redis-pubsub.ts`                                      |
| Federation trust   | `src/federation/trust.routes.ts` (S2S)                         |
| Trust admin        | `src/federation/trust-admin.routes.ts`                         |
| Key admin          | `src/federation/key-admin.routes.ts`                           |
| Trust service      | `src/services/trust.service.ts`                                |
| HTTP signatures    | `src/federation/http-signatures.ts`                            |
| Federation auth    | `src/federation/federation-auth.ts`                            |
| Sim-sub routes     | `src/federation/simsub.routes.ts` (S2S)                        |
| Sim-sub admin      | `src/federation/simsub-admin.routes.ts`                        |
| Sim-sub service    | `src/services/simsub.service.ts`                               |
| Fingerprint svc    | `src/services/fingerprint.service.ts`                          |
| Transfer routes    | `src/federation/transfer.routes.ts` (S2S)                      |
| Transfer admin     | `src/federation/transfer-admin.routes.ts`                      |
| Transfer service   | `src/services/transfer.service.ts`                             |
| Migration routes   | `src/federation/migration.routes.ts` (S2S)                     |
| Migration admin    | `src/federation/migration-admin.routes.ts`                     |
| Migration service  | `src/services/migration.service.ts`                            |
| Migration bundle   | `src/services/migration-bundle.service.ts`                     |
| Hub routes         | `src/federation/hub.routes.ts` (S2S)                           |
| Hub admin          | `src/federation/hub-admin.routes.ts`                           |
| Hub auth           | `src/federation/hub-auth.ts`                                   |
| Hub service        | `src/services/hub.service.ts`                                  |
| Hub client svc     | `src/services/hub-client.service.ts`                           |

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
- **Scopes:** Stored in `scopes` JSONB column. Enforced by `requireScopes` middleware on REST + tRPC surfaces. OIDC/test auth bypasses scope checks.
- **Lookup:** `verify_api_key()` SECURITY DEFINER function bypasses RLS for cross-org hash lookup.
- **`lastUsedAt`:** Updated fire-and-forget via `touch_api_key_last_used()` SECURITY DEFINER function.
- **CRUD:** tRPC router at `apiKeys.*`. Only ADMIN can create/revoke/delete. All org members can list.
- **Fail closed:** If the key creator is no longer an org member, the org-context hook rejects with 403.

User lifecycle events are synced from Zitadel to the local DB via webhooks.

---

## API Surfaces

| Surface  | Audience              | Status                                       | Auth               |
| -------- | --------------------- | -------------------------------------------- | ------------------ |
| **tRPC** | Internal web frontend | **Built**                                    | Zitadel OIDC token |
| **REST** | Public API, Zapier    | **Built** (oRPC + OpenAPI 3.1 at `/v1/docs`) | API key or OIDC    |

GraphQL (Pothos + Yoga) was built but extracted to feature branch `chore/extract-graphql-to-feature-branch` — re-merge when demand materializes.

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

`src/webhooks/zitadel.webhook.ts` — verifies `ZITADEL-Signature` header (timestamp-prefixed HMAC: `t=<ts>,v1=<hmac>`), registered in an isolated Fastify scope with `fastify-raw-body`. Uses Zitadel Actions v2 payload format (`event_type`, `created_at`, `aggregateID:sequence` for idempotency, `event_payload` for user data). Two-step idempotency: INSERT event into `zitadel_webhook_events`, then SELECT `processed` status. If `processed = true`, skip. If `processed = false` (crash recovery or new event), reprocess. Event type aliases map `user.human.*` to internal `user.*` names. Timestamp freshness check rejects events older than `WEBHOOK_TIMESTAMP_MAX_AGE_SECONDS` or >60s in the future. Out-of-order guard via `setWhere`/`WHERE` on `lastEventAt`. Webhook-specific rate limiting via Redis Lua script (key prefix `:wh:zitadel:`).

### tusd (built)

`src/webhooks/tusd.webhook.ts` — pre-create validates auth/submission/limits, post-finish creates file record idempotently (checks `storageKey` exists before insert). Registered in isolated Fastify scope at `/webhooks/tusd`. Auth: validates forwarded `Authorization` header via JWKS, resolves Zitadel `sub` → local user UUID via `resolveLocalUserId()`. Fails closed when auth cannot be verified.

### Stripe (built)

`src/webhooks/stripe.webhook.ts` — verifies `stripe-signature` header via `constructEvent()` (with configurable timestamp tolerance), registered in an isolated Fastify scope with `fastify-raw-body`. Two-step idempotency: INSERT event into `stripe_webhook_events`, then SELECT `processed` status. If `processed = true`, skip. If `processed = false` (crash recovery), reprocess. RLS org context set via `set_config('app.current_org', ...)` from Stripe session metadata (Zod-validated).

---

## SSRF Protection

Outbound HTTP calls to user-controlled URLs must validate against private IP ranges.

**Utility:** `src/lib/url-validation.ts` — `validateOutboundUrl(url, { devMode })`.

**Enforced at:** webhook endpoint creation/update, webhook delivery, federation metadata fetch.

**Dev mode:** `NODE_ENV === 'development' || 'test'` allows HTTP and private IPs.

**NEVER:**

- Call `fetch()` on a user-provided URL without SSRF validation
- Skip HTTPS enforcement in production
- Allow redirects to bypass SSRF checks

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
- **Chaining**: On CLEAN, enqueues `content-extract` job for supported MIME types (text/plain, docx)

### Content Extract Worker

- **Queue**: `content-extract` — jobs enqueued from file-scan worker (CLEAN) or tusd webhook (scan disabled)
- **Job idempotency**: `jobId: fileId` prevents duplicate extractions; also skips if version status is COMPLETE or EXTRACTING
- **Flow**: PENDING → EXTRACTING → COMPLETE/FAILED/UNSUPPORTED
- **Processing**: Download from S3 → format-specific converter (.txt or .docx) → smart typography pass → store ProseMirror JSON in `manuscript_versions.content`
- **Canonical source**: Only supported MIME types enqueued; first file to start extraction wins (multi-file race protection)
- **Defense-in-depth**: All service methods verify manuscript ownership via explicit JOIN
- **Retries**: 3 attempts, exponential backoff from 30s
- **Concurrency**: 3
- **Always active**: Not feature-gated

### Email Worker

- **Queue**: `email` — jobs enqueued from Inngest notification functions via `enqueueEmail()`
- **Job idempotency**: `jobId: emailSendId` prevents duplicate sends from duplicate events
- **Flow**: QUEUED → SENDING → SENT/FAILED (tracked in `email_sends` table)
- **Processing**: Render MJML template → send via adapter (SMTP/SendGrid) → update status + audit
- **Retries**: 5 attempts, exponential backoff from 30s
- **Concurrency**: 5
- **Feature flag**: `EMAIL_PROVIDER` (default `'none'`). Worker only starts when provider is configured (`smtp` or `sendgrid`)

### S3 Cleanup Worker

- **Queue**: `s3-cleanup` — jobs enqueued from `gdprService.deleteUser()` after transaction commit
- **Flow**: Iterates storage keys, deletes from clean or quarantine bucket, logs audit event
- **Retries**: 5 attempts, exponential backoff from 60s, 30-day fail retention
- **Always active**: Not gated on `VIRUS_SCAN_ENABLED` — runs whenever GDPR deletion occurs

### Webhook Worker

- **Queue**: `webhook` — jobs enqueued from `webhookDelivery` Inngest function via `enqueueWebhook()`
- **Job idempotency**: `jobId: deliveryId` prevents duplicate deliveries
- **Flow**: QUEUED → DELIVERING → DELIVERED/FAILED (tracked in `webhook_deliveries` table)
- **Processing**: Compute HMAC-SHA256 signature → HTTP POST with headers (`X-Webhook-Signature`, `X-Webhook-Id`, `User-Agent`) → update status + audit
- **Retries**: 8 attempts, custom backoff [1s, 5s, 30s, 2m, 10m, 1h, 1h, 1h]
- **Concurrency**: 10 (I/O-bound HTTP calls)
- **Timeout**: 30s per delivery (AbortController)
- **Auto-disable**: After 5 consecutive final failures for an endpoint, sets endpoint status to DISABLED
- **Always active**: No feature flag — harmless when no endpoints registered

---

## BullMQ / Inngest Boundary

**Ownership rule:** Inngest owns orchestration + notification logic. BullMQ owns final-mile delivery (I/O-bound side effects).

### Decision Criteria

| Job type             | System  | Why                                                          |
| -------------------- | ------- | ------------------------------------------------------------ |
| Multi-step workflows | Inngest | Built-in step functions, retries per step, DAG visualization |
| Notification fan-out | Inngest | Event-driven: one domain event → multiple notification types |
| Email send           | BullMQ  | Final-mile I/O, adapter-specific retries, concurrency limit  |
| Webhook delivery     | BullMQ  | Final-mile HTTP, custom backoff schedule, auto-disable logic |
| File virus scan      | BullMQ  | Final-mile I/O (ClamAV TCP), job-level idempotency by fileId |
| S3 cleanup (GDPR)    | BullMQ  | Final-mile S3 ops, long retention on failure                 |
| Outbox polling       | BullMQ  | Repeatable cron job, bridges transactional events → Inngest  |
| Transfer file fetch  | BullMQ  | Final-mile HTTP download from remote instance                |

### Inventory

- **BullMQ queues (7):** `email`, `webhook`, `file-scan`, `content-extract`, `s3-cleanup`, `outbox-poller`, `transfer-fetch`
- **Inngest functions (15):** 3 workflow (submission, pipeline, contract), 11 notification (per event type), 1 bridge (Documenso webhook → domain events)

### Glue Pattern

Inngest functions call `enqueue*()` helpers (e.g., `enqueueEmail()`, `enqueueWebhook()`) to dispatch BullMQ jobs. Fire-and-forget — Inngest does not wait for BullMQ job completion.

### Outbox Pattern

The outbox poller (`outbox-poller` BullMQ worker) is the default bridge for transactional domain events: service writes event to `domain_events` table inside the same DB transaction → poller picks up unprocessed events → sends to Inngest. **Exception:** Documenso webhook handler uses direct `inngest.send()` because the event source is already external (non-transactional, acceptable).

### NEVER

- Use BullMQ for multi-step workflows (no step-level retry, no DAG visibility)
- Use Inngest for final-mile I/O delivery (email, HTTP, S3, ClamAV) — Inngest steps are for orchestration logic, not adapter-specific I/O with custom concurrency/backoff
- Skip the outbox for domain events emitted inside DB transactions — direct `inngest.send()` outside a transaction risks event loss on crash

### Env Vars

| Variable                    | Default       | Purpose                                     |
| --------------------------- | ------------- | ------------------------------------------- |
| `CLAMAV_HOST`               | `localhost`   | ClamAV daemon TCP host                      |
| `CLAMAV_PORT`               | `3310`        | ClamAV daemon TCP port                      |
| `VIRUS_SCAN_ENABLED`        | `true`        | Enable/disable virus scans                  |
| `DEV_AUTH_BYPASS`           | `false`       | Allow unauthed requests in dev (no Zitadel) |
| `EMAIL_PROVIDER`            | `none`        | Email provider: `smtp`, `sendgrid`, `none`  |
| `SMTP_HOST`                 | —             | SMTP server hostname                        |
| `SMTP_PORT`                 | `587`         | SMTP server port                            |
| `SMTP_FROM`                 | —             | SMTP sender address                         |
| `SENDGRID_API_KEY`          | —             | SendGrid API key                            |
| `SENDGRID_FROM`             | —             | SendGrid sender address                     |
| `SENTRY_DSN`                | —             | Sentry DSN (enables error tracking)         |
| `SENTRY_ENVIRONMENT`        | `development` | Sentry environment label                    |
| `SENTRY_TRACES_SAMPLE_RATE` | `0`           | Sentry tracing sample rate (0-1)            |
| `SENTRY_RELEASE`            | —             | Sentry release tag                          |
| `METRICS_ENABLED`           | `false`       | Enable Prometheus `/metrics` endpoint       |

---

## Quirks

| Quirk                                            | Details                                                                                                                                                                                                                                                                                                                                                                                                         |
| ------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Zitadel webhook signatures**                   | Verify `ZITADEL-Signature` header (lowercased to `zitadel-signature` by Node.js) on all webhook payloads. Handler also accepts legacy `x-zitadel-signature` as fallback. Signing key is auto-generated when creating a Target via Zitadel API                                                                                                                                                                   |
| **BullMQ Redis password**                        | Uses `REDIS_HOST`/`REDIS_PORT`/`REDIS_PASSWORD` (not `REDIS_URL`). Pass password in worker/queue config                                                                                                                                                                                                                                                                                                         |
| **tRPC TS2742 under NodeNext**                   | Resolved in tRPC v11. `declaration: true` now works in API tsconfig. Web app still resolves `AppRouter` via source path alias pointing to `src/trpc/client-types.ts` (bundler resolution). All web-facing type exports go through `client-types.ts`                                                                                                                                                             |
| **`@fastify/raw-body` doesn't exist**            | Official `@fastify/` scoped package not published on npm. Use `fastify-raw-body` (community package, v5.0.0 for Fastify 5)                                                                                                                                                                                                                                                                                      |
| **tusd v2 webhook payload format**               | tusd v2.8.0 sends `{ Type: "pre-create"\|"post-finish", Event: { Upload, HTTPRequest } }` instead of v1's `Hook-Name` header + `{ Upload, HTTPRequest }` body. Our handler supports both formats. The `Event` envelope is unwrapped before dispatch.                                                                                                                                                            |
| **Fastify 5 preHandler short-circuit**           | To stop request processing in a `preHandler` hook, you MUST `return reply.status(N).send(...)`. Using `void reply.send(); return;` does NOT work — Fastify still runs the handler, causing `ERR_HTTP_HEADERS_SENT` crash. This bit us in webhook rate limiters.                                                                                                                                                 |
| **oRPC OpenAPI needs Zod 4 converter**           | `OpenAPIReferencePlugin` requires explicit `schemaConverters: [new ZodToJsonSchemaConverter()]` from `@orpc/zod/zod4`. Without it, all schemas become `{}` and routes with path params throw 500. The default `@orpc/zod` export is Zod 3 only.                                                                                                                                                                 |
| **tRPC v11 no superjson**                        | `httpBatchLink` uses plain JSON — `Date` objects become ISO strings over the wire. Input schemas must use `z.coerce.date()` (not `z.date()`) for date fields sent from the client. Output schemas are unaffected since Drizzle returns real Date objects server-side.                                                                                                                                           |
| **`validateEnv()` must be lazy**                 | Call `validateEnv()` inside handler functions, NOT at module level. Module-level calls execute at import time, breaking any test that imports the router tree (9 test files failed when GDPR router used module-level `validateEnv()`). See `files.ts` for correct pattern.                                                                                                                                     |
| **tusd `-cors-allow-headers` replaces defaults** | When passing custom headers to tusd's `-cors-allow-headers` flag, you MUST include all standard tus protocol headers (`Authorization`, `Origin`, `Content-Type`, `Upload-Length`, `Upload-Offset`, `Tus-Resumable`, `Upload-Metadata`, `Upload-Defer-Length`) because the flag **replaces** the built-in defaults rather than appending. Missing tus headers causes CORS preflight failures for the tus client. |
| **Fastify `maxParamLength` and tRPC batching**   | Fastify defaults `maxParamLength` to 100 characters. tRPC's `httpBatchLink` encodes comma-separated procedure names in the URL path (e.g., `/trpc/a.b,c.d,e.f`). Pages that batch many queries (like the analytics dashboard with ~8 procedures) produce paths exceeding 100 chars, causing Fastify to silently return 404. Set `maxParamLength: 500` in the Fastify constructor to accommodate large batches.  |
| **`reply.hijack()` bypasses `@fastify/cors`**    | `reply.hijack()` takes ownership of the raw Node.js response, preventing all Fastify hooks (including `@fastify/cors` `onSend` hook) from running. Any hijacked route (e.g., SSE streams) must manually include CORS headers in its `writeHead()` call. See `src/sse/notification-stream.ts` for the `buildCorsHeaders()` pattern.                                                                              |
| **Zitadel Actions v2 signature format**          | Zitadel v2 sends `ZITADEL-Signature: t=<timestamp>,v1=<hex-hmac>` where HMAC is computed over `<timestamp>.<body>` (not just body). Handler accepts both this format and legacy simple HMAC. Event types use `user.human.*` naming (mapped to internal `user.*` via alias table in `zitadel.webhook.ts`).                                                                                                       |

## Version Pins

| Package | Pinned | Notes                                               |
| ------- | ------ | --------------------------------------------------- |
| Fastify | 5.x    | Major version; check plugin compat before upgrading |
| tRPC    | 11.x   | Internal only; upgraded from v10 with Zod 4         |
| Stripe  | 20.4   | —                                                   |
| BullMQ  | 5      | —                                                   |
