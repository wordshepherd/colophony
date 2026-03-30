# Colophony API — Fastify Backend

## Key Paths

| What               | Path                                                                                                  |
| ------------------ | ----------------------------------------------------------------------------------------------------- |
| App entry          | `src/main.ts`                                                                                         |
| Env config (Zod)   | `src/config/env.ts`                                                                                   |
| Fastify hooks      | `src/hooks/`                                                                                          |
| Service layer      | `src/services/`                                                                                       |
| tRPC               | `src/trpc/` (router, init, context, client-types)                                                     |
| REST (oRPC)        | `src/rest/` (router, context, error-mapper, routers/)                                                 |
| Webhooks           | `src/webhooks/` (zitadel, stripe, tusd, documenso)                                                    |
| Inngest            | `src/inngest/` (client, serve, functions/)                                                            |
| Adapters           | `src/adapters/` (email/, storage/, payment/, cms/, registry-accessor, documenso)                      |
| Config builder     | `src/colophony.config.ts`                                                                             |
| Email templates    | `src/templates/email/` (MJML)                                                                         |
| Content converters | `src/converters/` (text, docx, smart-typography)                                                      |
| Queues             | `src/queues/` (email, webhook, file-scan, content-extract, s3-cleanup, outbox-poller, transfer-fetch) |
| Workers            | `src/workers/` (matching queue names)                                                                 |
| SSE notifications  | `src/sse/` (notification-stream, redis-pubsub)                                                        |
| Federation         | `src/federation/` (trust, simsub, transfer, migration, hub — each has S2S routes + admin routes)      |
| Embed routes       | `src/routes/embed.routes.ts`                                                                          |
| SSRF validation    | `src/lib/url-validation.ts`                                                                           |

Full file index: [docs/file-index.md](../../docs/file-index.md)

### Service Method Naming

| Suffix       | Meaning                                                  |
| ------------ | -------------------------------------------------------- |
| `WithAccess` | Checks owner-or-editor access via `ServiceContext.actor` |
| `AsOwner`    | Checks ownership (submitterId === actor.userId) + audits |
| `WithAudit`  | Wraps a mutation with audit logging                      |

Pure data methods keep `(tx, ...)` signatures for worker/internal use. Access-aware methods accept `ServiceContext` and throw `ForbiddenError`/`NotFoundError` — callers use `mapServiceError()` to translate.

---

## Hook Registration Order (from `main.ts`)

```
rateLimit (IP) → auth → rateLimitAuth (user) → orgContext → dbContext → audit
```

| Hook                  | Decorates                        | Purpose                                           |
| --------------------- | -------------------------------- | ------------------------------------------------- |
| `rateLimitPlugin`     | `app.rateLimitRedis`             | IP-based rate limiting (before auth — DoS shield) |
| `rateLimitAuthPlugin` | —                                | User-based rate limiting (after auth)             |
| `authPlugin`          | `request.authContext`            | Validates OIDC token or X-Api-Key                 |
| `orgContextPlugin`    | `request.authContext.orgId/role` | Resolves `X-Organization-Id`, checks membership   |
| `dbContextPlugin`     | `request.dbTx`                   | Opens RLS transaction via `SET LOCAL`             |
| `auditPlugin`         | `request.audit`                  | Provides `audit(action, details)` helper          |

**RLS runtime contract:** `dbContext` hook calls `SET LOCAL` to set `app.current_org` and `app.user_id` inside a per-request transaction. RLS policy definitions are in `packages/db/CLAUDE.md`.

---

## Authentication

Dual auth: Zitadel OIDC tokens for interactive users, API keys for programmatic access.

**Default-deny:** Auth hook rejects all requests to non-public routes without valid `Authorization` or `X-Api-Key` (401). Public routes allowlisted in `auth.ts` via `PUBLIC_EXACT`/`PUBLIC_PREFIXES`. Defense-in-depth — even `publicProcedure` requires explicit allowlisting at hook layer.

**Precedence:** Bearer (OIDC) checked first, `X-Api-Key` fallback. Dev bypass: `DEV_AUTH_BYPASS=true` (never in production).

### API Key Authentication

