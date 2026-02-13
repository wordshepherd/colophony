# Colophony API — Fastify Backend

## Key Paths

| What             | Path                              |
| ---------------- | --------------------------------- |
| App entry        | `src/main.ts`                     |
| Env config (Zod) | `src/config/env.ts`               |
| Fastify hooks    | `src/hooks/`                      |
| Service layer    | `src/services/`                   |
| tRPC router      | `src/trpc/router.ts`              |
| tRPC init        | `src/trpc/init.ts`                |
| tRPC context     | `src/trpc/context.ts`             |
| Zitadel webhook  | `src/webhooks/zitadel.webhook.ts` |

---

## Hook Registration Order (from `main.ts`)

```
auth → rateLimit → orgContext → dbContext → audit
```

Each hook decorates the Fastify request:

| Hook               | Decorates                        | Purpose                                                     |
| ------------------ | -------------------------------- | ----------------------------------------------------------- |
| `authPlugin`       | `request.authContext`            | Validates Zitadel OIDC token, extracts user identity        |
| `rateLimitPlugin`  | —                                | Redis-based sliding window rate limiting                    |
| `orgContextPlugin` | `request.authContext.orgId/role` | Resolves `X-Organization-Id` header, checks membership      |
| `dbContextPlugin`  | `request.dbTx`                   | Opens RLS transaction via `SET LOCAL` with org/user context |
| `auditPlugin`      | `request.audit`                  | Provides `audit(action, details)` helper for logging        |

**RLS runtime contract:** `dbContext` hook calls `SET LOCAL` to set `app.current_org` and `app.user_id` inside a per-request transaction. RLS policy definitions are in `packages/db/CLAUDE.md`.

---

## Authentication (Zitadel OIDC)

Zitadel handles all authentication: login, signup, MFA, session management, token issuance. The API validates Zitadel-issued tokens via the `auth` hook (`onRequest`).

- **Interactive users:** Zitadel OIDC tokens (access + refresh)
- **API consumers:** API keys (planned — stored in DB, scoped per org)

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

### Stripe (planned)

When built: check processed status in `stripe_webhook_events` table before handling. Use database transaction. Record event ID after processing.

---

## Quirks

| Quirk                                 | Details                                                                                                                                                                                                                   |
| ------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Zitadel webhook signatures**        | Verify `x-zitadel-signature` header on all webhook payloads. Use shared secret from Zitadel Actions config                                                                                                                |
| **BullMQ Redis password**             | Uses `REDIS_HOST`/`REDIS_PORT`/`REDIS_PASSWORD` (not `REDIS_URL`). Pass password in worker/queue config                                                                                                                   |
| **tRPC TS2742 under NodeNext**        | `typeof appRouter` can't be named without internal `@trpc/server/dist/core/router` reference. Workaround: `declaration: false` in API tsconfig. Web app resolves `AppRouter` via source path aliases (bundler resolution) |
| **`@fastify/raw-body` doesn't exist** | Official `@fastify/` scoped package not published on npm. Use `fastify-raw-body` (community package, v5.0.0 for Fastify 5)                                                                                                |

## Version Pins

| Package | Pinned | Notes                                               |
| ------- | ------ | --------------------------------------------------- |
| Fastify | 5.x    | Major version; check plugin compat before upgrading |
| tRPC    | 10.45  | Internal only; Zod error behavior specific to v10   |
| Stripe  | 20.3   | —                                                   |
| BullMQ  | 5      | —                                                   |
