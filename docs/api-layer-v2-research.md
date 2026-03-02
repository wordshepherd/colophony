# Colophony — API Layer Architecture Research

Research document covering the design of a multi-surface API layer (REST + GraphQL + tRPC) for Colophony. This document evaluates tooling, proposes architecture, and provides concrete recommendations.

**Last updated:** 2026-02-11
**Status:** Research / RFC — Updated for Fastify + Drizzle decisions

> **Revision Note (2026-02-11):** This document was originally researched assuming NestJS and Prisma. Following architecture decisions in `docs/architecture.md`, the chosen stack is **Fastify 5** (replacing NestJS) and **Drizzle ORM** (replacing Prisma). All code examples, diagrams, and recommendations have been updated accordingly. Evaluation tables retain the original comparisons for reference but "NestJS Compat" and "Prisma Integration" columns are no longer selection criteria.

---

## Table of Contents

1. [Executive Summary](#executive-summary)
2. [Current Architecture](#current-architecture)
3. [Target Architecture](#target-architecture)
4. [GraphQL Approach: Schema-First vs Code-First](#1-graphql-approach-schema-first-vs-code-first)
5. [OpenAPI Generation for REST](#2-openapi-generation-for-rest)
6. [Shared Validation Across API Surfaces](#3-shared-validation-across-api-surfaces)
7. [Rate Limiting and Auth Across Multiple Surfaces](#4-rate-limiting-and-auth-across-multiple-surfaces)
8. [API Versioning Strategy](#5-api-versioning-strategy)
9. [SDK Generation for Multiple Languages](#6-sdk-generation-for-multiple-languages)
10. [How Successful Platforms Structure Their APIs](#7-how-successful-platforms-structure-their-apis)
11. [Proposed Architecture](#proposed-architecture)
12. [Migration Path from v1](#migration-path-from-v1)
13. [Decision Log](#decision-log)

---

## Executive Summary

Colophony v2 needs three API surfaces:

| Surface     | Audience                     | Purpose                                            |
| ----------- | ---------------------------- | -------------------------------------------------- |
| **tRPC**    | Internal web frontend        | Type-safe, fast iteration, stays as-is from MVP    |
| **REST**    | Public API, webhooks, Zapier | Widest compatibility, primary public API           |
| **GraphQL** | Power users, Chill Subs      | Flexible queries, potential aggregator integration |

**Key recommendations:**

- **GraphQL:** Code-first with **Pothos** (Zod validation via StandardSchema, manual Drizzle type mappings + dataloader)
- **REST:** Contract-first with **ts-rest** using shared Zod schemas, generating OpenAPI 3.1
- **Shared validation:** Zod schemas in `@colophony/types` remain the single source of truth
- **Rate limiting:** Unified Fastify hook layer, cost-based for GraphQL
- **Versioning:** URL-path for REST (`/v1/`), schema evolution for GraphQL, no versioning for tRPC
- **SDK generation:** **Speakeasy** for REST SDKs (TypeScript, Python), **graphql-codegen** for GraphQL

---

## Current Architecture (v1 — Being Replaced)

The MVP has a single API surface (tRPC) serving the Next.js frontend. v2 replaces NestJS with Fastify and Prisma with Drizzle (see `docs/architecture.md` sections 5.1 and 5.2).

```
                     ┌──────────────┐
   Browser --------->│   Next.js    │
                     │  (tRPC client│
                     │   + React)   │
                     └──────┬───────┘
                            │ tRPC (HTTP batch)
                            │ Authorization + x-organization-id headers
                            v
                     ┌──────────────┐
                     │   NestJS     │
                     │  TrpcController
                     │  ├─ auth     │
                     │  ├─ submissions
                     │  ├─ files    │
                     │  ├─ payments │
                     │  ├─ gdpr     │
                     │  ├─ consent  │
                     │  ├─ audit    │
                     │  └─ retention│
                     └──────┬───────┘
                            │
                     ┌──────┴───────┐
                     │   Prisma     │
                     │  + RLS via   │
                     │ withOrgContext│
                     └──────────────┘
```

**Key assets that carry forward:**

- `@colophony/types` — 8 Zod schema files (auth, submission, file, payment, common, user, organization)
- `@colophony/db` — Prisma client + `withOrgContext` RLS pattern
- `RateLimitService` + `RateLimitGuard` — Redis sliding window rate limiter
- `AuditService` — 15+ action types with structured logging
- tRPC middleware chain: `publicProcedure -> authedProcedure -> orgProcedure -> orgAdminProcedure`

---

## Target Architecture

```
                              ┌──────────────────────────────────┐
                              │          API Consumers           │
                              └───┬──────────┬──────────┬────────┘
                                  │          │          │
                          tRPC    │   REST   │  GraphQL │
                        (internal)│ (public) │ (power)  │
                                  │          │          │
                              ┌───▼──────────▼──────────▼────────┐
                              │       Fastify Application        │
                              │                                  │
                              │  ┌──────────────────────────┐    │
                              │  │   Unified Auth Hook       │    │
                              │  │   (Zitadel / API Key)     │    │
                              │  └─────────────┬────────────┘    │
                              │                │                 │
                              │  ┌─────────────▼────────────┐    │
                              │  │  Unified Rate Limiter    │    │
                              │  │  (IP + API Key + Cost)   │    │
                              │  └─────────────┬────────────┘    │
                              │                │                 │
                              │  ┌─────┬───────┴──────┬──────┐   │
                              │  │     │              │      │   │
                              │  │ tRPC│  REST        │GraphQL│  │
                              │  │plugin│ routes      │ route │  │
                              │  │     │(@ts-rest/    │(Yoga  │  │
                              │  │     │ fastify)     │+Pothos│  │
                              │  └──┬──┴──────┬───────┴──┬───┘   │
                              │     │         │          │       │
                              │  ┌──▼─────────▼──────────▼───┐   │
                              │  │     Service Layer          │   │
                              │  │  (plain classes / functions)│  │
                              │  │                            │   │
                              │  │  AuthService               │   │
                              │  │  SubmissionsService        │   │
                              │  │  StorageService             │  │
                              │  │  PaymentsService            │  │
                              │  │  AuditService               │  │
                              │  │  GdprService                │  │
                              │  └──────────────┬─────────────┘   │
                              │                 │                 │
                              │  ┌──────────────▼─────────────┐   │
                              │  │   @colophony/db             │  │
                              │  │   Drizzle + RLS (pgPolicy)  │  │
                              │  └─────────────────────────────┘  │
                              │                                  │
                              │  ┌─────────────────────────────┐  │
                              │  │   @colophony/types           │ │
                              │  │   Zod schemas (source of     │ │
                              │  │   truth for all surfaces)    │ │
                              │  └─────────────────────────────┘  │
                              └──────────────────────────────────┘
```

The critical architectural insight: **all three API surfaces share the same service layer and Zod schemas.** The API surface is just a thin adapter over shared business logic.

---

## 1. GraphQL Approach: Schema-First vs Code-First

### Evaluation Matrix

| Framework         | Approach   | Prisma Integration     | Zod Support             | NestJS Compat     | Maturity           | Recommendation              |
| ----------------- | ---------- | ---------------------- | ----------------------- | ----------------- | ------------------ | --------------------------- |
| **Pothos**        | Code-first | First-class plugin     | Plugin + StandardSchema | Via adapter       | Stable (v4)        | **RECOMMENDED**             |
| **TypeGraphQL**   | Code-first | Via typegraphql-prisma | Manual                  | Good (decorators) | Stable             | Good alternative            |
| **Nexus**         | Code-first | nexus-prisma           | Manual                  | Manual            | Low activity       | Avoid                       |
| **Apollo Server** | Either     | Manual                 | Manual                  | @nestjs/graphql   | Very stable        | Too heavy for this use case |
| **GraphQL Yoga**  | Either     | Manual                 | Via envelop             | Via adapter       | Stable (The Guild) | Pair with Pothos            |

### Recommendation: Pothos (Code-First) + GraphQL Yoga

**Why Pothos:**

1. **Type inference without codegen.** Pothos leverages TypeScript's type system directly. You define a type once and the GraphQL schema types are inferred. No `graphql-codegen` step needed on the server.

2. **Zod validation via StandardSchema.** Pothos supports `StandardSchemaV1`-compatible validators (Zod, Valibot, ArkType). Since `@colophony/types` already exports Zod schemas, they plug in directly for argument validation. This is the primary reason Pothos remains the recommendation despite the loss of the Prisma plugin (see note below).

3. **Plugin ecosystem.** Pothos has plugins for Relay-style pagination (cursor-based), error handling, scope-based authorization, and dataloader integration — all patterns Colophony needs.

4. **Works with GraphQL Yoga.** GraphQL Yoga (from The Guild) is lightweight, spec-compliant, and integrates directly with Fastify via `handleNodeRequest`.

> **Drizzle Note:** The original evaluation scored Pothos 39/50 partly due to the `@pothos/plugin-prisma` (auto-mapping Prisma models to GraphQL types, auto-resolving relations, solving N+1 via dataloader). With the Drizzle decision, **no equivalent plugin exists.** Revised score: ~29/50. Pothos is still recommended because the Zod single-source-of-truth validation is more valuable than the ORM integration. However, this means **manual type definitions, manual dataloader setup, and manual cursor pagination** for every model. See `docs/architecture.md` section 5.5 for detailed code patterns and the Month 3 evaluation checkpoint.

**Why not schema-first:**

- Schema-first (SDL) requires maintaining `.graphql` files separately from implementation, creating drift risk.
- With Zod schemas already defining the domain model, code-first avoids a third representation of the same data.
- Colophony's schema is domain-specific (submissions, workflows, payments) — not a generic data layer where SDL governance matters.

**Example: Pothos type with manual Drizzle mapping + dataloader:**

```typescript
// packages/api-graphql/src/types/submission.type.ts
import { builder } from "../builder";
import { submissionStatusSchema } from "@colophony/types";

// Manual type definition — no Prisma plugin, each field explicitly mapped
export const SubmissionType = builder.objectType("Submission", {
  fields: (t) => ({
    id: t.exposeID("id"),
    title: t.exposeString("title"),
    content: t.exposeString("content", { nullable: true }),
    coverLetter: t.exposeString("coverLetter", { nullable: true }),
    status: t.exposeString("status"),
    submittedAt: t.expose("submittedAt", { type: "DateTime", nullable: true }),
    createdAt: t.expose("createdAt", { type: "DateTime" }),

    // Relations loaded via dataloader (must be set up manually)
    submitter: t.field({
      type: UserType,
      resolve: (submission, _args, ctx) =>
        ctx.loaders.userById.load(submission.submitterId),
    }),
    files: t.field({
      type: [FileType],
      resolve: (submission, _args, ctx) =>
        ctx.loaders.submissionFiles.load(submission.id),
    }),

    // Computed field via dataloader
    fileCount: t.int({
      resolve: async (submission, _args, ctx) => {
        const files = await ctx.loaders.submissionFiles.load(submission.id);
        return files.length;
      },
    }),
  }),
});

// Mutation using Zod for input validation
builder.mutationField("createSubmission", (t) =>
  t.field({
    type: SubmissionType,
    args: {
      input: t.arg({ type: CreateSubmissionInput, required: true }),
    },
    // Zod validation runs before resolver via validation plugin
    validate: { schema: createSubmissionSchema },
    resolve: async (_root, args, ctx) => {
      // Calls shared service layer (same code as tRPC and REST)
      return ctx.services.submissions.create(ctx.org, ctx.user, args.input);
    },
  }),
);
```

### GraphQL Server Setup with Fastify

```typescript
// apps/api/src/graphql/setup.ts
import { createYoga } from "graphql-yoga";
import { schema } from "./schema";
import { createGraphQLContext } from "./context";
import { createLoaders } from "./loaders";
import type { FastifyInstance } from "fastify";

export function registerGraphQL(app: FastifyInstance) {
  const yoga = createYoga({
    schema,
    context: ({ req }) => ({
      ...createGraphQLContext(req),
      loaders: createLoaders(req.db),
    }),
  });

  app.route({
    url: "/graphql",
    method: ["GET", "POST", "OPTIONS"],
    handler: async (req, reply) => {
      const response = await yoga.handleNodeRequest(req, { req, reply });
      response.headers.forEach((value, key) => reply.header(key, value));
      reply.status(response.status);
      reply.send(response.body);
    },
  });
}
```

---

## 2. OpenAPI Generation for REST

### Evaluation Matrix

| Tool                   | Approach       | Zod Native | Fastify Compat     | OpenAPI Version | Standalone | Recommendation  |
| ---------------------- | -------------- | ---------- | ------------------ | --------------- | ---------- | --------------- |
| **ts-rest**            | Contract-first | Yes        | `@ts-rest/fastify` | 3.1             | Yes        | **RECOMMENDED** |
| **Hono + zod-openapi** | Middleware     | Yes        | Separate           | 3.1             | Yes        | Alternative     |
| **tsoa**               | Decorator      | No         | Separate           | 3.0             | Yes        | Not a fit       |
| **zod-to-openapi**     | Standalone     | Yes        | Manual             | 3.1             | Yes        | Building block  |
| **trpc-openapi**       | tRPC adapter   | Yes        | Via tRPC           | 3.0             | No         | Fragile         |
| **oRPC**               | Built-in       | Yes        | No                 | 3.1             | Yes        | Future option   |

### Recommendation: ts-rest (Contract-First)

**Why ts-rest:**

1. **Contracts defined with Zod.** ts-rest contracts use Zod schemas for request/response validation. Since `@colophony/types` already has comprehensive Zod schemas, the contract layer is thin.

2. **OpenAPI 3.1 generation.** ts-rest generates a complete OpenAPI 3.1 spec from the contract — no manual YAML maintenance. The spec drives SDK generation, documentation, and testing.

3. **True REST semantics.** Unlike trpc-openapi (which maps RPC procedures to REST awkwardly), ts-rest designs REST-native endpoints with proper HTTP methods, status codes, and resource URLs.

4. **Fastify integration.** ts-rest has a `@ts-rest/fastify` adapter that creates Fastify routes from contracts, with full Zod validation and type-safe request/response handling.

5. **Type-safe client too.** ts-rest generates a typed client (like tRPC), useful for server-to-server calls and testing.

**Why not trpc-openapi:**

- trpc-openapi (and trpc-openapi-2) map tRPC procedures to REST endpoints, but the mapping is lossy. tRPC procedures don't naturally express HTTP semantics (PUT vs PATCH, proper status codes, nested resources).
- The original trpc-openapi is poorly maintained. trpc-openapi-2 is newer but thin on features.
- Mixing public API concerns into tRPC procedures bloats the internal API.

**Example: ts-rest contract using shared Zod schemas:**

```typescript
// packages/api-contracts/src/submissions.contract.ts
import { initContract } from "@ts-rest/core";
import { z } from "zod";
import {
  createSubmissionSchema,
  updateSubmissionSchema,
  listSubmissionsSchema,
  submissionSchema,
  submissionStatusSchema,
  paginatedResponseSchema,
} from "@colophony/types";

const c = initContract();

export const submissionsContract = c.router({
  listSubmissions: {
    method: "GET",
    path: "/v1/submissions",
    query: listSubmissionsSchema,
    responses: {
      200: paginatedResponseSchema(submissionSchema),
    },
    summary: "List submissions",
    description:
      "Returns paginated submissions for the authenticated organization.",
  },

  getSubmission: {
    method: "GET",
    path: "/v1/submissions/:id",
    pathParams: z.object({ id: z.string().uuid() }),
    responses: {
      200: submissionSchema,
      404: z.object({ message: z.string() }),
    },
    summary: "Get a submission by ID",
  },

  createSubmission: {
    method: "POST",
    path: "/v1/submissions",
    body: createSubmissionSchema,
    responses: {
      201: submissionSchema,
      400: z.object({ message: z.string() }),
    },
    summary: "Create a new submission",
  },

  updateSubmission: {
    method: "PATCH",
    path: "/v1/submissions/:id",
    pathParams: z.object({ id: z.string().uuid() }),
    body: updateSubmissionSchema,
    responses: {
      200: submissionSchema,
      404: z.object({ message: z.string() }),
    },
    summary: "Update a submission",
  },

  updateSubmissionStatus: {
    method: "POST",
    path: "/v1/submissions/:id/status",
    pathParams: z.object({ id: z.string().uuid() }),
    body: z.object({
      status: submissionStatusSchema,
      comment: z.string().max(1000).optional(),
    }),
    responses: {
      200: submissionSchema,
      400: z.object({ message: z.string() }),
    },
    summary: "Transition submission status",
  },
});
```

**Fastify route implementation:**

```typescript
// apps/api/src/rest/submissions.routes.ts
import { initServer } from "@ts-rest/fastify";
import { submissionsContract } from "@colophony/api-contracts";
import { submissionsService } from "../services/submissions.service";

const s = initServer();

export const submissionsRouter = s.router(submissionsContract, {
  listSubmissions: async ({ query, request }) => {
    const result = await submissionsService.list(
      request.org,
      request.user,
      query,
    );
    return { status: 200, body: result };
  },

  getSubmission: async ({ params, request }) => {
    const submission = await submissionsService.getById(
      request.org,
      request.user,
      params.id,
    );
    if (!submission) {
      return {
        status: 404 as const,
        body: { message: "Submission not found" },
      };
    }
    return { status: 200 as const, body: submission };
  },

  createSubmission: async ({ body, request }) => {
    const submission = await submissionsService.create(
      request.org,
      request.user,
      body,
    );
    return { status: 201 as const, body: submission };
  },
  // ... other handlers
});

// Register in main app:
// import { registerRouter } from '@ts-rest/fastify';
// registerRouter(submissionsContract, submissionsRouter, app);
```

---

## 3. Shared Validation Across API Surfaces

### The Problem

Three API surfaces means three potential places to define and enforce validation. Without a shared source, schemas drift and behavior becomes inconsistent.

### The Solution: Zod as Single Source of Truth

```
  @colophony/types (Zod schemas)
         │
         ├──────────────────────────────────────────┐
         │                    │                     │
    tRPC procedures     ts-rest contracts     Pothos args
    (.input(schema))    (body: schema)        (validate: {schema})
         │                    │                     │
         │                    │                     │
    tRPC middleware      ts-rest middleware    Pothos validation
    (validates)          (validates)           plugin (validates)
         │                    │                     │
         └────────────────────┼─────────────────────┘
                              │
                    Shared Service Layer
                   (receives validated data)
```

### Implementation Pattern

**Step 1: Schemas stay in `@colophony/types` (no change from MVP)**

```typescript
// packages/types/src/submission.ts (EXISTING — no changes needed)
export const createSubmissionSchema = z.object({
  title: z.string().min(1).max(500),
  content: z.string().max(50000).optional(),
  coverLetter: z.string().max(10000).optional(),
  submissionPeriodId: z.string().uuid().optional(),
});
```

**Step 2: Each surface imports and uses the same schema**

```typescript
// tRPC (existing pattern — no change)
.input(createSubmissionSchema)

// ts-rest contract
body: createSubmissionSchema,

// Pothos GraphQL
const CreateSubmissionInput = builder.inputType('CreateSubmissionInput', {
  fields: (t) => ({
    title: t.string({ required: true }),
    content: t.string(),
    coverLetter: t.string(),
    submissionPeriodId: t.string(),
  }),
  // Zod validation via StandardSchema plugin
  validate: { schema: createSubmissionSchema },
});
```

**Step 3: Add response schemas to `@colophony/types`**

The MVP defines input schemas but not response schemas. For REST (OpenAPI) and GraphQL, we need response types too:

```typescript
// packages/types/src/submission.ts (NEW additions for v2)

// Full submission response (for API consumers)
export const submissionResponseSchema = z.object({
  id: z.string().uuid(),
  title: z.string(),
  content: z.string().nullable(),
  coverLetter: z.string().nullable(),
  status: submissionStatusSchema,
  submittedAt: z.string().datetime().nullable(), // ISO string for REST
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
  submitter: z.object({
    id: z.string().uuid(),
    email: z.string().email(),
  }),
  fileCount: z.number().int(),
});

// List response with pagination metadata
export const submissionListResponseSchema = paginatedResponseSchema(
  submissionResponseSchema,
);
```

### Code Generation vs Runtime Conversion

| Approach               | Pros                              | Cons                               | Use in v2 |
| ---------------------- | --------------------------------- | ---------------------------------- | --------- |
| **Runtime (chosen)**   | Single schema, no build step      | Slight startup cost                | Yes       |
| **Codegen (Zod->TS)**  | Zero runtime cost                 | Build step, potential drift        | No        |
| **Codegen (Zod->GQL)** | Could auto-generate GraphQL types | Less control, harder customization | No        |

The runtime approach is preferred because:

- Zod's `.parse()` is fast enough for request validation (microseconds)
- Pothos reads Zod schemas at schema-build time (once, on startup)
- ts-rest uses Zod at contract definition time (once, on startup)
- No build step means no drift between definition and usage

---

## 4. Rate Limiting and Auth Across Multiple Surfaces

### Current State

The MVP (Colophony v1) uses:

- **Auth:** JWT (15-min access + 7-day refresh) via `Authorization: Bearer <token>`
- **Org context:** `x-organization-id` header
- **Rate limiting:** Redis sliding window via `RateLimitGuard` (100 req/min default, 20 req/min auth)

### Challenge: Three Surfaces, One Policy

```
                              Auth Methods
                    ┌─────────────────────────────┐
                    │                             │
            ┌───────┴───────┐            ┌────────┴────────┐
            │  JWT (Bearer) │            │   API Key       │
            │  (internal +  │            │   (public REST  │
            │   power users)│            │   + GraphQL)    │
            └───────┬───────┘            └────────┬────────┘
                    │                             │
                    └─────────────┬───────────────┘
                                  │
                    ┌─────────────▼────────────────┐
                    │   Unified Auth Context        │
                    │                               │
                    │  user: { id, email }          │
                    │  org: { id, role }            │
                    │  authMethod: 'jwt' | 'apikey' │
                    │  apiKeyScopes: string[]       │
                    └─────────────┬────────────────┘
                                  │
                    ┌─────────────▼────────────────┐
                    │   Unified Rate Limiter        │
                    │                               │
                    │  Key: apiKey OR ip            │
                    │  + per-surface multipliers    │
                    │  + GraphQL cost analysis      │
                    └──────────────────────────────┘
```

### Auth Strategy

**Add API Keys for public API access:**

```typescript
// packages/types/src/api-key.ts (NEW)
export const apiKeyScopeSchema = z.enum([
  "submissions:read",
  "submissions:write",
  "files:read",
  "files:write",
  "payments:read",
  "organizations:read",
  "webhooks:manage",
]);

export type ApiKeyScope = z.infer<typeof apiKeyScopeSchema>;
```

**Unified auth hook (Fastify onRequest):**

```typescript
// apps/api/src/hooks/auth.hook.ts
import type { FastifyRequest, FastifyReply } from "fastify";

export async function authHook(request: FastifyRequest, reply: FastifyReply) {
  // Try Zitadel OIDC token first
  const bearer = extractBearerToken(request);
  if (bearer) {
    request.authContext = await verifyZitadelToken(bearer);
    return;
  }

  // Try API key (for public REST + GraphQL API)
  const apiKey = request.headers["x-api-key"] as string;
  if (apiKey) {
    request.authContext = await authenticateApiKey(apiKey);
    return;
  }

  // No auth — only public endpoints allowed
  request.authContext = null;
}

// Register as Fastify hook:
// app.addHook('onRequest', authHook);
```

### Rate Limiting Strategy

| Surface     | Key             | Default Limit   | Notes                                   |
| ----------- | --------------- | --------------- | --------------------------------------- |
| **tRPC**    | IP              | 100 req/min     | Unchanged from MVP                      |
| **REST**    | API Key (or IP) | 60 req/min      | Per-key limits, burst allowance         |
| **GraphQL** | API Key (or IP) | 1000 points/min | Cost-based (queries=1pt, mutations=5pt) |

**GraphQL cost-based rate limiting:**

```typescript
// apps/api/src/modules/graphql/plugins/cost-analysis.plugin.ts
import { Plugin } from "graphql-yoga";

export function costAnalysisPlugin(maxCost: number = 1000): Plugin {
  return {
    onExecute({ args }) {
      const cost = calculateQueryCost(args.document, args.schema);

      if (cost > maxCost) {
        throw new GraphQLError(
          `Query cost ${cost} exceeds maximum ${maxCost}`,
          { extensions: { code: "QUERY_TOO_COMPLEX" } },
        );
      }

      // Deduct from rate limit budget
      args.contextValue.rateLimitCost = cost;
    },
  };
}

function calculateQueryCost(
  document: DocumentNode,
  schema: GraphQLSchema,
): number {
  // Base costs:
  // - Each field selection: 1 point
  // - Each relation traversal: 2 points
  // - Each mutation: 5 points
  // - List fields: multiplied by first/limit argument (default 20)
  // - Nested pagination: multiplicative
  // ...static analysis implementation
}
```

### Unified Rate Limit Headers

All three surfaces return consistent headers:

```
X-RateLimit-Limit: 60
X-RateLimit-Remaining: 45
X-RateLimit-Reset: 1707660000
Retry-After: 30        (only when limited)
```

For GraphQL, additionally:

```
X-RateLimit-Cost: 15   (cost of this query)
```

---

## 5. API Versioning Strategy

### REST: URL Path Versioning

**Choice: `/v1/submissions`, `/v2/submissions`**

| Method       | Pros                          | Cons                         | Used by          |
| ------------ | ----------------------------- | ---------------------------- | ---------------- |
| **URL path** | Explicit, easy to route/cache | URL bloat                    | GitHub, Stripe\* |
| Header       | Clean URLs                    | Easy to forget, hard to test | GitHub (Accept)  |
| Query param  | Easy to test                  | Cache key pollution          | Few              |

\*Stripe uses a hybrid: URL path for major versions, `Stripe-Version` header for minor.

**Colophony approach:**

```
/v1/submissions          # Current API
/v1/submissions/:id      # Scoped to v1 behavior

# Future: /v2/ with breaking changes
/v2/submissions          # New response shape, different defaults
```

**Version change modules (Stripe pattern):**

Rather than branching the entire codebase, version-specific transformations are applied as middleware:

```typescript
// apps/api/src/modules/rest/versioning/v1-transforms.ts
export const v1Transforms = {
  // v1 returns dates as ISO strings
  "Submission.submittedAt": (value: Date | null) =>
    value?.toISOString() ?? null,

  // v1 returns status as uppercase string
  "Submission.status": (value: string) => value.toUpperCase(),
};
```

**Deprecation policy:**

- Announce deprecation 6 months before removal
- Send `Sunset` header on deprecated versions: `Sunset: Sat, 01 Feb 2027 00:00:00 GMT`
- Send `Deprecation` header: `Deprecation: true`
- Remove after 12 months total

### GraphQL: Schema Evolution (No Versioning)

GraphQL's community strongly recommends against versioning. Instead:

1. **Add fields freely** (always backward-compatible)
2. **Deprecate fields** with `@deprecated(reason: "Use newField instead")`
3. **Track deprecated field usage** via analytics
4. **Remove deprecated fields** after 6 months with zero usage

```graphql
type Submission {
  id: ID!
  title: String!
  status: SubmissionStatus!

  # Deprecated: use submittedAt instead
  submitted_at: DateTime @deprecated(reason: "Use submittedAt (camelCase)")

  submittedAt: DateTime
}
```

**Schema change policy:**

- Additive changes: deploy immediately
- Deprecations: announce in changelog, add `@deprecated`
- Removals: only after 6 months with <1% usage of deprecated field

### tRPC: No Versioning (Internal Only)

tRPC is used exclusively between the Colophony web frontend and API. Since both are deployed together:

- Breaking changes are coordinated in the same PR
- No version negotiation needed
- Type safety catches incompatibilities at build time

---

## 6. SDK Generation for Multiple Languages

### REST SDK Generation

| Tool                  | Languages                                  | OpenAPI Version | Quality   | Cost             | Recommendation  |
| --------------------- | ------------------------------------------ | --------------- | --------- | ---------------- | --------------- |
| **Speakeasy**         | TS, Python, Go, Java, Ruby, C#, PHP, Swift | 3.0/3.1         | Excellent | Free tier + paid | **RECOMMENDED** |
| **Stainless**         | TS, Python, Go, Java, Kotlin, Ruby         | 3.1             | Excellent | Paid             | Alternative     |
| **openapi-generator** | 50+ languages                              | 2.0/3.0         | Variable  | Free (OSS)       | Fallback        |
| **Fern**              | TS, Python, Go, Java, Ruby, C#             | 3.1             | Good      | Free tier        | Alternative     |

**Recommendation: Speakeasy**

Why:

- **OpenAPI-native.** Reads the spec generated by ts-rest directly. No custom DSL.
- **Webhook support.** Generates type-safe webhook handlers — important for Colophony's Stripe-style webhook patterns.
- **SDK documentation.** Auto-generates README and usage examples per SDK.
- **Free tier for open source.** Colophony is open-source, so the free tier covers the core needs.
- **CI integration.** GitHub Action generates SDKs on API spec changes.

**SDK generation pipeline:**

```
  ts-rest contracts
       │
       │ npm run generate:openapi
       v
  openapi.json (3.1)
       │
       ├── Speakeasy ──> @colophony/sdk-typescript  (npm)
       ├── Speakeasy ──> colophony-python           (PyPI)
       ├── Speakeasy ──> colophony-ruby             (RubyGems)
       └── Speakeasy ──> colophony-go               (Go module)
```

**Example: Generated TypeScript SDK usage:**

```typescript
import { Colophony } from "@colophony/sdk";

const client = new Colophony({ apiKey: "pk_live_..." });

const submissions = await client.submissions.list({
  status: "SUBMITTED",
  page: 1,
  limit: 20,
});

const created = await client.submissions.create({
  title: "My Short Story",
  content: "...",
});
```

### GraphQL Client Generation

For GraphQL consumers, `graphql-codegen` from The Guild generates typed clients:

```typescript
// Consumer's codegen.ts
import type { CodegenConfig } from "@graphql-codegen/cli";

const config: CodegenConfig = {
  schema: "https://api.colophony.example.com/graphql",
  documents: "src/**/*.graphql",
  generates: {
    "./src/generated/graphql.ts": {
      plugins: [
        "typescript",
        "typescript-operations",
        "typescript-graphql-request", // or typed-document-node
      ],
    },
  },
};
```

For non-TypeScript GraphQL consumers:

- **Python:** `sgqlc` or `gql` with schema introspection
- **Ruby:** `graphql-client` gem with schema introspection
- GraphQL's introspection capability means any language with a GraphQL client can discover the API

### SDK Publication Strategy

| Package                        | Registry | Auto-publish | Trigger                     |
| ------------------------------ | -------- | ------------ | --------------------------- |
| `@colophony/sdk`               | npm      | Yes          | OpenAPI spec change on main |
| `colophony-python`             | PyPI     | Yes          | Same                        |
| `colophony-ruby`               | RubyGems | Yes          | Same                        |
| `colophony-go`                 | Go proxy | Yes          | Same                        |
| GraphQL schema (introspection) | N/A      | Automatic    | Always live                 |

---

## 7. How Successful Platforms Structure Their APIs

### GitHub: REST v3 + GraphQL v4

**Architecture:**

- REST API (v3) is the original, still fully supported
- GraphQL API (v4) was added later for efficiency (reduce over-fetching)
- Both coexist indefinitely — no plan to deprecate REST

**Key lessons for Colophony:**

- REST and GraphQL serve different audiences. REST is for simple integrations and webhooks. GraphQL is for complex clients that need precise data.
- GitHub uses **cost-based rate limiting** for GraphQL (each query has a point cost)
- REST uses **header-based versioning** (`Accept: application/vnd.github.v3+json`)
- Personal Access Tokens work across both surfaces
- GraphQL does not version; it uses field deprecation

**Applicability:** High. Colophony has the same split: simple integrations (REST) vs power users (GraphQL).

### Stripe: REST-Only, Excellent SDK Story

**Architecture:**

- REST API only (no GraphQL)
- Date-based versioning (`2024-12-18`) with "version change modules"
- SDKs generated from OpenAPI spec using internal tooling (now partially Stainless)
- Auto-generated changelog from version change metadata

**Key lessons for Colophony:**

- **Version change modules** are the gold standard for REST versioning. Each breaking change is encapsulated as a transformation function that can be applied or rolled back.
- Stripe invests heavily in SDK quality. Each SDK feels hand-written despite being generated.
- Stripe's API review process (design review before implementation) prevents the need for frequent versioning.
- **Idempotency keys** are a first-class concept. Colophony already has idempotent webhook handling; extend this to the REST API.

**Applicability:** Medium. Stripe's scale justifies version change modules. Colophony should adopt the pattern but start simpler (URL-path versioning).

### Linear: GraphQL-Only

**Architecture:**

- GraphQL API only (same API used internally)
- OAuth2 + personal API keys
- TypeScript SDK generated from schema via custom graphql-codegen plugins
- Real-time via webhooks (not subscriptions)

**Key lessons for Colophony:**

- A GraphQL-only approach works well for developer-tool audiences but limits integration breadth (no Zapier/Make/n8n without REST).
- Linear's "same API for internal and external" approach is appealing but risky — internal needs (speed, iteration) conflict with external needs (stability, compatibility).
- Linear publishes their full schema on GitHub, enabling community tooling.

**Applicability:** Low (strategy-wise). Colophony needs REST for broad compatibility. But Linear's SDK generation approach is instructive.

### Ghost: REST with Content/Admin Split

**Architecture:**

- **Content API** (read-only, API key auth) — for rendering websites, fully cacheable
- **Admin API** (read-write, JWT auth) — for managing content, role-based
- Separate authentication per surface
- Self-consuming: Ghost's admin UI uses the Admin API

**Key lessons for Colophony:**

- **Split by audience, not by feature.** Ghost's Content/Admin split maps naturally to Colophony's public/internal split.
- Content API is designed to be cached aggressively. Public read endpoints for Colophony (listing open submission periods, magazine info) should be similarly cacheable.
- Ghost keeps both APIs RESTful — no GraphQL. For Ghost's use case (rendering content), REST is sufficient. For Colophony's use case (complex queries across submissions, writers, magazines), GraphQL adds real value.

**Applicability:** High for the split concept. Colophony's REST API could adopt a similar Content/Admin split.

### Discourse: REST, Self-Consuming

**Architecture:**

- REST API (the web application consumes its own API)
- API key authentication
- Documentation auto-generated from rswag (Rails)
- Community-maintained SDKs in Ruby, Python, PHP

**Key lessons for Colophony:**

- **Self-consuming APIs** are the strongest guarantee of API quality. If the web app uses the same API, it stays maintained.
- Community-maintained SDKs have variable quality. Generated SDKs (Speakeasy) provide more consistent quality.
- Discourse's API docs are auto-generated from tests, ensuring documentation accuracy.

**Applicability:** Medium. Colophony's tRPC for internal use means the public API is not self-consuming, which requires extra discipline to keep it maintained. Consider: automated API tests that mirror real-world SDK usage.

### Summary: Patterns from Industry

| Pattern                          | Adopted by       | Colophony Approach                     |
| -------------------------------- | ---------------- | -------------------------------------- |
| REST + GraphQL coexistence       | GitHub           | Yes (REST primary, GraphQL for power)  |
| Cost-based GraphQL rate limiting | GitHub, Shopify  | Yes                                    |
| Version change modules (REST)    | Stripe           | Future (start with URL-path)           |
| OpenAPI-driven SDK generation    | Stripe, Twilio   | Yes (via Speakeasy)                    |
| Content/Admin API split          | Ghost            | Yes (public read vs org-scoped write)  |
| Self-consuming API               | Discourse, Ghost | Partial (tRPC is self-consuming)       |
| Schema evolution (GraphQL)       | GitHub, Linear   | Yes (no GraphQL versioning)            |
| API key + OAuth dual auth        | GitHub, Linear   | Yes (API key for scripts, OAuth later) |

---

## Proposed Architecture

### Package Structure

```
colophony/
├── packages/
│   ├── types/                    # Zod schemas (expanded with response schemas)
│   │   └── src/
│   │       ├── submission.ts     # + response schemas
│   │       ├── api-key.ts        # NEW: API key types
│   │       └── ...
│   │
│   ├── api-contracts/            # NEW: ts-rest contracts
│   │   └── src/
│   │       ├── index.ts
│   │       ├── submissions.contract.ts
│   │       ├── files.contract.ts
│   │       ├── payments.contract.ts
│   │       ├── organizations.contract.ts
│   │       └── openapi.ts        # OpenAPI spec generator
│   │
│   ├── db/                       # Drizzle ORM + RLS via pgPolicy
│   │
│   ├── auth-client/              # NEW: Zitadel REST API wrapper
│   │
│   └── sdk/                      # NEW: Generated TypeScript SDK
│       └── (auto-generated by Speakeasy)
│
├── apps/
│   ├── api/
│   │   └── src/
│   │       ├── trpc/             # Internal tRPC surface
│   │       │   ├── trpc.router.ts
│   │       │   └── routers/
│   │       │
│   │       ├── rest/             # NEW: REST API surface
│   │       │   ├── setup.ts           # @ts-rest/fastify registration
│   │       │   ├── submissions.routes.ts
│   │       │   ├── files.routes.ts
│   │       │   ├── payments.routes.ts
│   │       │   └── organizations.routes.ts
│   │       │
│   │       ├── graphql/          # NEW: GraphQL API surface
│   │       │   ├── setup.ts           # Yoga + Fastify registration
│   │       │   ├── builder.ts         # Pothos SchemaBuilder
│   │       │   ├── schema.ts          # Final executable schema
│   │       │   ├── loaders.ts         # DataLoader factories (manual)
│   │       │   ├── types/
│   │       │   │   ├── submission.type.ts
│   │       │   │   ├── user.type.ts
│   │       │   │   ├── organization.type.ts
│   │       │   │   └── ...
│   │       │   └── plugins/
│   │       │       ├── cost-analysis.plugin.ts
│   │       │       └── audit.plugin.ts
│   │       │
│   │       ├── services/         # Shared service layer (plain classes)
│   │       │   ├── submissions.service.ts
│   │       │   ├── storage.service.ts
│   │       │   ├── payments.service.ts
│   │       │   ├── audit.service.ts
│   │       │   └── gdpr.service.ts
│   │       │
│   │       ├── hooks/            # Fastify hooks
│   │       │   ├── auth.hook.ts         # Zitadel token + API key auth
│   │       │   ├── rate-limit.hook.ts   # Redis sliding window
│   │       │   └── org-context.hook.ts  # RLS context via Drizzle
│   │       │
│   │       └── main.ts           # Fastify app, mounts all surfaces
│   │
│   └── web/                      # Next.js frontend
```

### Request Flow (All Three Surfaces)

```
HTTP Request
     │
     ▼
┌─────────────────────────────────────────────────────┐
│  Fastify Hook Pipeline                               │
│                                                     │
│  1. @fastify/cors                                   │
│  2. @fastify/helmet (security headers)              │
│  3. authHook (onRequest)                            │
│     ├─ Zitadel? → verify token → populate user/org  │
│     ├─ API Key? → lookup key → populate user/org    │
│     └─ None? → anonymous (public endpoints only)    │
│  4. rateLimitHook (onRequest)                       │
│     ├─ tRPC: 100 req/min (IP)                       │
│     ├─ REST: 60 req/min (API key or IP)             │
│     └─ GraphQL: 1000 pts/min (cost-based)           │
│  5. auditHook (onResponse)                          │
│     └─ Logs API access for sensitive operations     │
└───────────────────┬─────────────────────────────────┘
                    │
          ┌─────────┼────────────┐
          │         │            │
     /trpc/*    /v1/*       /graphql
          │         │            │
    ┌─────▼───┐ ┌───▼─────┐ ┌───▼────────┐
    │  tRPC   │ │ ts-rest  │ │  GraphQL   │
    │ Fastify │ │ Fastify  │ │  Yoga      │
    │ adapter │ │ routes   │ │ + Pothos   │
    └────┬────┘ └────┬─────┘ └─────┬──────┘
         │           │             │
         │     Input validated     │
         │     by Zod schemas      │
         │     from @colophony/    │
         │     types               │
         │           │             │
    ┌────▼───────────▼─────────────▼──────┐
    │                                      │
    │       Shared Service Layer           │
    │                                      │
    │  SubmissionsService.create()         │
    │  SubmissionsService.list()           │
    │  PaymentsService.createCheckout()    │
    │  ...                                 │
    │                                      │
    │  All services use:                   │
    │  - Drizzle + RLS (pgPolicy) for     │
    │    tenant isolation                  │
    │  - AuditService for logging         │
    │  - Zod schemas for internal checks  │
    │                                      │
    └──────────────────────────────────────┘
```

### Endpoint Mapping

| Operation               | tRPC                             | REST                                | GraphQL                               |
| ----------------------- | -------------------------------- | ----------------------------------- | ------------------------------------- |
| List submissions        | `submissions.list`               | `GET /v1/submissions`               | `query { submissions { ... } }`       |
| Get submission          | `submissions.getById`            | `GET /v1/submissions/:id`           | `query { submission(id: "...") }`     |
| Create submission       | `submissions.create`             | `POST /v1/submissions`              | `mutation { createSubmission() }`     |
| Update submission       | `submissions.update`             | `PATCH /v1/submissions/:id`         | `mutation { updateSubmission() }`     |
| Transition status       | `submissions.updateStatus`       | `POST /v1/submissions/:id/status`   | `mutation { transitionSubmission() }` |
| Withdraw                | `submissions.withdraw`           | `POST /v1/submissions/:id/withdraw` | `mutation { withdrawSubmission() }`   |
| Create checkout session | `payments.createCheckoutSession` | `POST /v1/submissions/:id/checkout` | `mutation { createCheckout() }`       |
| Login                   | `auth.login`                     | `POST /v1/auth/login`               | N/A (use REST)                        |
| Refresh token           | `auth.refresh`                   | `POST /v1/auth/refresh`             | N/A (use REST)                        |
| GDPR export             | `gdpr.exportData`                | `GET /v1/me/data-export`            | N/A (use REST)                        |

Note: Auth and GDPR operations are REST/tRPC only. GraphQL is for data querying and submission management.

---

## Migration Path from v1

> **Note:** This section describes the API layer build-out within the broader Colophony implementation strategy (see `docs/architecture.md` Section 6). The API layer corresponds to **Track 2 (Months 3-8)** and depends on Track 1 (Core Infrastructure) completing the Fastify and Drizzle migrations first.

### Phase 1: Extract Service Layer (Weeks 1-3)

The MVP has business logic embedded in tRPC routers. Extract it into plain service classes that all three API surfaces can share:

```typescript
// BEFORE: Logic in tRPC router (v1 — NestJS + Prisma)
export const submissionsRouter = router({
  create: orgProcedure
    .input(createSubmissionSchema)
    .mutation(async ({ input, ctx }) => {
      const submission = await ctx.prisma.submission.create({
        data: {
          ...input,
          organizationId: ctx.org.id,
          submitterId: ctx.user.userId,
          status: "DRAFT",
        },
      });
      // ... history, audit logging inline
      return submission;
    }),
});

// AFTER: Logic in shared service (v2 — Fastify + Drizzle)
export class SubmissionsService {
  constructor(
    private db: DrizzleDB,
    private audit: AuditService,
  ) {}

  async create(
    org: OrgContext,
    user: AuthContext,
    input: CreateSubmissionInput,
  ) {
    return this.db.transaction(async (tx) => {
      // RLS context set via pgPolicy in Drizzle schema
      const [submission] = await tx
        .insert(submissions)
        .values({
          ...input,
          organizationId: org.id,
          submitterId: user.userId,
          status: "DRAFT",
        })
        .returning();

      await this.audit.log(tx, "submission.created", {
        submissionId: submission.id,
      });
      return submission;
    });
  }
}

// tRPC router becomes a thin adapter
export const submissionsRouter = router({
  create: orgProcedure
    .input(createSubmissionSchema)
    .mutation(({ input, ctx }) =>
      submissionsService.create(ctx.org, ctx.user, input),
    ),
});
```

**This phase has zero external impact.** The tRPC API behaves identically.

### Phase 2: Add REST Surface (Weeks 3-5)

1. Create `@colophony/api-contracts` package with ts-rest contracts
2. Register Fastify routes via `@ts-rest/fastify` that call the shared service layer
3. Add API key authentication (alongside Zitadel tokens)
4. Generate and publish OpenAPI 3.1 spec
5. Mount REST routes at `/v1/`

### Phase 3: Add GraphQL Surface (Weeks 5-8)

1. Set up Pothos builder with Zod validation plugin and Relay plugin
2. Define GraphQL types manually from Drizzle schema (no Prisma plugin)
3. Create DataLoader factories for all relation fields (N+1 prevention)
4. Add query and mutation resolvers that call the shared service layer
5. Add cost-based rate limiting plugin
6. Mount GraphQL Yoga at `/graphql` via Fastify route

### Phase 4: SDK Generation (Weeks 8-10)

1. Set up Speakeasy in CI
2. Generate TypeScript and Python SDKs from OpenAPI spec
3. Publish to package registries
4. Write SDK usage examples and quickstart guide

### Phase 5: Documentation & Polish (Weeks 10-12)

1. API reference docs (generated from OpenAPI + GraphQL introspection)
2. Getting Started guides per SDK
3. Webhook documentation
4. Rate limiting documentation
5. GraphQL cost model documentation

---

## Decision Log

| Decision                 | Choice                  | Alternatives Considered                | Rationale                                                                                                         |
| ------------------------ | ----------------------- | -------------------------------------- | ----------------------------------------------------------------------------------------------------------------- |
| GraphQL framework        | Pothos + Yoga           | TypeGraphQL, Nexus, Apollo Server      | Zod via StandardSchema (single source of truth), no codegen, active maintenance. Manual Drizzle mapping accepted. |
| REST framework           | ts-rest                 | Hono + zod-openapi, tsoa, trpc-openapi | Contract-first with native Zod, OpenAPI 3.1, `@ts-rest/fastify` adapter, typed client                             |
| Shared validation        | Zod (runtime)           | Codegen, manual duplication            | Already the source of truth in MVP, all three surfaces can consume directly                                       |
| OpenAPI spec version     | 3.1                     | 3.0, 2.0                               | JSON Schema alignment, better tooling support in 2025+                                                            |
| REST versioning          | URL path (/v1/)         | Header, query param                    | Explicit, cacheable, well-understood. Stripe-style change modules as future enhancement                           |
| GraphQL versioning       | Schema evolution        | Explicit versions                      | Industry standard, supported by Pothos deprecation, field usage tracking                                          |
| SDK generation           | Speakeasy               | Stainless, openapi-generator, Fern     | OpenAPI-native, webhook support, free OSS tier, good language coverage                                            |
| Rate limiting (GraphQL)  | Cost-based              | Request-count                          | Prevents expensive queries from exhausting limits. Used by GitHub and Shopify.                                    |
| Auth for public API      | API keys + Zitadel OIDC | OAuth only, API keys only              | API keys for scripts/CI, Zitadel OIDC for interactive sessions. OAuth2 flows built into Zitadel.                  |
| Service layer extraction | Plain classes/functions | Keep logic in routers                  | Required for sharing logic across surfaces. No DI framework — Fastify doesn't require NestJS patterns.            |

---

## Appendix A: Key Dependencies to Add

```json
{
  "packages/api-contracts": {
    "@ts-rest/core": "^3.x",
    "@ts-rest/open-api": "^3.x"
  },
  "apps/api (REST)": {
    "@ts-rest/fastify": "^3.x"
  },
  "apps/api (GraphQL)": {
    "@pothos/core": "^4.x",
    "@pothos/plugin-validation": "^4.x",
    "@pothos/plugin-relay": "^4.x",
    "@pothos/plugin-scope-auth": "^4.x",
    "graphql-yoga": "^5.x",
    "graphql": "^16.x",
    "dataloader": "^2.x"
  }
}
```

> **Note:** No `@pothos/plugin-prisma` or `@graphql-yoga/nestjs` — Drizzle types are mapped manually, and Yoga integrates with Fastify directly via `handleNodeRequest`.

## Appendix B: OpenAPI Spec Generation Script

```typescript
// packages/api-contracts/src/openapi.ts
import { generateOpenApi } from "@ts-rest/open-api";
import { fullContract } from "./index";

export const openApiDocument = generateOpenApi(
  fullContract,
  {
    info: {
      title: "Colophony API",
      version: "1.0.0",
      description:
        "Literary magazine infrastructure API — submissions, publications, federation",
      contact: {
        name: "Colophony",
        url: "https://github.com/colophony/colophony",
      },
      license: {
        name: "MIT",
      },
    },
    servers: [
      { url: "https://api.colophony.example.com", description: "Production" },
      { url: "http://localhost:4000", description: "Local development" },
    ],
    security: [{ apiKey: [] }, { bearerAuth: [] }],
  },
  {
    setOperationId: true,
  },
);
```

## Appendix C: Risk Assessment

| Risk                                             | Likelihood | Impact | Mitigation                                                                 |
| ------------------------------------------------ | ---------- | ------ | -------------------------------------------------------------------------- |
| Service layer extraction introduces regressions  | Medium     | High   | Existing 308 unit + 65 E2E tests provide safety net                        |
| Pothos + Drizzle manual mapping is too verbose   | Medium     | High   | Month 3 evaluation checkpoint; fallback to Mercurius or raw Yoga resolvers |
| `@ts-rest/fastify` adapter limitations           | Low        | Medium | Can fall back to raw Fastify route handlers                                |
| GraphQL N+1 queries (no auto-dataloader)         | High       | Medium | Manual DataLoader setup for every relation; enforce in code review         |
| SDK generation quality issues                    | Low        | Medium | Review generated SDKs, add integration tests                               |
| Rate limiting bypass via GraphQL query splitting | Medium     | Medium | Cost analysis counts total points across batched queries                   |
| API key management complexity                    | Low        | Low    | Start simple (org-level keys), add scoping later                           |

---

## References

### Tools Evaluated

- [Pothos GraphQL](https://pothos-graphql.dev/) — Code-first GraphQL schema builder
- [ts-rest](https://ts-rest.com/) — Contract-first REST with Zod
- [GraphQL Yoga](https://the-guild.dev/graphql/yoga-server) — Lightweight GraphQL server
- [Speakeasy](https://www.speakeasy.com/) — SDK generation from OpenAPI
- [graphql-codegen](https://the-guild.dev/graphql/codegen) — GraphQL client code generation
- [oRPC](https://orpc.dev/) — Emerging alternative (monitor for v2+)

### Platform API References

- [GitHub REST API](https://docs.github.com/en/rest) / [GitHub GraphQL API](https://docs.github.com/en/graphql)
- [Stripe API Design](https://stripe.com/blog/payment-api-design) / [Stripe Versioning](https://stripe.com/blog/api-versioning)
- [Linear Developers](https://linear.app/developers)
- [Ghost API Architecture](https://ghost.org/docs/architecture/)
- [Discourse API](https://docs.discourse.org/)

### Research Sources

- [Pothos vs TypeGraphQL](https://blog.logrocket.com/pothos-vs-typegraphql-for-typescript-schema-building/)
- [tRPC vs GraphQL](https://betterstack.com/community/guides/scaling-nodejs/trpc-vs-graphql/)
- [trpc-openapi vs ts-rest](https://catalins.tech/public-api-trpc/)
- [SDK Generator Comparison 2025](https://nordicapis.com/review-of-8-sdk-generators-for-apis-in-2025/)
- [Speakeasy vs Stainless](https://www.speakeasy.com/blog/speakeasy-vs-stainless)
- [GraphQL Rate Limiting (Shopify)](https://shopify.engineering/rate-limiting-graphql-apis-calculating-query-complexity)
- [GraphQL Rate Limiting (GitHub)](https://docs.github.com/en/graphql/overview/rate-limits-and-query-limits-for-the-graphql-api)
- [REST vs GraphQL API Versioning](https://www.moesif.com/blog/technical/api-design/Best-Practices-for-Versioning-REST-and-GraphQL-APIs/)
- [oRPC v1 Announcement](https://orpc.dev/blog/v1-announcement)
- [NestJS + Zod + OpenAPI Integration](https://medium.com/@gildniy/how-i-built-a-type-safe-api-with-auto-generated-documentation-using-zod-nestjs-openapi-f91c2abd8f08)