- **Format:** `col_live_<32 hex chars>` — SHA-256 hash stored, plain text shown once
- **Org-scoped:** Uses creator's `userId` for audit/RLS, pre-sets `orgId`
- **Scopes:** JSONB column, enforced by `requireScopes` middleware (OIDC bypasses)
- **Lookup:** `verify_api_key()` SECURITY DEFINER bypasses RLS for cross-org hash lookup
- **CRUD:** tRPC `apiKeys.*`. ADMIN only for create/revoke/delete. Fail closed if creator leaves org.

---

## API Surfaces

| Surface  | Audience                                              | Auth               |
| -------- | ----------------------------------------------------- | ------------------ |
| **tRPC** | Internal web frontend                                 | Zitadel OIDC token |
| **REST** | Public API, Zapier (oRPC + OpenAPI 3.1 at `/v1/docs`) | API key or OIDC    |

GraphQL extracted to feature branch — re-merge when demand materializes. All surfaces share service layer and `@colophony/types` Zod schemas.

---

## tRPC Procedure Builders (`src/trpc/init.ts`)

| Builder                | Guarantees                                    |
| ---------------------- | --------------------------------------------- |
| `publicProcedure`      | No auth                                       |
| `authedProcedure`      | `ctx.authContext` non-null                    |
| `orgProcedure`         | `orgId/roles` + `dbTx` set                    |
| `userProcedure`        | `authContext` + `dbTx` (no org)               |
| `editorProcedure`      | `orgProcedure` + EDITOR or ADMIN              |
| `productionProcedure`  | `orgProcedure` + PRODUCTION, EDITOR, or ADMIN |
| `businessOpsProcedure` | `orgProcedure` + BUSINESS_OPS or ADMIN        |
| `adminProcedure`       | `orgProcedure` + ADMIN                        |

---

## Payments (Stripe Checkout)

Stripe Checkout only (zero PCI scope). Handler: `src/webhooks/stripe.webhook.ts`.

**NEVER:** Log card numbers/CVV, store card data, skip idempotency check, skip transaction wrapping.

---

## Webhook Idempotency

All webhook handlers use two-step idempotency: INSERT event → check `processed` status → skip if true, (re)process if false.

- **Zitadel:** Verifies `ZITADEL-Signature` (`t=<ts>,v1=<hmac>` over `<ts>.<body>`). Actions v2 format: `event_type`/`created_at`/`event_payload`. Idempotency key: `aggregateID:sequence`. Timestamp freshness + out-of-order guard. Rate limited via Redis Lua.
- **tusd:** Pre-create validates auth/submission/limits. Post-finish creates file record idempotently (checks `storageKey`). Auth via forwarded Bearer → JWKS → `resolveLocalUserId()`.
- **Stripe:** Verifies `stripe-signature` via `constructEvent()`. Org context from session metadata. Idempotency via `stripe_webhook_events` table.

---

## SSRF Protection

`src/lib/url-validation.ts` — `validateOutboundUrl(url, { devMode })`. Enforced at webhook endpoint CRUD, delivery, and federation metadata fetch. Dev mode allows HTTP/private IPs.

**NEVER:** `fetch()` user URL without SSRF validation, skip HTTPS in production, allow redirects to bypass checks.

---

## BullMQ Workers

### Pattern

- **Queues**: `src/queues/<name>.queue.ts` — singleton, `enqueue*()` helper, `close*()` for shutdown
- **Workers**: `src/workers/<name>.worker.ts` — `start*Worker(env)` / `stop*Worker()` lifecycle
- **Shutdown**: Close workers before queues (in `main.ts` graceful shutdown)

### RLS in Workers

Workers have no HTTP context. Use `withRls({ orgId })` per logical phase. S3 ops happen outside `withRls`.

```typescript
await withRls({ orgId: job.data.organizationId }, async (tx) => {
  await fileService.updateScanStatus(tx, fileId, 'SCANNING');
});
// S3/external ops (no RLS needed)
await withRls({ orgId: job.data.organizationId }, async (tx) => {
  await fileService.updateScanStatus(tx, fileId, 'CLEAN');
  await auditService.log(tx, { ... });
});
```

### Worker Inventory

| Worker          | Queue             | Idempotency                    | Flow                                   | Retries            | Concurrency | Gate                 |
| --------------- | ----------------- | ------------------------------ | -------------------------------------- | ------------------ | ----------- | -------------------- |
| File scan       | `file-scan`       | `jobId: fileId`                | PENDING→SCANNING→CLEAN/INFECTED/FAILED | 3, exp backoff     | —           | `VIRUS_SCAN_ENABLED` |
| Content extract | `content-extract` | `jobId: fileId` + status check | PENDING→EXTRACTING→COMPLETE/FAILED     | 3, exp 30s         | 3           | always               |
| Email           | `email`           | `jobId: emailSendId`           | QUEUED→SENDING→SENT/FAILED             | 5, exp 30s         | 5           | `EMAIL_PROVIDER`     |
| S3 cleanup      | `s3-cleanup`      | —                              | iterate keys → delete → audit          | 5, exp 60s         | —           | always               |
| Webhook         | `webhook`         | `jobId: deliveryId`            | QUEUED→DELIVERING→DELIVERED/FAILED     | 8, custom [1s..1h] | 10          | always               |
| Outbox poller   | `outbox-poller`   | —                              | poll `domain_events` → Inngest         | repeatable cron    | —           | always               |
| Transfer fetch  | `transfer-fetch`  | —                              | HTTP download from remote              | —                  | —           | always               |

File scan chains to content-extract on CLEAN. Webhook auto-disables endpoint after 5 consecutive failures.

---

## BullMQ / Inngest Boundary

**Rule:** Inngest owns orchestration + notification logic. BullMQ owns final-mile delivery (I/O-bound side effects).

- **Inngest:** Multi-step workflows, notification fan-out (3 workflow + 11 notification + 1 bridge = 15 functions)
- **BullMQ:** Email send, webhook delivery, file scan, S3 cleanup, outbox polling, transfer fetch (7 queues)
- **Glue:** Inngest calls `enqueue*()` helpers. Fire-and-forget.
- **Outbox:** Service writes to `domain_events` in same DB tx → poller → Inngest. Exception: Documenso webhook uses direct `inngest.send()` (already external).

**NEVER:** BullMQ for multi-step workflows. Inngest for final-mile I/O. Direct `inngest.send()` inside DB transactions.

---

## Quirks

| Quirk                                            | Details                                                                                              |
| ------------------------------------------------ | ---------------------------------------------------------------------------------------------------- |
| **Zitadel webhook signatures**                   | Header lowercased to `zitadel-signature` by Node.js. Also accepts legacy `x-zitadel-signature`       |
| **BullMQ Redis password**                        | Uses `REDIS_HOST`/`REDIS_PORT`/`REDIS_PASSWORD` (not `REDIS_URL`)                                    |
| **tRPC TS2742**                                  | Resolved in v11. Web resolves `AppRouter` via source path alias → `client-types.ts`                  |
| **`@fastify/raw-body` doesn't exist**            | Use `fastify-raw-body` (community, v5.0.0 for Fastify 5)                                             |
| **tusd v2 webhook format**                       | Sends `{ Type, Event: { Upload, HTTPRequest } }`. Handler supports both v1/v2                        |
| **Fastify 5 preHandler short-circuit**           | MUST `return reply.status(N).send(...)`. `void reply.send(); return;` causes `ERR_HTTP_HEADERS_SENT` |
| **oRPC needs Zod 4 converter**                   | `OpenAPIReferencePlugin` requires `ZodToJsonSchemaConverter` from `@orpc/zod/zod4`                   |
| **tRPC v11 no superjson**                        | Dates become ISO strings. Use `z.coerce.date()` for input schemas                                    |
| **`validateEnv()` must be lazy**                 | Call inside handlers, not at module level (breaks test imports)                                      |
| **tusd `-cors-allow-headers` replaces defaults** | Must include all standard tus protocol headers (flag replaces, not appends)                          |
| **Fastify `maxParamLength` + tRPC batching**     | Default 100 chars too short for batched tRPC paths. Set `maxParamLength: 500`                        |
| **`reply.hijack()` bypasses `@fastify/cors`**    | Hijacked routes must manually set CORS headers. See `notification-stream.ts`                         |

## Version Pins

| Package | Pinned | Notes                                                        |
| ------- | ------ | ------------------------------------------------------------ |
| Fastify | 5.x    | Check plugin compat before upgrading                         |
| tRPC    | 11.x   | Internal only; upgraded from v10 with Zod 4                  |
| Stripe  | 21.0   | Upgraded from 20.4; decimal_string→Stripe.Decimal (not used) |
| BullMQ  | 5      | —                                                            |
