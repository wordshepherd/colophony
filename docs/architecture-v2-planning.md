# Colophony — Architecture Planning

> **Status:** Research complete, implementation strategy defined
> **Created:** 2026-02-10
> **Updated:** 2026-02-11
> **Context:** Product vision defined in `docs/competitive-analysis.md` (Section 9). The MVP prototype ("Prospector") proved the concept; Colophony is a full reconceive as open-source infrastructure for literary magazines.
>
> **Naming:** **Colophony** is the suite (infrastructure for literary magazines). Components:
>
> | Component    | Scope                          | Tagline                                                                                       |
> | ------------ | ------------------------------ | --------------------------------------------------------------------------------------------- |
> | **Hopper**   | Submission Management          | "Feed the hopper, process the queue" — Forms, intake, review pipeline, decision-making        |
> | **Slate**    | Publication Pipeline           | "Build your slate, publish your issue" — Copyedit, contracts, issue assembly, CMS integration |
> | **Relay**    | Notifications & Communications | "Relay the acceptance" — Email, webhooks, in-app messaging                                    |
> | **Register** | Identity & Federation          | "Register with the network" — Cross-instance identity, sim-sub enforcement, piece transfers   |
>
> Internal/developer-facing concerns (API layer, plugin system) use the Colophony name directly.
>
> **Decision log:** All product decisions from the interview are in `docs/competitive-analysis.md` Section 9. This document focuses on architectural research and technical decisions.

---

## Table of Contents

1. [Vision Summary](#1-vision-summary)
2. [What Carries Forward from MVP](#2-what-carries-forward-from-mvp)
3. [Service Architecture](#3-service-architecture)
4. [Research Areas](#4-research-areas)
5. [Research Results](#5-research-results)
6. [Implementation Strategy](#6-implementation-strategy)
7. [Open Questions](#7-open-questions)

---

## 1. Vision Summary

Colophony is **open-source infrastructure for literary magazines** — a decomposed, federated platform covering the full publication lifecycle from submission through publication.

### Core Principles

| Principle                         | Detail                                                                                                                      |
| --------------------------------- | --------------------------------------------------------------------------------------------------------------------------- |
| **Open source**                   | Fully open source. Monetize via managed hosting, not feature gating.                                                        |
| **Federated**                     | Cross-instance identity, simultaneous submission enforcement, cross-journal transfers.                                      |
| **Integration hub**               | Adapter pattern for all ancillary services. Curated open-source defaults for magazines without existing infrastructure.     |
| **Infrastructure, not app**       | The platform literary magazines run on. Submissions, editorial workflow, publication pipeline, CRM, newsletters, marketing. |
| **Maximum editorial flexibility** | Configurable scoring, assignment, stages, views, and workflows per org.                                                     |
| **No feature gating**             | All features on all plans. Managed hosting pricing is flat rate + cost-only volume add-ons.                                 |

### Target Market

Literary magazines in a modern web context — including multimedia content (audio/video of readings). Tiny to mid-sized magazines. Two-sided marketplace potential via Chill Subs partnership and federated submitter identity.

### Organization Hierarchy

```
Organization
└── Publication(s)
    └── Call Type(s)
        └── Call(s) (with reading periods, forms, rules)
            └── Submission(s)
                └── Review pipeline → Accept/Reject
                    └── Publication pipeline (copyedit, contract, issue assembly)
```

---

## 2. What Carries Forward from MVP

### Preserve (business logic and patterns)

| Asset                    | How It Transfers                                                               |
| ------------------------ | ------------------------------------------------------------------------------ |
| **PostgreSQL + RLS**     | Same multi-tenancy pattern, expanded data model                                |
| **GDPR compliance**      | Export, erasure, consent, retention, audit logging — business rules carry over |
| **Security patterns**    | Rate limiting, headers, virus scanning, secret prevention                      |
| **Submission lifecycle** | DRAFT → SUBMITTED → UNDER_REVIEW → ACCEPTED/REJECTED/HOLD/WITHDRAWN            |
| **Payment idempotency**  | Stripe webhook deduplication pattern                                           |
| **File upload flow**     | tus resumable upload → virus scan → clean/quarantine                           |
| **Test specifications**  | 373 tests encode business rules as specifications for v2                       |
| **Competitive research** | Full market analysis in `docs/competitive-analysis.md`                         |
| **Product decisions**    | All interview decisions in `docs/competitive-analysis.md` Section 9            |

### Does Not Transfer (implementation-specific)

| Asset                        | Why                                                           |
| ---------------------------- | ------------------------------------------------------------- |
| NestJS modules               | Framework under evaluation                                    |
| tRPC router structure        | Keeping for internal use, adding REST + GraphQL               |
| Prisma schema                | ORM under evaluation; data model changing significantly       |
| Current auth implementation  | Replacing with external auth service                          |
| Frontend component structure | Will be redesigned for new features                           |
| Docker Compose configs       | Self-hosted keeps Compose; managed hosting needs orchestrator |

---

## 3. Service Architecture

### Proposed Services

| Service          | Responsibility                                                                             | Communication                                   |
| ---------------- | ------------------------------------------------------------------------------------------ | ----------------------------------------------- |
| **Core API**     | Submissions, editorial workflow, organizations, publications, forms, payments, GDPR, audit | REST + GraphQL (public), tRPC (internal to web) |
| **Web Frontend** | Editor UI, submitter UI, admin UI                                                          | Consumes Core API                               |
| **Workers**      | Background jobs: virus scan, retention, outbox, email dispatch                             | BullMQ queues via Redis                         |
| **Federation**   | Cross-instance identity, sim-sub enforcement, transfers, discovery                         | Own API surface; calls Core API                 |
| **Publication**  | Copyediting workflow, contracts/e-sign, issue assembly, CMS integration                    | Shared DB + event-driven triggers               |
| **Notification** | Email, in-app messaging, bidirectional email sync, webhooks, Zapier/Make/n8n triggers      | Event-driven via Redis pub/sub or message queue |
| **Auth**         | Authentication, OAuth, federation identity, SSO, password reset                            | External service (Keycloak/Zitadel/etc.)        |

### Deployment Models

| Environment         | Orchestration                    | Target User                                     |
| ------------------- | -------------------------------- | ----------------------------------------------- |
| **Self-hosted**     | Docker Compose                   | Small magazine with a VPS                       |
| **Managed hosting** | TBD (K8s, Fly.io, Coolify, etc.) | Magazines that don't want to run infrastructure |
| **Development**     | Docker Compose + hot reload      | Contributors                                    |

### Monorepo Structure (Proposed)

```
apps/
  api/                  Core API server
  web/                  Main web frontend
  workers/              Background job processors
  federation/           Federation service
  publication/          Publication pipeline service
  notification/         Notification service
packages/
  db/                   Database schema + RLS + migrations
  types/                Shared types and Zod schemas
  plugin-sdk/           Adapter interfaces + plugin contracts
  api-client/           Generated REST/GraphQL client SDK
  embed/                Embeddable submission form widget
  adapters/
    email-smtp/         Ships with core
    email-sendgrid/     Community/first-party
    payment-stripe/     Ships with core
    payment-paypal/     Ships with core
    auth-*/             Auth service adapter
    ...
  config/
    eslint/
    typescript/
```

### Separate Repositories (Ecosystem)

```
colophony/colophony              Main monorepo (this repo)
colophony/cms-wordpress           WordPress CMS integration plugin
colophony/cms-ghost               Ghost CMS integration plugin
colophony/hosting                 Managed hosting infrastructure (private)
colophony/docker-stacks           Curated Docker Compose stacks (Colophony + Listmonk + auth, etc.)
colophony/community-adapters      Community-contributed adapter template
colophony/docs-site               Documentation website
```

---

## 4. Research Areas

Each area needs independent research before architecture design can be finalized. Research should produce an evaluation document with recommendations.

### 4.1 Backend Framework

**Question:** What's the right framework for decomposed services + open-source community contributions?

**Candidates:**
| Framework | Pros | Cons | Notes |
|-----------|------|------|-------|
| **NestJS** | Structured, modular, team knows it | Heavyweight, decorator-heavy DI, contributor barrier | Current choice |
| **Fastify** | Fast, lightweight, good plugin system | Less opinionated (pro and con), manual DI | Popular for microservices |
| **Hono** | Ultra-lightweight, edge-ready, multi-runtime | Very new, smaller ecosystem | Rising star |
| **Elysia** | Bun-native, fast, TypeScript-first | Bun dependency, very new | Interesting but risky |
| **Express 5** | Universal familiarity, huge ecosystem | Slow, minimal structure | Safe but uninspiring |

**Research should cover:**

- Developer experience for contributors (onboarding friction)
- Plugin/middleware ecosystem
- Performance benchmarks for the workload profile
- Community size and trajectory
- How well each handles the decomposed service pattern
- OpenAPI/Swagger generation support (for public API)
- WebSocket support (for real-time features)
- Testing patterns

### 4.2 ORM / Data Access

**Question:** What handles multi-tenant RLS + raw SQL + multiple services accessing the same database best?

**Candidates:**
| ORM | Pros | Cons | Notes |
|-----|------|------|-------|
| **Prisma** | Type-safe, good DX, mature migrations | Heavy client, `$executeRawUnsafe` hack for SET LOCAL, v7 breaking changes | Current choice |
| **Drizzle** | Lightweight, SQL-like syntax, great raw SQL | Newer, smaller ecosystem | Rising fast |
| **Kysely** | Type-safe query builder, minimal abstraction | No migration system (pair with separate tool) | Good middle ground |
| **TypeORM** | Feature-rich, decorators | Performance issues, complex, losing mindshare | Declining |
| **Raw pg + pgtyped** | Maximum control, zero abstraction | More boilerplate, manual type safety | For purists |

**Research should cover:**

- RLS/SET LOCAL support (critical for multi-tenancy)
- Migration system quality
- Performance with connection pooling (PgBouncer)
- Generated client size and startup time
- Multi-service shared schema support
- Community adoption trajectory
- How well each works with the chosen framework

### 4.3 Auth Service

**Question:** What self-hostable auth service handles federation, OAuth, SSO, and can be deployed alongside Colophony?

**Candidates:**
| Service | Pros | Cons | Notes |
|---------|------|------|-------|
| **Keycloak** | Feature-complete, OIDC/SAML/social, mature | Java (heavy), complex config, resource-hungry | Industry standard |
| **Zitadel** | Go (lightweight), modern, good DX, self-hosted | Younger, smaller community | Promising |
| **Ory (Kratos + Hydra)** | Modular, Go, headless, API-first | Complex multi-component setup | Most flexible |
| **Logto** | Node.js, modern UI, good DX | Younger, less battle-tested | Closest to Colophony's stack |
| **Authentik** | Python, modern, full-featured | Python (different stack), resource usage | Strong self-hosted option |
| **SuperTokens** | Node.js, lightweight, easy integration | Less feature-rich for enterprise SSO | Simplest option |

**Research should cover:**

- Federation support (critical — can it handle cross-instance identity?)
- Self-hosted resource requirements (memory/CPU for a Docker Compose stack)
- OAuth provider support (Google, GitHub, plus custom)
- SAML SSO support (for institutional users)
- Customization of login/signup flows
- API quality for programmatic user management
- Community size and maintenance trajectory
- How well it integrates with the chosen framework

### 4.4 Managed Hosting Orchestration

**Question:** What orchestration platform is right for a small team running multi-tenant managed hosting?

**Candidates:**
| Platform | Pros | Cons | Notes |
|----------|------|------|-------|
| **Kubernetes (managed)** | Standard, mature, auto-scaling, huge ecosystem | Complex, high ops overhead, expensive | GKE, EKS, DigitalOcean K8s |
| **Fly.io** | Simple, global edge, built-in scaling | Vendor lock-in, pricing unpredictable at scale | Great DX |
| **Railway** | Simple, git-push deploys, good DX | Less control, smaller scale ceiling | Good for starting |
| **Coolify** | Open-source, self-hosted PaaS, Docker-based | Newer, one-person project risk | Fits open-source philosophy |
| **Docker Swarm** | Simple, Docker-native, built-in | Limited ecosystem, Docker deprioritizing it | Simplest orchestrator |
| **Nomad (HashiCorp)** | Simpler than K8s, good for mixed workloads | Smaller ecosystem than K8s | Middle ground |
| **Kamal (37signals)** | Simple, SSH-based, Docker-native | Very opinionated, newer | Used by Hey/Basecamp |

**Research should cover:**

- Multi-tenant isolation (how to run multiple customer instances)
- Auto-scaling per service
- Cost at various scales (10, 100, 1000 customers)
- Ops burden for a 1-2 person team
- Secret management
- Database per-tenant vs shared database implications
- Monitoring and observability
- Disaster recovery and backup automation

### 4.5 API Layer Architecture

**Question:** How to expose REST + GraphQL public APIs alongside internal tRPC?

**Research should cover:**

- Schema-first vs code-first GraphQL (Pothos, Nexus, TypeGraphQL, GraphQL Yoga)
- OpenAPI generation from code (for REST)
- How to share validation (Zod) across tRPC + REST + GraphQL
- Rate limiting and auth across multiple API surfaces
- API versioning strategy
- SDK generation for multiple languages (TypeScript, Python, Ruby, Go)
- How successful platforms (GitHub, Stripe, Linear) structure their APIs

### 4.6 Form Builder Architecture

**Question:** How should the drag-and-drop form builder be architected?

**Research should cover:**

- JSON schema-based form definition (industry standard approach)
- Existing open-source form builders: Formbricks, SurveyJS, Form.io, Typebot
- React DnD vs dnd-kit for drag-and-drop
- Conditional logic engine design
- Form rendering in embeddable widget context (framework-agnostic)
- How Submittable, Typeform, and Tally architect their builders
- File upload integration within form fields
- Accessibility (WCAG) for form builder UI and rendered forms

### 4.7 Federation Protocol

**Question:** How should cross-instance identity and communication work?

**Research should cover:**

- ActivityPub (Mastodon's protocol — decentralized, standard, but complex)
- Custom REST-based federation (simpler, but proprietary)
- OAuth2-based federation (instances as OAuth providers to each other)
- Matrix protocol (decentralized communication, may be overkill)
- What Mastodon, Lemmy, and Pixelfed learned about federation challenges
- Identity portability (moving an account between instances)
- Simultaneous submission enforcement across instances (novel requirement)
- Privacy implications of cross-instance data sharing
- How to handle instance discovery and trust

### 4.8 Plugin / Extension System

**Question:** How should Colophony handle plugins and extensions for an open-source ecosystem?

**Research should cover:**

- WordPress hooks/filters model (most successful plugin ecosystem ever)
- Strapi plugin architecture (modern, TypeScript)
- Ghost integrations model
- OJS plugin system (closest domain match — academic publishing)
- Grafana plugin architecture (modern, React-based)
- VS Code extension model (sandboxed, marketplace)
- Hook-based vs adapter-based vs event-based extension patterns
- Plugin marketplace/registry considerations
- Security implications of third-party plugins
- How to version plugin APIs without breaking changes

---

## 5. Research Results

> Research results will be added here as each area is investigated.

### 5.1 Backend Framework

> **Researched:** 2026-02-11
> **Status:** Complete — recommendation provided
> **Critical requirement:** Open-source contributor friendliness, decomposed service support, GraphQL + REST + tRPC, WebSocket for editorial collaboration

#### Candidates Evaluated

| Criterion                   | NestJS 11                      | Fastify 5                 | Hono 4                   | Elysia 1.4              | Express 5                |
| --------------------------- | ------------------------------ | ------------------------- | ------------------------ | ----------------------- | ------------------------ |
| **GitHub Stars**            | ~74.5k                         | ~35.6k                    | ~28.7k                   | ~16.9k                  | ~68.3k                   |
| **npm Downloads/week**      | ~6.4M                          | ~5.1M                     | ~9.5M                    | ~323k                   | ~43M                     |
| **Onboarding Friction**     | High (decorators, DI, modules) | Low-Medium                | Very Low                 | Medium (Bun-coupled)    | Very Low                 |
| **Plugin Ecosystem**        | Excellent                      | Excellent                 | Good (growing)           | Small                   | Huge (uneven quality)    |
| **Performance (realistic)** | Good (w/ Fastify adapter)      | Very Good (~70-80k req/s) | Excellent                | Uncertain (regressions) | Adequate (~20-30k req/s) |
| **Decomposed Services**     | Excellent (standalone apps)    | Good (plugin system)      | Fair (HTTP only)         | Fair (Bun-coupled)      | Poor (no structure)      |
| **OpenAPI Generation**      | Excellent (decorators)         | Excellent (JSON Schema)   | Good (Zod-based)         | Good                    | Poor (manual JSDoc)      |
| **GraphQL Support**         | Excellent (Apollo/Mercurius)   | Excellent (Mercurius)     | Good (Yoga/graphql-http) | Fair (Yoga plugin)      | Fair (Apollo middleware) |
| **tRPC Integration**        | Good (nestjs-trpc)             | Good (official adapter)   | Good (@hono/trpc-server) | Fair (Eden preferred)   | Good (official adapter)  |
| **WebSocket Support**       | Excellent (Socket.io/ws)       | Good (@fastify/websocket) | Fair (@hono/node-ws)     | Good (Bun native)       | Fair (express-ws)        |
| **BullMQ Integration**      | Excellent (@nestjs/bullmq)     | Fair (community plugin)   | Fair (manual)            | Fair (manual)           | Fair (manual)            |
| **Worker Service Support**  | Excellent (standalone)         | None (manual)             | None (manual)            | None (manual)           | None (manual)            |
| **Testing**                 | Excellent (DI mocking)         | Good (inject, manual DI)  | Good (testClient)        | Good (Eden unit test)   | Adequate (supertest)     |
| **Maturity**                | Very High                      | Very High                 | Medium-High              | Low                     | High (stale governance)  |

#### Recommendation: Fastify 5

**Score: Best overall balance across Colophony's requirements.**

Fastify strikes the optimal balance of contributor friendliness, ecosystem completeness, performance, and maturity for an open-source project:

1. **Contributor friendliness.** Express-like API with a clear plugin system. No decorators, no DI framework, no class hierarchies. Code reads linearly. Contributors don't need to learn NestJS module system.

2. **Ecosystem completeness.** Mercurius for GraphQL (Federation, JIT, subscriptions), `@fastify/swagger` for OpenAPI, `@fastify/websocket` for real-time, and the official tRPC adapter. Ecosystem is maintained by the Fastify organization.

3. **Performance.** ~70-80k req/s baseline, 2.3x more throughput than Express with realistic workloads. Lower memory footprint supports running multiple services on a single host.

4. **Monorepo decomposition.** Plugin encapsulation model maps naturally to shared packages. Each service is an independent Fastify app. Shared plugins (auth, database context, RLS middleware) live in `packages/`.

5. **OpenAPI generation.** `@fastify/swagger` auto-generates specs from JSON Schema route definitions. `fastify-type-provider-zod` bridges existing Zod schemas to Fastify's schema system — single source for validation + docs.

6. **Maturity.** OpenJS Foundation project, maintained by Node.js TSC members (Matteo Collina). LTS policy, weekly releases. Used by Microsoft, Hotstar in production.

#### Worker Services

BullMQ workers should be plain Node.js processes (e.g., `apps/workers/`) importing shared packages (`packages/db`, `packages/types`). This is the same pattern used by Hono, Elysia, and Express — only NestJS provides a unified framework for both HTTP and worker services.

**[Senior dev review]:** To avoid losing plugin encapsulation benefits for workers:

1. **Extract `packages/worker-base`** — a shared foundation providing logging, DB access (with RLS context), graceful shutdown, error reporting, and consistent patterns across all worker services.
2. **Use Fastify for worker observability** — each worker spins up a lightweight Fastify instance exposing `/health` and `/metrics` endpoints. This gives Coolify something to probe and Prometheus something to scrape, while BullMQ handles actual queue processing. Minimal overhead.

#### Migration Path from NestJS (Prospector v1)

Not a rewrite — a gradual decomposition:

1. **Extract shared packages** (`packages/db`, `packages/types`, `packages/auth`) — already done in v1
2. **New services** start as Fastify apps importing shared packages
3. **Existing NestJS Core API** continues running while new services are built with Fastify
4. **Gradually migrate** NestJS routes to Fastify as services are decomposed

This hybrid approach avoids a big-bang rewrite while establishing Fastify as the standard for new services.

#### Honorable Mention: Hono 4

Strongest choice for **maximum contributor simplicity**. Consider if:

- Lowest barrier to entry is the overriding priority
- Edge deployment becomes a future requirement
- Zod-OpenAPI integration aligns well with existing `@colophony/types`

#### Not Recommended

- **Elysia 1.4:** Bun runtime coupling, beta Node.js adapter, 45.7x performance regression in v1.4, small ecosystem (~323k downloads/week vs 5M+ for Fastify). Too risky for open-source.
- **Express 5:** Insufficient structure for multi-service architecture. Worst performance, no built-in schema validation, manual OpenAPI, slow governance (10 years between v4 and v5).

#### Sources

- [NestJS 11 Announcement (Trilon)](https://trilon.io/blog/announcing-nestjs-11-whats-new)
- [Fastify Benchmarks](https://fastify.dev/benchmarks/)
- [Fastify Plugin System Guide (NearForm)](https://nearform.com/digital-community/the-complete-guide-to-fastify-plugin-system/)
- [Hono Benchmarks](https://hono.dev/docs/concepts/benchmarks)
- [Elysia Performance Regression Issue #1604](https://github.com/elysiajs/elysia/issues/1604)
- [Express 5.1 Release](https://expressjs.com/2025/03/31/v5-1-latest-release.html)
- [Mercurius GraphQL](https://mercurius.dev/)
- [Hono vs Fastify (BetterStack)](https://betterstack.com/community/guides/scaling-nodejs/hono-vs-fastify/)
- [NestJS vs Fastify Performance (BetterStack)](https://betterstack.com/community/guides/scaling-nodejs/nestjs-vs-fastify/)

### 5.2 ORM / Data Access

> **Researched:** 2026-02-11
> **Status:** Complete — recommendation provided
> **Critical requirement:** PostgreSQL RLS via `SET LOCAL` inside transactions

#### Current State (MVP Baseline)

The MVP uses **Prisma 5.22** with a custom `withOrgContext()` wrapper in `packages/db/src/context.ts`. This function:

1. Validates UUIDs to prevent SQL injection
2. Opens a `$transaction`
3. Calls `$executeRawUnsafe` to run `SET LOCAL app.current_org` and `SET LOCAL app.user_id`
4. Executes the caller's query function within that transaction
5. Transaction commit automatically clears the `SET LOCAL` variables

This works, but `$executeRawUnsafe` is not parameterizable for `SET LOCAL` (Prisma limitation), requiring manual UUID validation as a SQL injection safeguard. The pattern is documented as a "hack" in the codebase and CLAUDE.md.

---

#### Candidate 1: Prisma (Current — v5.22, with v7 released)

**RLS / SET LOCAL Support: MODERATE (workaround required)**

Prisma still does not natively support `SET LOCAL` or `set_config()` as first-class operations. The current `$executeRawUnsafe` pattern continues to work. Prisma Client Extensions (`$allOperations`) offer a cleaner alternative using `set_config()`:

```typescript
// Prisma Client Extensions approach (available since v4.16+)
function forTenant(tenantId: string, userId: string) {
  return Prisma.defineExtension((prisma) =>
    prisma.$extends({
      query: {
        $allModels: {
          async $allOperations({ args, query }) {
            const [, result] = await prisma.$transaction([
              prisma.$executeRaw`SELECT set_config('app.current_org', ${tenantId}, TRUE)`,
              prisma.$executeRaw`SELECT set_config('app.user_id', ${userId}, TRUE)`,
              query(args),
            ]);
            return result;
          },
        },
      },
    }),
  );
}

// Usage
const tenantPrisma = prisma.$extends(forTenant(orgId, userId));
const submissions = await tenantPrisma.submission.findMany();
```

This is cleaner than the current `withOrgContext()` because `set_config()` with the third parameter `TRUE` is equivalent to `SET LOCAL` (transaction-scoped), and `$executeRaw` supports parameterized queries (no SQL injection risk). However, it wraps every single query in a transaction, which has performance implications.

The existing `withOrgContext()` pattern remains valid and is arguably more explicit about when RLS context is active.

**Migration system:** Prisma Migrate is mature with forward-only migrations, `prisma db push` for prototyping, and `prisma migrate resolve` for production issues. No automatic rollback generation. The Prisma schema DSL is declarative and readable but cannot express RLS policies, triggers, or custom functions — these must be managed in separate SQL files (as the MVP already does with `rls-policies.sql`).

**Performance / bundle size:** Prisma 7 (released late 2025) eliminates the Rust query engine binary, reducing bundle size by ~90% and eliminating serverless cold-start penalties. The generated client is now pure TypeScript. For v2, this largely resolves the historic "heavy client" complaint. Pre-v7, the client was ~6.5 MB installed; post-v7 it is comparable to Drizzle for deployed size.

**Connection pooling:** Works with PgBouncer in transaction pooling mode. Prisma Accelerate offers managed pooling. No known issues with the `SET LOCAL` pattern and PgBouncer since `SET LOCAL` is transaction-scoped.

**Multi-service shared schema:** Prisma requires a single `schema.prisma` file per client instance. Multiple services sharing the same database each need their own copy of the schema (or a shared package generating the client, as the MVP does with `packages/db`). Prisma does not support multiple services contributing partial schemas to the same database — one schema must be the canonical source. This is workable in a monorepo (shared `packages/db` package) but becomes friction if services have independent release cycles.

**JSON/JSONB support:** Good. Prisma supports `Json` type natively, with filtering via `path` and `equals` operators. For complex JSONB operations (containment with `@>`, path queries), raw SQL is needed.

**Type safety:** Excellent. Generated types from the schema file provide compile-time safety for all standard queries. Raw SQL queries are untyped by default; Prisma TypedSQL (added in v5.19) provides type-safe raw SQL but requires `.sql` files and a codegen step.

**Transaction support:** Interactive transactions (`$transaction(async (tx) => {...})`) and batch transactions (`$transaction([...])`). No native savepoint support. Nested transactions are not supported.

**Full-text search:** Prisma supports PostgreSQL full-text search via `search` filter (requires `previewFeatures = ["fullTextSearch"]`). Works with `tsvector` columns but the support is limited compared to raw SQL.

**Community:** ~5.1M weekly npm downloads, ~43.8K GitHub stars. Largest TypeScript ORM community. Extensive documentation and ecosystem. Active development with regular releases.

**Verdict:** Prisma remains a viable option, especially with v7's improvements. The RLS workaround is stable and well-understood. The main weaknesses are: (1) RLS requires workarounds rather than native support, (2) the schema DSL cannot express database-level features like RLS policies, triggers, or functions, (3) multi-service schema sharing requires careful monorepo coordination.

---

#### Candidate 2: Drizzle ORM

**RLS / SET LOCAL Support: EXCELLENT (first-class)**

Drizzle provides the most natural `SET LOCAL` support of any candidate. The `sql` template tag works directly inside transactions, and Drizzle has first-class RLS policy definitions via `pgPolicy`:

```typescript
// Schema definition with RLS policies (Drizzle-managed)
import { sql } from "drizzle-orm";
import { pgTable, pgPolicy, uuid, text, timestamp } from "drizzle-orm/pg-core";

export const submissions = pgTable(
  "submissions",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    organizationId: uuid("organization_id").notNull(),
    title: text("title").notNull(),
    createdAt: timestamp("created_at").defaultNow(),
  },
  (table) => [
    pgPolicy("org_isolation", {
      as: "permissive",
      for: "all",
      using: sql`organization_id = current_org_id()`,
      withCheck: sql`organization_id = current_org_id()`,
    }),
  ],
);

// withOrgContext equivalent — clean, no hacks
import { sql } from "drizzle-orm";
import { db } from "./client";

async function withOrgContext<T>(
  orgId: string,
  userId: string,
  fn: (tx: typeof db) => Promise<T>,
): Promise<T> {
  validateUuid(orgId, "orgId");
  validateUuid(userId, "userId");

  return db.transaction(async (tx) => {
    await tx.execute(sql`SELECT set_config('app.current_org', ${orgId}, TRUE)`);
    await tx.execute(sql`SELECT set_config('app.user_id', ${userId}, TRUE)`);
    return fn(tx);
  });
}

// Usage
const results = await withOrgContext(orgId, userId, async (tx) => {
  return tx
    .select()
    .from(submissions)
    .where(eq(submissions.status, "SUBMITTED"));
});
```

Key advantage: `sql` template tag provides parameterized queries for `set_config()` calls — no `$executeRawUnsafe` needed, no manual UUID validation for SQL injection prevention (though UUID validation for business logic is still recommended). The `pgPolicy` definitions in the schema mean RLS policies are version-controlled alongside the table definitions and included in migrations.

**Migration system:** Drizzle Kit generates SQL migration files from schema diffs (TypeScript schema is the source of truth). Forward migrations are generated automatically. **No automatic rollback/down migration generation** — rollbacks require manually writing a new forward migration that reverses changes. This is a notable gap compared to Kysely. The `drizzle-kit push` command supports rapid prototyping by pushing schema changes directly. Migration files are plain SQL, which is excellent for review and manual editing (e.g., adding data migrations, custom SQL).

**Performance / bundle size:** ~57 KB runtime, ~7.4 KB minified+gzipped. Zero binary dependencies. The smallest footprint of any candidate with ORM-like features. Cold starts under 500ms (vs 1-3s for pre-v7 Prisma). Benchmarks show Drizzle is 1.5-2x faster than Prisma for complex queries with joins, and comparable for simple queries.

**Connection pooling:** Compatible with PgBouncer in transaction pooling mode (the `SET LOCAL`/`set_config(..., TRUE)` pattern is transaction-scoped). Note: prepared statements require PgBouncer session mode; Drizzle can disable prepared statements for transaction-mode PgBouncer compatibility. Use separate direct connections for migrations.

**Multi-service shared schema:** Drizzle schemas are TypeScript files that can be shared as a package in a monorepo. Multiple services can import from a shared `packages/db` package. The TypeScript-first schema definition makes this very natural — services can import specific tables/types they need. Drizzle supports multiple PostgreSQL schemas (`withSchema()`). The monorepo pattern is well-documented with Turborepo and pnpm workspaces.

**JSON/JSONB support:** Supports `json()` and `jsonb()` column types with `.$type<T>()` for TypeScript type inference. Native JSONB query operators (`@>`, `->>`, etc.) require using the `sql` template tag — there is no type-safe JSONB query builder API. This is a known gap with an open feature request. For the form builder data model, complex JSONB queries will need raw SQL fragments.

**Type safety:** Very strong. Schema defined in TypeScript provides compile-time types for all queries. The relational query API provides Prisma-like ergonomics for nested includes. Raw SQL via `sql` template tag preserves parameterization but loses type safety (return types must be cast).

**Transaction support:** Full transaction support with `db.transaction(async (tx) => {...})`. Nested transactions use savepoints internally — `tx.transaction(...)` inside a transaction issues a `SAVEPOINT` and `ROLLBACK TO SAVEPOINT` on error. This is more capable than Prisma.

**Full-text search:** Not natively supported as a column type, but Drizzle provides official documentation for implementing full-text search with custom `tsvector` types and `sql` template tags. Generated columns with `tsvector` are supported. GIN index creation is supported in migrations.

**Community:** ~4.2M weekly npm downloads, ~32.7K GitHub stars. The fastest-growing TypeScript ORM. Active development with frequent releases. Strong community engagement on Discord and GitHub. Documentation quality is good and improving. Backed by a funded team.

**Verdict:** Drizzle is the strongest candidate for Colophony. It provides the most natural RLS support, the smallest runtime footprint, excellent performance, and a TypeScript-first approach that aligns well with the monorepo multi-service architecture. The main weaknesses are: (1) no automatic rollback migrations, (2) JSONB query operators require raw SQL fragments, (3) younger ecosystem than Prisma.

---

#### Candidate 3: Kysely

**RLS / SET LOCAL Support: EXCELLENT (first-class)**

Kysely is a query builder (not an ORM), and its `sql` template tag works naturally inside transactions for `SET LOCAL`:

```typescript
import { Kysely, sql } from "kysely";

// Database type (generated from DB introspection or manually defined)
interface Database {
  submissions: {
    id: string;
    organization_id: string;
    title: string;
    status: "DRAFT" | "SUBMITTED" | "UNDER_REVIEW" | "ACCEPTED" | "REJECTED";
    created_at: Date;
  };
}

const db = new Kysely<Database>({ dialect: postgresDialect });

// withOrgContext equivalent
async function withOrgContext<T>(
  orgId: string,
  userId: string,
  fn: (trx: Transaction<Database>) => Promise<T>,
): Promise<T> {
  return db.transaction().execute(async (trx) => {
    await sql`SELECT set_config('app.current_org', ${orgId}, TRUE)`.execute(
      trx,
    );
    await sql`SELECT set_config('app.user_id', ${userId}, TRUE)`.execute(trx);
    return fn(trx);
  });
}

// Usage
const results = await withOrgContext(orgId, userId, async (trx) => {
  return trx
    .selectFrom("submissions")
    .selectAll()
    .where("status", "=", "SUBMITTED")
    .execute();
});
```

Like Drizzle, the `sql` template tag provides safe parameterization. No hacks required. The transaction API is clean and explicit.

**Migration system:** Kysely provides a built-in migration system with `up()` and `down()` methods — the only candidate with first-class rollback support. Migrations are TypeScript files using the Kysely query builder, which means they are type-checked. The `Migrator` class provides `migrateUp()`, `migrateDown()`, and `migrateTo()` methods. Migration concurrency is handled via a `kysely_migration_lock` table. The `allowUnorderedMigrations` option supports parallel development in teams. This is the strongest migration system of any candidate.

**Performance / bundle size:** ~2 MB installed. Minimal abstraction over `pg` driver — essentially a type-safe query builder that generates SQL and delegates to the underlying driver. Performance is on par with raw `pg` queries. No binary dependencies.

**Connection pooling:** Uses the underlying `pg` Pool directly. Full PgBouncer compatibility in all modes. No additional abstraction layer to cause issues.

**Multi-service shared schema:** Kysely types can be generated from database introspection via `kysely-codegen`, or defined manually, or generated from a Prisma schema via `prisma-kysely`. The introspection-based approach is ideal for multi-service architectures: each service generates its types from the live database, ensuring they are always in sync with the actual schema. Services do not need to share schema definition files — they each introspect independently. This is the most flexible approach for decomposed services.

**JSON/JSONB support:** Supports `json` and `jsonb` types. `JSONColumnType<T>` wrapper provides type safety for JSON columns. PostgreSQL JSON operators can be used via `sql` template tag or custom expression builders. Custom expressions for JSONB operations require more boilerplate than Drizzle but are fully type-safe.

**Type safety:** Strong compile-time type safety for all queries via the database type interface. Column names, table names, and join conditions are all type-checked. Raw SQL via `sql` template tag requires explicit type annotations for return values.

**Transaction support:** Full transaction support with `db.transaction().execute(async (trx) => {...})`. Supports savepoints via `ControlledTransaction` with explicit `savepoint()`, `rollbackToSavepoint()`, and `releaseSavepoint()` methods. The savepoint API is more explicit and powerful than Drizzle's implicit nested transactions. However, nested `trx.transaction()` calls (which would auto-manage savepoints) are not yet supported.

**Full-text search:** No built-in `tsvector` support, but PostgreSQL full-text search functions and operators are accessible via the `sql` template tag. Same approach as Drizzle — custom SQL fragments for search queries.

**Community:** ~1.2M weekly npm downloads, ~12.8K GitHub stars. Smaller community than Prisma or Drizzle, but growing steadily. Used in production by notable companies (Maersk, Supabase edge functions). Endorsed by members of the TypeScript team. Good documentation. Stable API with infrequent breaking changes.

**No schema definition language:** Kysely does not define the database schema — it only queries it. Schema management must be handled via migrations (which use the query builder) or an external tool. This means RLS policies, functions, triggers, and indexes must be defined in migration files. This is less convenient than Drizzle's `pgPolicy` but more honest about what the application code should own.

**Verdict:** Kysely is excellent for the RLS pattern and offers the best migration system. Its introspection-based type generation is ideal for multi-service architectures. The main weaknesses are: (1) smaller community, (2) no schema DSL (all structure in migrations), (3) more verbose than Drizzle for common queries, (4) requires a separate tool or migrations for schema definition.

---

#### Candidate 4: TypeORM

**RLS / SET LOCAL Support: MODERATE (workaround required)**

TypeORM supports raw SQL execution within transactions via `QueryRunner`:

```typescript
import { DataSource } from "typeorm";

async function withOrgContext<T>(
  dataSource: DataSource,
  orgId: string,
  userId: string,
  fn: (queryRunner: QueryRunner) => Promise<T>,
): Promise<T> {
  const queryRunner = dataSource.createQueryRunner();
  await queryRunner.connect();
  await queryRunner.startTransaction();

  try {
    await queryRunner.query(`SET LOCAL app.current_org = '${orgId}'`);
    await queryRunner.query(`SET LOCAL app.user_id = '${userId}'`);
    const result = await fn(queryRunner);
    await queryRunner.commitTransaction();
    return result;
  } catch (err) {
    await queryRunner.rollbackTransaction();
    throw err;
  } finally {
    await queryRunner.release();
  }
}
```

This works but has the same manual `SET LOCAL` string interpolation issue as Prisma's `$executeRawUnsafe`. The `queryRunner.query()` method does support parameterized queries, but `SET LOCAL` cannot be parameterized in PostgreSQL. The pattern requires explicit connect/start/commit/rollback/release boilerplate.

There is a known issue (GitHub #5857) with ensuring all connections in a pool have the correct tenant context set, which makes RLS with connection pooling fragile. TypeORM does not have an equivalent to Prisma's Client Extensions for automatically injecting RLS context into all queries.

**Migration system:** TypeORM has a built-in migration system with `up()` and `down()` methods, automatic migration generation from entity changes, and CLI tooling. Migrations are TypeScript files. The migration system is mature but has known issues with complex schema changes (especially with enums and composite types). Migration generation can produce incorrect SQL for some PostgreSQL-specific features.

**Performance / bundle size:** ~8 MB installed. Uses decorators and reflection metadata heavily, which adds overhead. Performance benchmarks consistently show TypeORM as 1.5-2x slower than Drizzle/Kysely for equivalent queries due to the heavy abstraction layer. The decorator-based approach generates significant runtime metadata.

**Connection pooling:** Uses the underlying `pg` Pool. Compatible with PgBouncer but the `SET LOCAL` pattern requires careful management — TypeORM's connection management can make it difficult to guarantee a specific connection is used for the entire transaction.

**Multi-service shared schema:** TypeORM entities are TypeScript classes with decorators. These can be shared in a monorepo package. However, TypeORM's reliance on decorators and `reflect-metadata` makes the setup more complex than Drizzle or Kysely. Multiple services need identical entity configurations, and TypeORM's eager initialization can cause issues with partial schema loading.

**JSON/JSONB support:** Supports `json` and `jsonb` column types via the `@Column({ type: 'jsonb' })` decorator. Querying JSONB requires raw SQL or TypeORM's limited `JsonContains` operator. The query builder support for JSONB operations is weaker than Prisma's.

**Type safety:** Moderate. TypeORM provides type information via entity classes, but the query builder is not fully type-safe — incorrect column names in `.where()` conditions are not caught at compile time in many cases. The Active Record and Data Mapper patterns both have type gaps.

**Transaction support:** Supports transactions via `QueryRunner` (explicit) or `DataSource.transaction()` (callback). Savepoints are supported. Nested transactions automatically use savepoints. This is one of TypeORM's strengths.

**Community:** ~3M weekly npm downloads, ~36K GitHub stars. Still widely used, especially in NestJS projects (due to `@nestjs/typeorm`). However, the project's trajectory is concerning — version 1.0 has been planned "for the first half of 2026" and the project has a long history of delayed releases. Many developers are migrating away to Drizzle or Prisma.

**Verdict:** TypeORM is not recommended for Colophony. The RLS pattern is workable but fragile with connection pooling. Performance is the weakest of all candidates. The project's trajectory is declining, and the decorator-heavy approach adds contributor friction. The only advantage is NestJS integration, which is irrelevant if the framework is also under evaluation.

---

#### Candidate 5: Raw pg + pgtyped

**RLS / SET LOCAL Support: PERFECT (native SQL)**

With raw `pg`, there is no abstraction between the application and PostgreSQL. `SET LOCAL` is just another SQL statement:

```typescript
import { Pool } from "pg";

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function withOrgContext<T>(
  orgId: string,
  userId: string,
  fn: (client: PoolClient) => Promise<T>,
): Promise<T> {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query(`SELECT set_config('app.current_org', $1, TRUE)`, [
      orgId,
    ]);
    await client.query(`SELECT set_config('app.user_id', $1, TRUE)`, [userId]);
    const result = await fn(client);
    await client.query("COMMIT");
    return result;
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
}

// Usage
const results = await withOrgContext(orgId, userId, async (client) => {
  const { rows } = await client.query(
    "SELECT * FROM submissions WHERE status = $1",
    ["SUBMITTED"],
  );
  return rows;
});
```

This is the cleanest possible implementation: fully parameterized, no string interpolation, no abstractions to work around. `set_config()` with `$1` parameter binding is supported natively.

**pgtyped** was intended to add type safety to raw SQL by generating TypeScript types from `.sql` files by introspecting the database. However, **pgtyped is effectively abandoned** — the npm package (`pgtyped`) shows ~984 weekly downloads, the latest version is 0.0.1 published 5+ years ago, and the project is flagged as inactive. The main repository (`adelsz/pgtyped`) has stalled.

**Alternatives for type-safe raw SQL:**

- **SafeQL**: An ESLint plugin that validates raw SQL queries at lint time by connecting to a running database. It works with any PostgreSQL client (`pg`, Prisma raw SQL, Kysely raw SQL). ~10K weekly downloads. Actively maintained. Does not generate types but catches errors in the IDE.
- **Prisma TypedSQL**: Type-safe raw SQL via `.sql` files with Prisma's codegen. Tied to the Prisma ecosystem.
- **@databases/pg**: A lightweight typed wrapper around `pg` with tagged template SQL queries. Small but maintained.

**Migration system:** None. A separate migration tool is required: `node-pg-migrate`, `graphile-migrate`, `dbmate`, or custom migration scripts. This adds significant setup overhead and means the migration tool is decoupled from the query layer.

**Performance / bundle size:** `pg` is ~170 KB. The smallest possible footprint. Maximum performance — zero overhead between application code and PostgreSQL wire protocol.

**Connection pooling:** `pg.Pool` is the reference implementation that all other tools eventually delegate to. PgBouncer compatibility is perfect.

**Multi-service shared schema:** Types would need to be generated from the database (via introspection) or hand-maintained. There is no schema definition language. For a multi-service architecture, each service would maintain its own type definitions or share generated types from a common package. This is the most labor-intensive approach.

**JSON/JSONB support:** Full access to all PostgreSQL JSON/JSONB operators and functions — it is raw SQL. No type safety for JSON operations unless using SafeQL or manually typed helper functions.

**Type safety:** Without pgtyped (abandoned), type safety is manual. SafeQL can be used for lint-time validation, or result types defined manually and cast. This is significantly worse DX than any ORM/query builder option. The team would need to maintain type definitions for every query.

**Transaction support:** Full control over transactions, savepoints, and any PostgreSQL transaction feature. Maximum flexibility at the cost of maximum boilerplate.

**Community:** `pg` has ~8M+ weekly downloads and is the foundation all other tools build on. However, the "raw pg" approach has no community in the sense of shared patterns, documentation, or best practices — each team implements its own conventions.

**Verdict:** Raw `pg` provides perfect RLS support but is not recommended as the primary data access layer for Colophony. The maintenance burden of manual type definitions, lack of migration system, and significant boilerplate for every query would slow development considerably. However, the `pg` driver is the right foundation — tools like Drizzle and Kysely build on `pg` and preserve access to raw SQL when needed.

---

#### Summary Comparison Table

| Criterion                | Prisma                                         | Drizzle                                 | Kysely                                   | TypeORM                             | Raw pg                   |
| ------------------------ | ---------------------------------------------- | --------------------------------------- | ---------------------------------------- | ----------------------------------- | ------------------------ |
| **RLS/SET LOCAL**        | Workaround (`$executeRawUnsafe` or extensions) | Native (`sql` tag + `pgPolicy`)         | Native (`sql` tag in transactions)       | Workaround (`queryRunner.query`)    | Native (raw SQL)         |
| **RLS policy in schema** | No (separate SQL file)                         | Yes (`pgPolicy` in table def)           | No (in migrations)                       | No (separate SQL)                   | No (separate SQL)        |
| **Migration system**     | Prisma Migrate (forward-only, mature)          | Drizzle Kit (forward-only, no rollback) | Built-in up/down (best rollback support) | Built-in up/down (mature but buggy) | None (BYO tool)          |
| **Bundle size**          | ~1.5 MB (v7) / ~6.5 MB (v5)                    | ~57 KB runtime                          | ~2 MB                                    | ~8 MB                               | ~170 KB                  |
| **Query performance**    | Good (v7 improved 3x)                          | Excellent (fastest ORM)                 | Excellent (near-raw)                     | Moderate (heaviest)                 | Maximum (no overhead)    |
| **PgBouncer compat**     | Good (transaction mode)                        | Good (disable prepared stmts)           | Excellent (direct pg)                    | Fragile (connection mgmt issues)    | Excellent (direct pg)    |
| **Multi-service schema** | Shared package (monorepo)                      | Shared package (natural TS imports)     | DB introspection per service             | Shared entities (complex)           | Manual types per service |
| **JSON/JSONB queries**   | Good (path/equals operators)                   | Basic (raw SQL for operators)           | Basic (custom expressions)               | Basic (raw SQL)                     | Full (raw SQL)           |
| **Type safety**          | Excellent (generated)                          | Very strong (schema-derived)            | Strong (interface-based)                 | Moderate (decorator gaps)           | Manual only              |
| **Nested transactions**  | Not supported                                  | Savepoints (implicit)                   | Savepoints (explicit, powerful)          | Savepoints (supported)              | Full manual control      |
| **Full-text search**     | Preview feature                                | Custom type + sql tag                   | sql tag                                  | Raw SQL                             | Raw SQL                  |
| **npm weekly downloads** | ~5.1M                                          | ~4.2M                                   | ~1.2M                                    | ~3M                                 | ~8M+ (pg driver)         |
| **GitHub stars**         | ~43.8K                                         | ~32.7K                                  | ~12.8K                                   | ~36K                                | N/A                      |
| **Trajectory**           | Stable/mature                                  | Rapid growth                            | Steady growth                            | Declining                           | Stable (foundation)      |
| **Contributor DX**       | Easy (schema DSL)                              | Easy (TS schema)                        | Moderate (query builder)                 | Moderate (decorators)               | Hard (all manual)        |

---

#### Recommendation: Drizzle ORM

**Primary choice: Drizzle ORM** for the following reasons:

1. **Best-in-class RLS support.** The `sql` template tag inside `db.transaction()` provides clean, parameterized `set_config()` calls with zero hacks. The `pgPolicy` schema definition means RLS policies are version-controlled alongside table definitions in TypeScript — a significant improvement over separate SQL files. This is the #1 requirement and Drizzle handles it best of any ORM option.

2. **Smallest runtime footprint.** At ~57 KB, Drizzle is 25-100x smaller than the alternatives. This matters for Docker container startup, serverless deployments (if managed hosting uses edge functions), and development iteration speed.

3. **Best performance.** Benchmarks consistently show Drizzle generating the most efficient SQL, particularly for complex joins and relational queries. For a platform that will handle submission pipelines with multiple joins (org > publication > call > submission > reviews), this matters.

4. **Natural monorepo multi-service schema sharing.** TypeScript schema files in a shared `packages/db` package can be imported by any service. `InferSelectModel` and `InferInsertModel` provide convenient type inference. This aligns perfectly with the proposed monorepo structure.

5. **SQL-first philosophy.** Drizzle's query API is designed to be close to SQL, which means developers who know SQL can be productive immediately. For an open-source project seeking contributors, this lowers the onboarding barrier compared to Prisma's custom DSL or TypeORM's decorator patterns.

6. **Active development trajectory.** Drizzle is the fastest-growing TypeScript ORM with strong community momentum, funded development team, and regular releases. It is less likely to stagnate than TypeORM and more likely to add features (like native JSONB operators) than Kysely.

**Migration gap mitigation:** Drizzle's lack of automatic rollback migrations is its main weakness. Mitigation strategies:

- Use `drizzle-kit generate` to create forward migrations, and manually write rollback migrations for critical changes
- In production, prefer forward-only migrations (add columns, backfill, then remove old) rather than rollbacks
- Consider pairing Drizzle with Kysely's migration system for complex migration scenarios (Kysely migrations can use any SQL, and the migration runner is independent of the query layer)

**JSONB gap mitigation:** For the form builder data model, create typed helper functions that wrap the `sql` template tag for common JSONB operations:

```typescript
// packages/db/src/json-helpers.ts
import { sql, type SQL } from "drizzle-orm";

export function jsonContains(column: AnyColumn, value: unknown): SQL {
  return sql`${column} @> ${JSON.stringify(value)}::jsonb`;
}

export function jsonPath(column: AnyColumn, path: string): SQL {
  return sql`${column} #>> ${path}`;
}
```

**Second choice: Kysely** if the migration system quality is deemed more critical than DX and schema-level RLS definitions. Kysely's up/down migration system is genuinely superior, and its introspection-based type generation is the most flexible for multi-service architectures. A viable approach would be to use **Drizzle for schema definition and queries** with **Kysely's migration runner** for migration execution, though this adds complexity.

**Not recommended:** TypeORM (declining, fragile RLS, poor performance) and raw pg (too much boilerplate for a multi-contributor open-source project). Prisma remains viable if the team prefers its DX, but the `$executeRawUnsafe` pattern and inability to express RLS in the schema are real limitations that Drizzle solves.

---

#### Migration Path from MVP

If Drizzle is selected, the migration from Prisma involves:

1. **Schema translation:** Convert `schema.prisma` to Drizzle TypeScript schema files. The mapping is mostly 1:1 (models become `pgTable` calls, relations become explicit). RLS policies from `rls-policies.sql` are integrated into the schema via `pgPolicy`.

2. **Query rewriting:** Replace Prisma queries with Drizzle equivalents. The relational query API (`db.query.submissions.findMany({ with: { files: true } })`) covers most Prisma `include` patterns. Complex queries use the SQL-like select/join API.

3. **Context rewriting:** Replace `withOrgContext()` with a Drizzle equivalent (as shown in the code example above). The pattern is simpler and does not require `$executeRawUnsafe`.

4. **Migration baseline:** Use `drizzle-kit` to introspect the existing database and generate a baseline migration that matches the current schema. All subsequent changes use Drizzle's migration system.

5. **Test rewriting:** Unit tests that mock Prisma client need to be updated. E2E tests that use the database directly need minimal changes (the database is the same; only the query layer changes).

Estimated effort: 2-3 days for a focused conversion, given the MVP's moderate schema complexity (15 models, 8 enums).

---

#### Senior Dev Review Additions

**Rollback migration strategy:**

- Create a `scripts/rollback-templates/` directory with common rollback patterns (drop column, revert enum, restore table from backup)
- Document rollback strategy in `CONTRIBUTING.md`
- Consider Kysely's migration runner as a future hybrid if rollback complexity grows beyond manual scripts
- Production strategy: forward-only migrations with tested rollback templates for emergencies

**JSONB query helpers — expand for form builder:**

In addition to the `jsonContains` helper, add a `jsonPath` helper for the conditional logic engine queries (e.g., querying form definitions where a field has a specific conditional rule):

```typescript
// packages/db/src/json-helpers.ts
export function jsonPath(column: AnyColumn, path: string): SQL {
  return sql`${column} #>> ${path}::text[]`;
}
```

**Drizzle JSONB roadmap:** The Drizzle team is actively working on native JSONB operators ([#1690](https://github.com/drizzle-team/drizzle-orm/issues/1690)). Check their roadmap in Q2 2026 — if native support ships before v2 launch, the custom helpers become unnecessary. Track this as a "check before implementation" item.

---

#### Sources

- [Drizzle ORM - Row-Level Security (RLS)](https://orm.drizzle.team/docs/rls)
- [Drizzle ORM - Transactions](https://orm.drizzle.team/docs/transactions)
- [Drizzle ORM - Migrations](https://orm.drizzle.team/docs/migrations)
- [Drizzle ORM - PostgreSQL Full-Text Search](https://orm.drizzle.team/docs/guides/postgresql-full-text-search)
- [Drizzle ORM RLS Feature Discussion (#2450)](https://github.com/drizzle-team/drizzle-orm/discussions/2450)
- [Drizzle ORM Migration Rollback Feature (#2352)](https://github.com/drizzle-team/drizzle-orm/issues/2352)
- [Drizzle ORM Native JSONB Query Support (#1690)](https://github.com/drizzle-team/drizzle-orm/issues/1690)
- [Kysely - Raw SQL](https://kysely.dev/docs/recipes/raw-sql)
- [Kysely - Migrations](https://www.kysely.dev/docs/migrations)
- [Kysely - Controlled Transactions with Savepoints](https://kysely.dev/docs/examples/transactions/controlled-transaction-w-savepoints)
- [Kysely Codegen](https://github.com/RobinBlomberg/kysely-codegen)
- [Prisma Client Extensions](https://www.prisma.io/docs/orm/prisma-client/client-extensions)
- [Prisma 7 - 90% Smaller Bundles](https://www.mauryapatel.in/blogs/prisma-7-is-here-90-smaller-bundles-and-the-end-of-heavy-binaries)
- [Prisma SET LOCAL Issue (#5128)](https://github.com/prisma/prisma/issues/5128)
- [Prisma Multi-Schema Support](https://www.prisma.io/docs/orm/prisma-schema/data-model/multi-schema)
- [TypeORM RLS Issue (#5857)](https://github.com/typeorm/typeorm/issues/5857)
- [TypeORM 1.0 Release Plan (#11819)](https://github.com/typeorm/typeorm/issues/11819)
- [pgTyped (abandoned)](https://github.com/adelsz/pgtyped)
- [SafeQL - Type-Safe SQL Linting](https://safeql.dev/)
- [npm trends: drizzle-orm vs kysely vs prisma](https://npmtrends.com/drizzle-orm-vs-kysely-vs-prisma)
- [2025 TypeScript ORM Battle](https://levelup.gitconnected.com/the-2025-typescript-orm-battle-prisma-vs-drizzle-vs-kysely-007ffdfded67)
- [Drizzle vs Prisma Practical Comparison (2026)](https://designrevision.com/blog/prisma-vs-drizzle)
- [Neon - Modelling RLS with Drizzle ORM](https://neon.com/blog/modelling-authorization-for-a-social-network-with-postgres-rls-and-drizzle-orm)
- [NestJS + Prisma + PostgreSQL RLS Multi-tenancy](https://baudreligion.hashnode.dev/nestjs-prisma-postgresql-multi-tenancy)
- [Shared Database Schema with DrizzleORM and Turborepo](https://pliszko.com/blog/post/2023-08-31-shared-database-schema-with-drizzleorm-and-turborepo)

### 5.3 Auth Service

> **Researched:** 2026-02-11
> **Status:** Complete — recommendation provided

#### Context

Colophony needs an external authentication service that can handle:

- **Cross-instance federation** — a submitter on Instance A submitting to magazines on Instance B without re-registering
- **Self-hosted simplicity** — must fit in a Docker Compose stack on a VPS alongside PostgreSQL, Redis, MinIO, and application services
- **OAuth/social login** — Google, GitHub, and custom OIDC providers
- **SAML SSO** — for institutional users (university presses, large publishing houses)
- **Multi-tenancy** — organizations with independent auth settings
- **Programmable API** — for user provisioning, role management, and federation identity resolution
- **Open-source licensing** — compatible with distributing Colophony as open-source software

The current MVP uses custom JWT + refresh token auth via Passport.js. This works for a single instance but does not scale to federation, OAuth, or SSO.

#### Federation: The Core Challenge

None of these auth services natively solve Colophony's federation problem out of the box. Federation here means: a submitter creates an identity on Colophony Instance A, then authenticates to Colophony Instance B using that identity to submit to magazines hosted there — all without creating a new account on Instance B.

This is conceptually similar to how Mastodon uses ActivityPub for federated identity, but the actual mechanism is OIDC-based: each Colophony instance acts as both an OIDC Provider (issuing tokens for its local users) and an OIDC Relying Party (accepting tokens from other trusted instances). The auth service needs to support:

1. **Acting as an OIDC Provider** — issuing ID tokens that other instances can verify
2. **Acting as an OIDC Relying Party / Identity Broker** — accepting tokens from other Colophony instances as "social login" providers
3. **Dynamic trust establishment** — adding new trusted instances without restarting the service (ideally via OpenID Federation 1.0 or a custom discovery protocol)
4. **Identity linking** — mapping a federated identity to a local user record
5. **Programmatic IdP registration** — the Federation service needs to register new trusted instances as identity providers via API

All six candidates support OIDC Provider and Relying Party roles. The differentiators are how well they support **dynamic provider registration** (adding new trusted instances at runtime) and how feature-complete their **admin APIs** are for programmatic management.

---

#### Candidate Evaluations

##### 1. Keycloak

| Criterion           | Assessment                                           |
| ------------------- | ---------------------------------------------------- |
| **License**         | Apache 2.0 (CNCF Incubating project)                 |
| **Language**        | Java (JVM)                                           |
| **GitHub**          | ~30k stars, ~1,350 contributors                      |
| **Release cadence** | Quarterly major releases (e.g., 26.x series in 2025) |

**Resource requirements:**

- Base idle memory: ~1,000 MB RAM per pod
- With 10k cached sessions: ~1,250 MB RAM
- Minimum viable deployment: **1.5-2 GB RAM** allocated to Keycloak alone
- CPU: 1 vCPU handles ~15 password logins/sec
- Requires a separate PostgreSQL database (can share the same PostgreSQL server with a separate database)
- **Verdict: Heavy.** A small magazine VPS (2-4 GB RAM total) would struggle to run Keycloak alongside PostgreSQL, Redis, MinIO, and the Colophony services.

**Federation support:**

- Mature **Identity Brokering** — can authenticate users via external OIDC/SAML/social providers and link federated identities to local accounts
- Supports cross-Keycloak federation (Instance A users can authenticate through Instance B's Keycloak)
- Active work on **OpenID Federation 1.0** support (plugin available, spec at draft 36, working proof-of-concept for EU Digital Identity Framework)
- Dynamic client registration endpoint allows programmatic trust establishment
- **Verdict: Best federation story.** The most mature implementation of the building blocks needed. OpenID Federation 1.0 support is a significant forward-looking advantage.

**OAuth/social login:** Full support — Google, GitHub, Facebook, Apple, plus any generic OIDC or SAML provider. Extensive built-in connectors.

**SAML SSO:** Full SAML 2.0 support as both IdP and SP. This is Keycloak's strength — enterprise SSO is its primary use case.

**Multi-tenancy:** Keycloak 25+ introduced **Organizations** feature — multiple organizations within a single realm. Users can be members of multiple organizations with per-org roles. Domain-based IdP routing. The Phase Two open-source extension provides even richer multi-tenancy if needed.

**Customization:** Theming system for login/signup pages. Custom authentication flows via SPI (Service Provider Interface). Powerful but the customization model is complex (Freemarker templates, custom Java SPIs).

**API quality:** Comprehensive REST Admin API. Official `@keycloak/keycloak-admin-client` npm package for Node.js/TypeScript, though the API can be verbose (separate calls for roles vs. attributes). The API surface is large and well-documented but has a learning curve.

**Node.js integration:** Official `keycloak-js` client adapter. Admin client available as npm package. Works but feels like a Java-ecosystem tool being used from Node.js — the abstractions don't feel native.

**Operational complexity:** High. Keycloak is a full Java application server. Upgrades require database migrations, configuration is extensive (realm exports as JSON), and debugging requires JVM knowledge. Backup means PostgreSQL + Keycloak realm exports.

**Summary:** The most feature-complete option with the best federation building blocks, but its resource footprint and operational complexity make it a poor fit for small self-hosted deployments. If Colophony only ran as managed hosting, Keycloak would be the safe choice. For a project that must also be self-hosted on a VPS, it is too heavy.

---

##### 2. Zitadel

| Criterion           | Assessment                                                                                   |
| ------------------- | -------------------------------------------------------------------------------------------- |
| **License**         | AGPL 3.0 (changed from Apache 2.0 with v3 release, March 2025). APIs/SDKs remain Apache 2.0. |
| **Language**        | Go                                                                                           |
| **GitHub**          | ~10k stars (growing)                                                                         |
| **Release cadence** | 3-month major release cycle (v4.10.1 as of Jan 2026)                                         |

**Resource requirements:**

- Zitadel binary: **~512 MB RAM**, less than 1 CPU core
- Total with CockroachDB/PostgreSQL: ~1-1.5 GB RAM for a minimal deployment
- Single binary deployment — no separate web server, admin console, or background workers
- Docker Compose deployment is well-documented and officially supported
- **Verdict: Moderate.** Fits comfortably in a 4 GB VPS alongside other services. Significantly lighter than Keycloak.

**Federation support:**

- Full **Identity Brokering** — generic OIDC and SAML provider integration
- Can connect an IdP to the instance and provide it as default to all organizations
- API-first design means programmatic IdP registration is well-supported
- No specific OpenID Federation 1.0 implementation found
- **Verdict: Good.** The API-first model and multi-tenancy design make it straightforward to build the federation layer on top. The generic OIDC provider support allows dynamic trust establishment via API.

**OAuth/social login:** Google, GitHub, Apple, Microsoft, GitLab, plus generic OIDC and SAML. Good coverage.

**SAML SSO:** Supports SAML as an Identity Provider. Can broker to external SAML IdPs. Adequate for institutional SSO requirements.

**Multi-tenancy:** **Native multi-tenancy** — designed from the ground up for B2B SaaS with organizations. This is Zitadel's strongest differentiator. Per-organization IdP settings, branding, and policies. Users can belong to multiple organizations.

**Customization:** Built-in login UI with per-organization branding. Actions system (v2 API) for custom logic at various points in auth flows. The new TypeScript Login UI (on roadmap) will improve customization further.

**API quality:** Excellent. gRPC-first API with REST and gRPC-Web interfaces. Every operation is available via API. Event-sourced architecture means full audit trail built in. The `@zitadel/node` npm package provides TypeScript client with gRPC support.

**Node.js integration:** Official `@zitadel/node` SDK with TypeScript definitions. New client and proto packages (beta 2025) provide a more modern DX. gRPC-native, which is powerful but adds complexity (gRPC-Web needed for browser contexts).

**Operational complexity:** Moderate. Single binary simplifies deployment. Event-sourced database means no separate migration step for most upgrades. However, the event-sourcing model can make debugging unfamiliar, and database growth requires monitoring. Backup is PostgreSQL only.

**License consideration:** The AGPL 3.0 license means that if Colophony distributes Zitadel as part of a network service (which self-hosted deployment effectively is), modifications to Zitadel must be shared. Since Colophony is itself open-source, this is not a problem — but it does mean that proprietary forks of Zitadel are not possible. The APIs and SDKs remain Apache 2.0, so Colophony's own code is unaffected.

**Summary:** The best balance of features, resource efficiency, and multi-tenancy for Colophony's use case. Native multi-tenancy aligns perfectly with the organization model. The API-first design enables the federation layer Colophony needs to build. The AGPL license is compatible with Colophony's open-source philosophy. The main concern is community size (smaller than Keycloak) and the relative youth of the project.

---

##### 3. Ory (Kratos + Hydra)

| Criterion           | Assessment                             |
| ------------------- | -------------------------------------- |
| **License**         | Apache 2.0                             |
| **Language**        | Go                                     |
| **GitHub**          | Kratos ~13.2k stars, Hydra ~15k+ stars |
| **Release cadence** | Regular releases; active development   |
| **Community**       | 50,000+ members                        |

**Resource requirements:**

- Ory Kratos: **~10-15 MB RAM** at idle (Go binary), though some users report higher usage (~380 MB) depending on configuration
- Ory Hydra: Similar lightweight Go binary
- Combined Kratos + Hydra: **~200-500 MB RAM** in practice with both services running
- Requires PostgreSQL (can share with the application database)
- Binary size: 5-15 MB per service
- **Verdict: Lightweight.** The lightest option by far in terms of raw resource consumption. Two separate services, but both are small Go binaries.

**Federation support:**

- Kratos can use another Ory instance as an OIDC social sign-in provider
- Hydra is OpenID Certified — a full OAuth 2.0 and OIDC server
- Together, they can serve as both an OIDC Provider and Relying Party
- Dynamic client registration via Hydra's admin API
- **Verdict: Good building blocks, more assembly required.** The modular architecture means you get exactly the primitives needed, but you must wire them together yourself. No higher-level federation abstraction.

**OAuth/social login:** 15+ built-in social connectors in Kratos (Google, GitHub, Facebook, etc.) plus generic OIDC support. Hydra provides the OAuth2/OIDC server layer.

**SAML SSO:** Kratos supports SAML via social sign-in strategy. Hydra does not natively speak SAML (it is an OAuth2/OIDC server). For full SAML IdP capabilities, you would need additional components or handle SAML at the application layer.

**Multi-tenancy:** Not natively multi-tenant in the way Zitadel or Keycloak Organizations are. Multi-tenancy must be implemented at the application layer (separate Kratos instances per tenant, or application-level tenant isolation). This is the biggest gap for Colophony's use case.

**Customization:** Fully headless — Kratos provides no UI at all (by design). You build your own login/signup UI consuming Kratos APIs. This gives maximum flexibility but means more frontend work. Reference UI implementations exist (Express, React) but are starting points, not production-ready.

**API quality:** Clean, well-documented REST APIs following OpenAPI spec. SDKs auto-generated from OpenAPI. The `@ory/kratos-client` and `@ory/hydra-client` npm packages work well. API design is thoughtful and consistent.

**Node.js integration:** Good. Auto-generated TypeScript SDK from OpenAPI specs. Reference Node.js implementation available for self-service UI. The headless architecture means all integration is via REST APIs, which works naturally from any language.

**Operational complexity:** High for self-hosted. You must run and configure **two separate services** (Kratos + Hydra) plus their dependencies, manage database migrations for both, and handle the integration between them. The Ory team openly recommends their managed Ory Network for production use, which suggests the self-hosted path has friction. Configuration is YAML-based and extensive.

**Summary:** The lightest resource footprint and cleanest API design, with maximum flexibility from the headless approach. However, the multi-component architecture adds significant operational complexity, the lack of native multi-tenancy is a real gap, and the headless approach means building auth UI from scratch. Best suited for teams that want total control and have the engineering bandwidth to maintain the integration.

---

##### 4. Logto

| Criterion           | Assessment                                    |
| ------------------- | --------------------------------------------- |
| **License**         | MPL 2.0 (Mozilla Public License)              |
| **Language**        | Node.js / TypeScript                          |
| **GitHub**          | ~11.5k stars                                  |
| **Release cadence** | Active; regular releases throughout 2025-2026 |

**Resource requirements:**

- Logto service: **~512 MB-1 GB RAM** (recommended 1 GB limit, 512 MB reservation)
- Requires PostgreSQL 14+ (can share PostgreSQL server with separate database)
- Node.js runtime — familiar stack, but heavier than Go binaries
- **Verdict: Moderate.** Comparable to Zitadel. Fits in a VPS deployment.

**Federation support:**

- Full OIDC Provider — can issue tokens for local users
- Can accept external OIDC and SAML providers as identity sources
- Prebuilt connectors for Microsoft Entra ID, Google Workspace, Okta
- Generic OIDC and SAML connector for custom providers
- Management API supports programmatic IdP configuration
- **Verdict: Adequate.** The standard OIDC Provider + Relying Party building blocks are there. No OpenID Federation 1.0 support. API-driven IdP registration is available but less mature than Zitadel's.

**OAuth/social login:** Good selection of pre-built connectors. Social login is a core feature with connectors for major providers.

**SAML SSO:** Full SAML 2.0 IdP support (added as a product feature). Can act as a SAML service provider for enterprise SSO inbound. This covers the institutional user requirement.

**Multi-tenancy:** **Organization support** with RBAC, member invitations, JIT provisioning, per-org MFA, and tailored sign-in experiences per tenant. Organization templates for reusable configurations. This is well-designed for B2B SaaS.

**Customization:** Beautiful out-of-the-box login UI with extensive customization. Supports per-org branding. The admin console is modern and intuitive. Custom fields and social connectors are configurable via the UI or API.

**API quality:** Clean Management API with OpenAPI documentation. The API covers user management, organization management, IdP configuration, and more. Good for programmatic access but less comprehensive than Keycloak or Zitadel for advanced scenarios.

**Node.js integration:** **Best native integration** of all candidates. Logto is built in Node.js/TypeScript, so the SDK, documentation, and mental model align perfectly with a Node.js backend. Official Express SDK, Next.js SDK, and React SDK. No impedance mismatch.

**Operational complexity:** Low to moderate. Single service (plus PostgreSQL). Node.js-based, so the operations team already understands the runtime. Upgrades are straightforward. The admin console handles most configuration. Backup is PostgreSQL only.

**License consideration:** MPL 2.0 is a weak copyleft license — modifications to Logto source files must be shared, but Colophony's own code linking to Logto is unaffected. Compatible with open-source distribution.

**OSS vs Cloud feature gap:** Some features (multi-tenancy for the admin console itself, certain team management features) are cloud-only. The core multi-tenancy features for end users are available in OSS. Verify that all needed features are in the OSS edition before committing.

**Summary:** The most natural fit for a Node.js/TypeScript project. Excellent DX, modern UI, good multi-tenancy support, and reasonable resource requirements. The main concerns are that it is younger than Keycloak/Ory, the community is smaller, and the OSS vs. Cloud feature gap needs verification for each specific need. If Colophony were not building a federation protocol, Logto would be the clear winner.

---

##### 5. Authentik

| Criterion           | Assessment                                              |
| ------------------- | ------------------------------------------------------- |
| **License**         | MIT (core), with paid Pro/Enterprise editions           |
| **Language**        | Python (Django)                                         |
| **GitHub**          | ~20k stars                                              |
| **Release cadence** | Regular releases; 2025.10 and 2025.12 released recently |

**Resource requirements:**

- Authentik server: **~512 MB-1 GB RAM** (recommended 1 GB limit, 512 MB reservation)
- Worker process: ~512 MB-1 GB RAM additional
- As of 2025.10, **Redis is no longer required** (migrated to PostgreSQL for caching/tasks/WebSockets)
- Total: **~1.5-2 GB RAM** for server + worker
- Container image: ~690 MB (large)
- **Verdict: Moderate to heavy.** The removal of Redis helps, but the server + worker architecture still consumes significant resources. Comparable to Keycloak in practice.

**Federation support:**

- Supports both OIDC and SAML as IdP
- Can broker to external OIDC, SAML, and LDAP identity sources
- Single Logout (SLO) support added in 2025.10
- API available for programmatic IdP management
- Primarily designed as a corporate/workforce IdP rather than a customer identity platform
- **Verdict: Adequate but not ideal.** The building blocks exist, but Authentik's design philosophy is "authentication glue for your infrastructure" rather than "identity platform for federated SaaS." Federation would work but feels like a secondary use case.

**OAuth/social login:** Good support — Google, GitHub, Microsoft, plus generic OIDC/SAML.

**SAML SSO:** Full SAML 2.0 support as both IdP and SP. SAML SLO support. Strong for enterprise scenarios.

**Multi-tenancy:** Alpha since 2024.2. Separate PostgreSQL schemas per tenant. The alpha status is concerning for a critical platform feature. Zitadel and Logto have more mature multi-tenancy.

**Customization:** Standout feature — the visual **Flow Editor** lets you design custom authentication and authorization journeys with a drag-and-drop interface. This is unique among the candidates and very powerful for complex auth flows.

**API quality:** REST API available. Less emphasis on API-first than Zitadel or Ory. The flow editor is the primary configuration mechanism, with API as secondary.

**Node.js integration:** No official Node.js SDK. Integration is via standard OIDC/SAML libraries. The Python codebase means contributing to Authentik itself would require Python knowledge. Different stack from Colophony.

**Operational complexity:** Moderate. Server + worker + PostgreSQL. Docker Compose is the primary deployment method and is well-documented. The removal of Redis simplifies operations. The visual admin UI makes configuration accessible. Backup is PostgreSQL only.

**Summary:** A strong self-hosted identity provider with an excellent visual flow editor, but it is designed for a different use case (corporate workforce identity) than what Colophony needs (customer/submitter identity for a federated platform). The Python stack adds cognitive overhead for a Node.js team, multi-tenancy is in alpha, and the resource footprint is on the heavier side. The flow editor is genuinely impressive, but not enough to overcome the misalignment.

---

##### 6. SuperTokens

| Criterion           | Assessment                                                                                               |
| ------------------- | -------------------------------------------------------------------------------------------------------- |
| **License**         | Open source core (free, unlimited users self-hosted); paid features: MFA, multi-tenancy, account linking |
| **Language**        | Java (core), Node.js SDK                                                                                 |
| **GitHub**          | ~15k stars (core)                                                                                        |
| **Release cadence** | Active development                                                                                       |

**Resource requirements:**

- SuperTokens core: **~500 MB RAM** (can run on a t2.micro AWS instance for up to 50k MAU)
- Password hashing (Argon2) can peak at 1 GB for hashing operations (configurable)
- Requires PostgreSQL
- **Verdict: Light to moderate.** The core is relatively efficient. The Java runtime for the core service means a higher base memory than pure Go, but lower than Keycloak.

**Federation support:**

- Supports OIDC as a relying party (consuming external OIDC providers)
- Can act as an OAuth2 provider
- No built-in identity brokering (unlike Keycloak, Zitadel, Authentik)
- **Does not act as a full OIDC Provider** in the way needed for federation — it is primarily an auth backend, not an identity provider that other services consume
- SAML support via BoxyHQ SAML Jackson integration (separate microservice)
- **Verdict: Weakest for federation.** SuperTokens is designed as an embedded auth library, not as an identity provider that participates in federation. Building the federation layer on top would require significant custom work.

**OAuth/social login:** Good support via pre-built connectors. Any OIDC-compliant provider can be added.

**SAML SSO:** Not native — requires the BoxyHQ SAML Jackson sidecar service, adding another component to deploy and maintain.

**Multi-tenancy:** Available as a **paid feature** in self-hosted deployment. Each tenant gets isolated user pools with independent auth configuration. The paid-feature model conflicts with Colophony's "no feature gating" philosophy.

**Customization:** Pre-built UI components with theming. Override hooks for custom logic. The UI layer integrates directly into your app (not a separate login page), which can be an advantage for DX but means less separation of concerns.

**API quality:** Good REST API for user management and session management. The "recipe" model is intuitive for developers. Documentation is excellent with code examples.

**Node.js integration:** **Excellent.** SuperTokens was designed for Node.js backends. The SDK integrates directly into Express/Fastify/NestJS. The integration feels native because it IS native — SuperTokens middleware runs in your Node.js process (with the core as a separate service).

**Operational complexity:** Low for basic use cases. The core + your app + PostgreSQL. However, adding SAML (via BoxyHQ) and multi-tenancy (paid) increases complexity. Upgrade path is straightforward.

**Summary:** The simplest and most developer-friendly option for basic auth in a Node.js app. However, it falls short for Colophony's needs: it cannot act as a full OIDC Provider for federation, SAML requires an additional service, multi-tenancy is a paid feature, and the overall design is "auth library" rather than "identity platform." Best for projects that need simple, embedded auth without federation or enterprise SSO requirements.

---

#### Summary Comparison Table

| Criterion                         | Keycloak             | Zitadel               | Ory (Kratos+Hydra)        | Logto                | Authentik      | SuperTokens                   |
| --------------------------------- | -------------------- | --------------------- | ------------------------- | -------------------- | -------------- | ----------------------------- |
| **RAM (minimum viable)**          | 1.5-2 GB             | ~512 MB               | ~200-500 MB               | ~512 MB-1 GB         | ~1.5-2 GB      | ~500 MB                       |
| **Federation building blocks**    | Excellent            | Good                  | Good                      | Adequate             | Adequate       | Weak                          |
| **OpenID Federation 1.0**         | In progress (plugin) | No                    | No                        | No                   | No             | No                            |
| **OIDC Provider**                 | Full                 | Full                  | Full (Hydra)              | Full                 | Full           | Limited                       |
| **Identity Brokering**            | Mature               | Good                  | Manual                    | Good                 | Good           | No                            |
| **Dynamic IdP Registration**      | Yes (API)            | Yes (API)             | Yes (Hydra admin)         | Yes (API)            | Yes (API)      | No                            |
| **OAuth/Social Login**            | Extensive            | Good                  | Good (15+)                | Good                 | Good           | Good                          |
| **SAML SSO**                      | Full                 | Full                  | Partial                   | Full                 | Full           | Via BoxyHQ (extra service)    |
| **Multi-tenancy**                 | Organizations (v25+) | Native (best)         | Not native                | Organizations        | Alpha          | Paid feature                  |
| **Login UI**                      | Themed (Freemarker)  | Built-in (branded)    | Headless (build your own) | Beautiful (built-in) | Flow editor    | Embedded components           |
| **Admin API**                     | Comprehensive REST   | Excellent (gRPC+REST) | Clean REST (OpenAPI)      | Good REST            | REST           | Good REST                     |
| **Node.js DX**                    | Usable               | Good (gRPC SDK)       | Good (OpenAPI SDK)        | Excellent (native)   | No SDK         | Excellent (native)            |
| **License**                       | Apache 2.0           | AGPL 3.0 (core)       | Apache 2.0                | MPL 2.0              | MIT            | Open core (paid features)     |
| **GitHub Stars**                  | ~30k                 | ~10k                  | ~13k + ~15k               | ~11.5k               | ~20k           | ~15k                          |
| **Community Maturity**            | Highest (CNCF)       | Growing               | Large (50k+)              | Growing              | Large          | Moderate                      |
| **Operational Complexity**        | High                 | Moderate              | High (2 services)         | Low-moderate         | Moderate       | Low (basic) / Moderate (full) |
| **Self-hosted Docker Compose**    | Heavy but documented | Well supported        | Complex multi-service     | Simple               | Well supported | Simple                        |
| **MFA**                           | Full                 | Full                  | Full                      | Full                 | Full           | Paid feature                  |
| **Password reset / Email verify** | Full                 | Full                  | Full                      | Full                 | Full           | Full                          |

#### Rating Matrix (1-5, where 5 = best fit for Colophony)

| Criterion (weighted)        | Keycloak | Zitadel | Ory    | Logto   | Authentik | SuperTokens |
| --------------------------- | -------- | ------- | ------ | ------- | --------- | ----------- |
| Federation support (5x)     | 5        | 4       | 3      | 3       | 3         | 1           |
| Self-hosted footprint (4x)  | 2        | 4       | 5      | 4       | 2         | 4           |
| Multi-tenancy (4x)          | 4        | 5       | 2      | 4       | 2         | 3           |
| API quality (3x)            | 4        | 5       | 4      | 4       | 3         | 4           |
| SAML SSO (3x)               | 5        | 4       | 3      | 4       | 5         | 2           |
| Node.js integration (3x)    | 3        | 3       | 4      | 5       | 2         | 5           |
| OAuth/Social (2x)           | 5        | 4       | 4      | 4       | 4         | 4           |
| Login UI customization (2x) | 3        | 4       | 2      | 5       | 5         | 3           |
| Community/maturity (2x)     | 5        | 3       | 4      | 3       | 4         | 3           |
| Operational simplicity (2x) | 2        | 4       | 2      | 4       | 3         | 4           |
| License compatibility (1x)  | 5        | 4       | 5      | 5       | 5         | 3           |
| **Weighted Total (/155)**   | **111**  | **122** | **97** | **117** | **94**    | **93**      |

---

#### Recommendation: Zitadel (Primary) with Logto as Close Alternative

**Primary recommendation: Zitadel**

Zitadel scores highest on the weighted evaluation because it balances the two most critical requirements — federation building blocks and multi-tenancy — better than any other candidate, while maintaining a reasonable resource footprint for self-hosted deployments.

**Why Zitadel wins:**

1. **Native multi-tenancy is a perfect fit.** Colophony's organization model (Organization > Publication > Call > Submission) maps directly to Zitadel's multi-tenant architecture. Per-organization IdP settings, branding, and policies are built in, not bolted on.

2. **API-first design enables the Federation service.** Zitadel's gRPC + REST API exposes every operation programmatically. The Federation service can register new trusted Colophony instances as OIDC identity providers, manage identity linking, and query user data — all via API. This is critical because the federation layer must be fully automated.

3. **Resource footprint fits the VPS target.** At ~512 MB RAM, Zitadel leaves room for PostgreSQL (~256-512 MB), Redis (~128 MB), MinIO (~256 MB), and the Colophony services (~512 MB) on a 4 GB VPS. This is tight but viable, unlike Keycloak which would consume half or more of available memory by itself.

4. **Single binary simplifies operations.** No separate admin server, no background worker process, no Java runtime. One Go binary with a PostgreSQL dependency. Docker Compose deployment is well-documented and officially supported.

5. **Event-sourced architecture provides audit logging for free.** Every auth event (login, role change, IdP configuration change) is stored as an immutable event. This aligns with Colophony's GDPR audit logging requirements.

6. **AGPL 3.0 is compatible with Colophony's open-source model.** Since Colophony itself is open source, the AGPL copyleft requirement is not a constraint. The APIs and SDKs remain Apache 2.0, so Colophony's application code is unaffected.

**Why not the others:**

- **Keycloak** — Best federation features (especially OpenID Federation 1.0 work), but too heavy for VPS self-hosting (~1.5-2 GB RAM) and operationally complex. Would be the choice if Colophony were managed-hosting-only.
- **Logto** — Best Node.js DX and beautiful UI, but federation building blocks are less mature than Zitadel's, and the smaller community raises long-term maintenance questions. Strong second choice if Node.js ecosystem alignment is weighted more heavily.
- **Ory (Kratos + Hydra)** — Lightest footprint and cleanest API design, but no native multi-tenancy and the two-service architecture adds operational complexity. Would require building both multi-tenancy and auth UI from scratch.
- **Authentik** — Good product but designed for workforce identity (corporate SSO), not customer identity (federated submitter platform). Multi-tenancy in alpha. Python stack misaligns with Colophony's Node.js ecosystem.
- **SuperTokens** — Excellent Node.js DX but fundamentally wrong architecture for federation. Cannot act as a full OIDC Provider that other instances consume. Multi-tenancy and MFA are paid features, conflicting with Colophony's no-feature-gating principle.

**Migration path from MVP:**

The current MVP's custom JWT + Passport.js auth can be migrated incrementally:

1. Deploy Zitadel in the Docker Compose stack
2. Migrate existing users to Zitadel (import via admin API)
3. Replace Passport.js JWT validation with Zitadel OIDC token validation
4. Add OAuth/social login via Zitadel connectors
5. Build federation on top of Zitadel's identity brokering
6. Add SAML SSO for institutional users when needed

**Risk mitigation:**

- **Zitadel community size:** Smaller than Keycloak, but backed by a funded company (Zitadel Cloud), growing GitHub presence, and 3-month release cycle. The AGPL license ensures the code remains open regardless of company trajectory.
- **AGPL concerns:** If any future Colophony user wants to build a proprietary fork, they would need to replace or license Zitadel separately. This is unlikely given Colophony's open-source positioning, but worth documenting.
- **gRPC complexity:** The `@zitadel/node` SDK abstracts most gRPC complexity. REST endpoints are also available for simpler integrations. The new TypeScript client packages (2025) improve DX further.

**[Senior dev review] Additional mitigations:**

- **AGPL license boundary documentation (HIGH PRIORITY):** Clearly document in repo docs that Colophony itself remains MIT/Apache 2.0. Only modifications to Zitadel specifically must be shared under AGPL. This only affects someone who wants to fork Zitadel proprietary, which is unlikely given Colophony's open-source positioning.

- **`packages/auth-client` REST-only wrapper (HIGH PRIORITY):** Create a thin wrapper package that exposes REST-only methods for common operations (user creation, org membership, role grants). Benefits:
  - Contributors never touch gRPC directly
  - If Zitadel is ever swapped for Logto (the acknowledged fallback), only the wrapper changes
  - Common patterns are documented as typed functions
  - Reduces the "figure it out" burden for new contributors

- **Time budget for Zitadel learning curve:** Budget 20% more time for "figure out how to do X in Zitadel" vs Keycloak. Keycloak has a decade of Stack Overflow answers; Zitadel doesn't. Mitigate by actively participating in Zitadel community (GitHub discussions, Discord) and documenting Colophony-specific Zitadel patterns as they are discovered. This documentation becomes the `packages/auth-client/README.md`.

**Note on federation architecture:**

Regardless of which auth service is chosen, Colophony will need to build a custom **Federation service** that orchestrates cross-instance identity. The auth service provides the OIDC primitives (token issuance, identity brokering, user management), but the federation protocol (instance discovery, trust establishment, simultaneous submission enforcement, identity portability) must be designed and built as a Colophony-specific service. This is covered in Research Area 4.7 (Federation Protocol). The auth service choice determines the quality of the building blocks available to that Federation service — it does not solve federation on its own.

**Sources consulted:**

- [Keycloak Memory and CPU Sizing](https://www.keycloak.org/high-availability/concepts-memory-and-cpu-sizing)
- [Keycloak Identity Brokering](https://www.stackhpc.com/federation-and-identity-brokering-using-keycloak.html)
- [Keycloak OpenID Federation](https://www.cncf.io/blog/2025/05/05/building-trust-with-openid-federation-trust-chain-on-keycloak-2/)
- [Keycloak Organizations](https://medium.com/keycloak/exploring-keycloak-26-introducing-the-organization-feature-for-multi-tenancy-fb5ebaaf8fe4)
- [Keycloak 30k Stars](https://www.keycloak.org/2025/10/30k-stars-celebration)
- [Zitadel Self-Hosted Specs](https://help.zitadel.com/what-are-zitadel-minimum-self-hosted-specs)
- [Zitadel Docker Compose](https://zitadel.com/docs/self-hosting/deploy/compose)
- [Zitadel Identity Brokering](https://zitadel.com/docs/concepts/features/identity-brokering)
- [Zitadel License Change (Apache to AGPL)](https://zitadel.com/blog/apache-to-agpl)
- [Zitadel Release Cycle](https://zitadel.com/docs/product/release-cycle)
- [Zitadel Node.js SDK](https://www.npmjs.com/package/@zitadel/node)
- [Ory Kratos GitHub](https://github.com/ory/kratos)
- [Ory Hydra GitHub](https://github.com/ory/hydra)
- [Ory Kratos Memory Usage Discussion](https://github.com/ory/kratos/issues/945)
- [Ory Scalability](https://www.ory.sh/docs/self-hosted/operations/scalability)
- [Logto OSS Documentation](https://docs.logto.io/logto-oss)
- [Logto SAML App](https://logto.io/products/saml-app)
- [Logto 10k Stars Milestone](https://blog.logto.io/10k-and-1m)
- [Logto 2025 Recap](https://blog.logto.io/2025-recap)
- [Authentik 2025.10 Release](https://goauthentik.io/blog/2025-10-28-authentik-version-2025-10/)
- [Authentik Multi-Tenancy](https://docs.goauthentik.io/sys-mgmt/tenancy/)
- [Authentik Resource Consumption Discussion](https://github.com/goauthentik/authentik/discussions/9569)
- [SuperTokens Self-Host](https://supertokens.com/docs/deployment/self-host-supertokens)
- [SuperTokens Pricing](https://supertokens.com/pricing)
- [SuperTokens Enterprise SSO](https://supertokens.com/docs/authentication/enterprise/introduction)
- [OpenID Federation 1.0 Explained](https://connect2id.com/learn/openid-federation)
- [State of Open-Source Identity 2025](https://www.houseoffoss.com/post/the-state-of-open-source-identity-in-2025-authentik-vs-authelia-vs-keycloak-vs-zitadel)

### 5.4 Managed Hosting Orchestration

> **Researched:** 2026-02-11
> **Status:** Complete -- recommendation provided

#### Context and Assumptions

**Services per tenant (managed hosting):**

- Core API (NestJS/Fastify, ~256-512MB RAM)
- Web Frontend (Next.js, ~128-256MB RAM)
- Workers (BullMQ processors, ~128-256MB RAM)

**Shared infrastructure (across all tenants):**

- PostgreSQL (shared cluster, schema-per-tenant or RLS-based isolation)
- Redis (shared instance, key-prefix isolation)
- MinIO / S3 (shared, bucket-per-tenant)
- Federation service (single instance serving all tenants)
- Notification service (single instance serving all tenants)
- Auth service (Keycloak/Zitadel, shared instance)

**Team constraint:** 1-2 people. This is the single most important factor. An orchestration system that requires a dedicated DevOps engineer is disqualifying.

**Pricing constraint:** Target market is small literary magazines. Managed hosting must be affordable enough to price at approximately $25-75/month per tenant, which means infrastructure cost per tenant must be well under that.

**Philosophy constraint:** The platform is open-source. Orchestration choices that align with open-source values and avoid deep vendor lock-in are preferred.

---

#### Candidate 1: Kubernetes (Managed -- GKE Autopilot / EKS / DigitalOcean K8s)

**Overview:** The industry standard container orchestrator. Managed offerings (GKE, EKS, AKS, DigitalOcean) handle the control plane, but you still manage workloads, configs, networking, and observability.

**Multi-Tenant Isolation:**
Kubernetes excels here. Namespace-per-tenant with NetworkPolicies, ResourceQuotas, and RBAC provides strong isolation. GKE supports "enterprise multi-tenancy" patterns with namespace-level cost allocation and policy enforcement. However, configuring all of this correctly is non-trivial.

**Auto-Scaling:**
Best-in-class. Horizontal Pod Autoscaler (HPA) scales individual deployments based on CPU, memory, or custom metrics. Vertical Pod Autoscaler (VPA) right-sizes resource requests. GKE Autopilot handles node scaling entirely, billing only for pod resource requests.

**Cost Estimates:**

| Scale        | Infra Cost (GKE Autopilot) | Notes                                                                  |
| ------------ | -------------------------- | ---------------------------------------------------------------------- |
| 10 tenants   | ~$250-400/mo               | Cluster fee (~$74 free tier credit), 30 pods at ~256MB each, shared DB |
| 100 tenants  | ~$1,500-2,500/mo           | 300 pods, need larger shared DB, more Redis capacity                   |
| 1000 tenants | ~$8,000-15,000/mo          | 3000 pods, multiple node pools, DB read replicas, dedicated Redis      |

GKE Autopilot pricing: ~$0.0445/vCPU-hour, ~$0.0049/GiB-hour. EKS is slightly cheaper on compute but charges $0.10/hr per cluster (~$73/mo). DigitalOcean K8s has no control plane fee but fewer features.

**Ops Burden: HIGH (disqualifying for 1-2 person team)**
Even with managed K8s, the operator must understand: Helm charts or Kustomize for deployment, Ingress controllers (NGINX or Traefik), cert-manager for SSL, Prometheus + Grafana for monitoring, PersistentVolumeClaims for storage, NetworkPolicies for isolation, RBAC for access control, and GitOps tooling (ArgoCD or Flux). The learning curve is 3-6 months for a team without K8s experience. On-call burden is significant.

**Secret Management:** Kubernetes Secrets (base64, not encrypted at rest by default), or integrate with External Secrets Operator + a vault. Requires additional setup.

**Database Management:** Typically use a managed database service (Cloud SQL, RDS) external to the cluster. Backups and migrations managed separately. Works well but adds cost.

**Monitoring:** Excellent ecosystem (Prometheus, Grafana, Loki, Tempo), but all must be deployed and maintained. GKE integrates with Google Cloud Monitoring.

**Disaster Recovery:** Strong primitives (PVs, snapshots, CRDs for backup operators like Velero), but must be configured.

**SSL/Custom Domains:** cert-manager + Let's Encrypt handles automated certificate issuance. Ingress rules route by hostname. Well-documented, but requires setup.

**Zero-Downtime Deploys:** Built-in rolling updates with readiness/liveness probes.

**Community/Support:** Massive community. Every cloud vendor offers commercial support. CNCF governed.

**Verdict:** Kubernetes is overkill for this team size and scale. The CLAUDE.md already notes "NO Kubernetes until 1000+ orgs" and this analysis confirms that assessment. Reserve as a future migration target if managed hosting grows beyond 500-1000 tenants.

---

#### Candidate 2: Fly.io

**Overview:** A platform that runs Docker containers on their global edge network using Firecracker micro-VMs. Machines API allows programmatic creation/destruction of VMs. Apps scale to zero when idle.

**Multi-Tenant Isolation:**
Strong. Each Fly Machine is a Firecracker micro-VM with hardware-level isolation. Two architectural approaches: (a) one Fly app per tenant with multiple machines for each service, or (b) shared Fly apps with routing based on hostname. Option (a) provides stronger isolation but more management overhead. The Machines API enables programmatic provisioning of new tenant instances.

**Auto-Scaling:**
Fly Machines can auto-stop when idle and auto-start on incoming requests (scale-to-zero). This is excellent for literary magazine workloads where traffic is spiky (submission deadline rushes, then quiet periods). Manual scaling via Machines API for adding replicas. No built-in HPA equivalent, but the scale-to-zero model may be more cost-effective for this workload.

**Cost Estimates:**

| Scale        | Infra Cost       | Notes                                                                                              |
| ------------ | ---------------- | -------------------------------------------------------------------------------------------------- |
| 10 tenants   | ~$80-150/mo      | 30 shared-CPU machines (scale-to-zero), shared Postgres (Supabase/Neon or self-managed), ~$20/IPv4 |
| 100 tenants  | ~$500-1,200/mo   | Scale-to-zero keeps idle tenants cheap, shared DB ($50-100), IPv4 costs ($200), bandwidth          |
| 1000 tenants | ~$3,000-8,000/mo | At this scale, IPv4 costs ($2,000/mo) become significant; dedicated DB needed                      |

Key pricing: shared-CPU 256MB machine = ~$1.94/mo (always-on), but scale-to-zero can reduce this dramatically. Dedicated IPv4 = $2/mo per app. Bandwidth = $0.02/GB.

**Ops Burden: LOW-MEDIUM**
Fly's CLI and Machines API are developer-friendly. Deployment is `fly deploy` or API calls. No infrastructure to manage. However, building the tenant provisioning automation (creating apps, setting secrets, configuring custom domains via API) is custom work. Monitoring requires external tools (Fly provides basic metrics and log shipping). Database management is your responsibility (Fly Postgres is "not managed" -- they run it as a Fly app but you handle backups, upgrades, failover).

**Secret Management:** `fly secrets set` per app. Secrets are encrypted and injected as environment variables. Per-tenant secrets are natural (each app has its own secret scope). No built-in rotation.

**Database Management:** Fly Postgres exists but is explicitly "not managed" -- you handle backups, upgrades, and failover. Better to use an external managed Postgres (Neon, Crunchy Bridge, Supabase) for production. This adds cost but reduces ops burden. Shared DB with RLS is the right model for Colophony's architecture.

**Monitoring:** Basic metrics in the Fly dashboard. Log shipping to external services (Papertrail, Datadog). No built-in alerting. Must set up externally.

**Disaster Recovery:** Fly machines are ephemeral (stateless apps redeploy easily). Database backups depend on your DB provider. Volume snapshots available but manual.

**SSL/Custom Domains:** Excellent. Automatic certificate issuance via Let's Encrypt (TLS-ALPN and HTTP-01 challenges). Wildcard certificates supported via DNS-01 challenge. GraphQL API to automate certificate provisioning for tenant custom domains. This is a strong differentiator.

**Zero-Downtime Deploys:** Built-in with blue-green deployment strategy.

**Community/Support:** Active community forum. Standard support included; paid support plans available. Growing ecosystem.

**Verdict:** Strong candidate for early-to-mid scale. Scale-to-zero is excellent for the literary magazine workload profile. Custom domain automation is production-ready. Main concerns: vendor lock-in, IPv4 costs at scale, and "not managed" database requiring external provider. Best suited for the 10-100 tenant range.

---

#### Candidate 3: Railway

**Overview:** A cloud platform focused on developer experience. Git-push deploys, usage-based billing, built-in databases. Similar philosophy to Heroku but modern.

**Multi-Tenant Isolation:**
Moderate. Railway uses projects as isolation boundaries. Each tenant could be a project with multiple services. GraphQL API enables programmatic project creation. However, Railway was designed for individual developer/team projects, not as a multi-tenant hosting platform. Using it to manage 100+ tenant projects would push against its design intent.

**Auto-Scaling:**
Railway supports replica scaling with load balancing. Resources (CPU/RAM) scale within configured limits. However, there is no true auto-scaling -- you configure replicas manually or via API. No scale-to-zero.

**Cost Estimates:**

| Scale        | Infra Cost         | Notes                                                                                |
| ------------ | ------------------ | ------------------------------------------------------------------------------------ |
| 10 tenants   | ~$150-300/mo       | Pro plan ($20/mo base), ~30 services, usage-based compute at $20/vCPU-mo + $10/GB-mo |
| 100 tenants  | ~$1,500-3,000/mo   | 300 services, shared Postgres, significant compute costs                             |
| 1000 tenants | ~$15,000-30,000/mo | Railway becomes very expensive at scale; no volume discounts apparent                |

Per-service costs: $20/vCPU-month, $10/GB-memory-month. A small service using 0.25 vCPU + 256MB = ~$7.50/mo. Three services per tenant = ~$22.50/tenant/mo just for compute.

**Ops Burden: LOW**
The lowest ops burden of all candidates. Dashboard for management, built-in Postgres and Redis, automatic deploys from git push. However, the GraphQL API for programmatic management, while capable, adds complexity for building tenant provisioning automation. Rate limit of 1000 requests/hour could be a constraint for management operations at scale.

**Secret Management:** Per-project environment variables. Service-level variable scoping. No built-in vault integration. Adequate for basic needs.

**Database Management:** Built-in Postgres and Redis with automatic backups. This is a significant advantage -- no external DB provider needed. However, shared-database multi-tenancy (Colophony's model) means all tenants would share one Railway Postgres instance.

**Monitoring:** Basic metrics in dashboard. Log streaming. No built-in alerting or advanced observability. External tools needed for production monitoring.

**Disaster Recovery:** Automatic database backups. Service redeploy from git. No cross-region failover.

**SSL/Custom Domains:** Automatic SSL for custom domains. Simple setup. No automation API for bulk domain management found, which is a gap for multi-tenant use.

**Zero-Downtime Deploys:** Supported with health checks.

**Community/Support:** Active community. Standard and priority support available. Good documentation.

**Verdict:** Excellent for a small number of tenants (under 20) or as a stepping stone. The built-in managed Postgres is appealing. However, Railway becomes expensive at scale, was not designed as a multi-tenant hosting platform, and lacks the programmatic control needed for automating tenant lifecycle at 100+ tenants. Best for the prototyping/early phase of managed hosting.

---

#### Candidate 4: Coolify

**Overview:** An open-source, self-hosted PaaS alternative to Vercel/Heroku/Netlify. You install it on your own servers and get a web dashboard for deploying applications. Supports Docker, Docker Compose, and experimental Docker Swarm.

**Multi-Tenant Isolation:**
Moderate. Coolify uses Teams -> Projects -> Environments -> Resources hierarchy. Each tenant could be a project. Applications run as Docker containers on your servers. Isolation is at the container level (no VM-level isolation). The REST API (OpenAPI 3.1) enables programmatic tenant provisioning -- creating projects, applications, setting environment variables, and triggering deployments.

**Auto-Scaling:**
Weak. No built-in auto-scaling. Docker Swarm support is experimental with significant limitations (predefined container names prevent replicas, no Kubernetes path). Scaling means manually adding servers. This is Coolify's biggest weakness.

**Cost Estimates:**

| Scale        | Infra Cost       | Notes                                                                    |
| ------------ | ---------------- | ------------------------------------------------------------------------ |
| 10 tenants   | ~$30-60/mo       | 1-2 Hetzner CX32 (~$7/mo each, 4 vCPU, 8GB), Coolify is free self-hosted |
| 100 tenants  | ~$200-400/mo     | 5-8 Hetzner CX42 (~$16/mo each, 8 vCPU, 16GB), managed DB add ~$50-100   |
| 1000 tenants | ~$1,500-3,000/mo | 30-50 servers, need load balancing layer, DB cluster                     |

This is by far the cheapest option because you only pay for raw VPS hosting. Coolify itself is free (self-hosted). Hetzner pricing: CX22 = ~$4/mo (2 vCPU, 4GB), CX32 = ~$7/mo (4 vCPU, 8GB), CX42 = ~$16/mo (8 vCPU, 16GB).

**Ops Burden: MEDIUM**
Coolify's web dashboard makes day-to-day management easy. Git-push deploys, one-click database setup, automatic SSL. However, you are responsible for: server provisioning and maintenance, OS updates and security patches, Coolify itself (updates, backups), networking between servers, and monitoring. The "self-hosted PaaS" model trades cloud costs for ops work.

**Secret Management:** Per-application environment variables via dashboard or API. Build-time and runtime secret separation. No vault integration.

**Database Management:** Can deploy Postgres, Redis, and other databases with one click. Automatic backups to S3-compatible storage. However, database HA (replication, failover) requires manual setup.

**Monitoring:** Basic container metrics in dashboard. No built-in log aggregation, alerting, or APM. Must set up externally.

**Disaster Recovery:** Automatic backups to S3. Server-level backups are your responsibility. No automated failover.

**SSL/Custom Domains:** Automatic Let's Encrypt certificates. Custom domain support per application. This works well for per-tenant custom domains.

**Zero-Downtime Deploys:** Supported for Docker-based deployments.

**Community/Support:** Large open-source community (44,000+ GitHub stars). Active development. One primary maintainer (Andras Bacsai) which is a bus-factor risk, though the community is large enough that forks would likely continue development.

**Verdict:** Best cost-to-feature ratio and aligns with open-source philosophy. The REST API enables tenant automation. The main risks are: (a) scaling limitations (no auto-scaling, experimental Swarm), (b) single-maintainer bus factor, and (c) ops burden of managing your own servers. Best suited for a cost-conscious approach where the team is willing to trade some ops work for dramatically lower hosting costs.

---

#### Candidate 5: Docker Swarm

**Overview:** Docker's built-in clustering and orchestration. Turns a pool of Docker hosts into a single virtual host. Uses the familiar Docker Compose format with additions for placement, replicas, and rolling updates.

**Multi-Tenant Isolation:**
Weak. Swarm provides container-level isolation only. No namespace concept (unlike Kubernetes). No network policies for fine-grained traffic control. No RBAC for per-tenant access control. Secrets are cluster-wide, not scoped to tenants. For multi-tenant SaaS, this is a significant limitation. You would need to implement all isolation at the application level.

**Auto-Scaling:**
None built-in. Swarm supports replica scaling (`docker service scale`) but requires external tooling (or scripts) for auto-scaling. No equivalent to HPA. Node scaling is entirely manual.

**Cost Estimates:**

| Scale        | Infra Cost       | Notes                                         |
| ------------ | ---------------- | --------------------------------------------- |
| 10 tenants   | ~$20-50/mo       | 1-2 Hetzner servers, Docker Swarm is free     |
| 100 tenants  | ~$150-350/mo     | 3-6 servers, Traefik for routing, external DB |
| 1000 tenants | ~$1,200-2,500/mo | 20-40 servers, multiple Swarm managers        |

Cheapest option because Docker Swarm adds zero cost on top of raw VPS hosting.

**Ops Burden: MEDIUM-HIGH**
Swarm itself is simple to set up and operate. However, building a production multi-tenant platform on Swarm requires significant custom work: Traefik configuration for per-tenant routing and SSL, custom scripts for tenant provisioning and lifecycle management, monitoring stack (Prometheus/Grafana or similar), backup automation, and log aggregation. There is no dashboard, no API for tenant management, and no ecosystem of tools. You are building most of the platform yourself.

**Secret Management:** Docker Swarm Secrets are encrypted at rest and in transit. However, they are cluster-scoped with no tenant-level isolation. You would need per-tenant secret naming conventions and careful access control.

**Database Management:** Run Postgres as a Swarm service or use external managed DB. No built-in backup or migration tooling. Volume management for stateful services is one of Swarm's weakest areas.

**Monitoring:** None built-in. Must deploy and maintain your own monitoring stack.

**Disaster Recovery:** Basic (service restart on node failure). No built-in backup automation. Volume snapshots depend on the underlying infrastructure.

**SSL/Custom Domains:** Via Traefik integration. Automatic Let's Encrypt certificates. Domain-based routing works well. Wildcard certificates supported. However, all configuration is manual YAML/labels.

**Zero-Downtime Deploys:** Rolling updates are built-in and work well.

**Community/Support:** Swarm is "alive but stagnant." Docker has deprioritized it in favor of Docker Desktop and partnership with Kubernetes. Community is shrinking. Long-term viability is uncertain. No commercial support.

**Verdict:** Not recommended. While the cheapest and simplest orchestrator, Swarm's stagnant development, weak isolation, lack of ecosystem, and the amount of custom tooling required make it a poor choice. You would be building a PaaS from scratch on a declining platform. The cost savings over Coolify are marginal, but the ops burden is much higher because Coolify provides the management UI, API, and automation that Swarm lacks.

---

#### Candidate 6: HashiCorp Nomad

**Overview:** A workload orchestrator from HashiCorp. Simpler than Kubernetes, supports Docker containers, VMs, and raw binaries. Part of the HashiCorp ecosystem (Vault, Consul, Terraform).

**Multi-Tenant Isolation:**
Good (with Enterprise). Nomad supports namespaces, ACLs, and quotas. Combined with Consul for service mesh and Vault for secrets, you get strong multi-tenant isolation. However, many isolation features (namespaces, quotas, Sentinel policies) require the Enterprise license.

**Auto-Scaling:**
Community: Manual scaling only. Enterprise: Dynamic Application Sizing and auto-scaling policies. The dependency on Enterprise for auto-scaling is a significant drawback.

**Cost Estimates:**

| Scale        | Infra Cost (Community) | Infra Cost (Enterprise) | Notes                                    |
| ------------ | ---------------------- | ----------------------- | ---------------------------------------- |
| 10 tenants   | ~$40-80/mo             | Unknown + license       | 2-3 Hetzner servers, Nomad is free (BSL) |
| 100 tenants  | ~$300-600/mo           | Unknown + license       | 5-10 servers, Consul cluster, Vault      |
| 1000 tenants | ~$2,000-4,000/mo       | Unknown + license       | Enterprise license cost is not public    |

Infrastructure costs are similar to Swarm/Coolify (raw VPS). But Enterprise license costs are opaque and could be substantial. The community edition lacks key features for multi-tenancy.

**Ops Burden: MEDIUM-HIGH**
Nomad itself is simpler than Kubernetes, but the full HashiCorp stack (Nomad + Consul + Vault) adds significant operational complexity. Each component must be deployed, configured, and maintained. Learning three interconnected systems is a steep investment for a 1-2 person team.

**Secret Management:** Excellent with Vault (best-in-class). Dynamic secrets, automatic rotation, per-tenant secret engines. But Vault is a complex system to operate.

**Database Management:** Not provided. Must manage separately. No integration with database lifecycle.

**Monitoring:** Integrates with Prometheus. Nomad UI provides basic job/allocation metrics. No built-in alerting.

**Disaster Recovery:** Snapshot-based backup for Nomad state. Application-level DR is your responsibility.

**SSL/Custom Domains:** Via Consul + Traefik/Envoy. Not built-in. Requires configuration.

**Zero-Downtime Deploys:** Rolling updates and blue-green deployments supported.

**Community/Support:** Nomad is now under BSL 1.1 (no longer open source). This is a philosophical mismatch with Colophony's open-source values. Community is smaller than Kubernetes. Enterprise support available but expensive. The BSL license restricts competitive use, which may conflict with Colophony's open-source model.

**Verdict:** Not recommended. The BSL license is a philosophical mismatch. Enterprise-gated features are needed for proper multi-tenancy. The full HashiCorp stack (Nomad + Consul + Vault) is too complex for a 1-2 person team. The community edition lacks essential multi-tenancy features. Kubernetes would be a better choice if you need that level of orchestration sophistication.

---

#### Candidate 7: Kamal (37signals)

**Overview:** A deployment tool (not an orchestrator) from 37signals (makers of Basecamp and HEY). Uses SSH to deploy Docker containers to any server. Includes kamal-proxy for zero-downtime deploys, automatic SSL, and hostname-based routing. Battle-tested running HEY (hundreds of thousands of users). MIT licensed.

**Multi-Tenant Isolation:**
Moderate. Each tenant can be a separate Kamal "destination" with its own configuration, secrets, and deployment. kamal-proxy routes traffic by hostname. Multiple apps share a single kamal-proxy instance on each server. Isolation is at the Docker container level. No namespace or network policy concept. However, the destination-based model maps cleanly to per-tenant deployments.

**Auto-Scaling:**
None. Kamal is a deployment tool, not an orchestrator. It deploys a fixed set of containers to a fixed set of servers. Scaling means manually adding servers to the configuration and redeploying. 37signals' philosophy is to over-provision on cheap hardware rather than auto-scale. This works well when your baseline cost is $5-20/month per server (Hetzner) rather than cloud pricing.

**Cost Estimates:**

| Scale        | Infra Cost       | Notes                                                         |
| ------------ | ---------------- | ------------------------------------------------------------- |
| 10 tenants   | ~$30-60/mo       | 1-2 Hetzner CX32 servers, Kamal is free and open-source (MIT) |
| 100 tenants  | ~$200-400/mo     | 5-8 servers, managed DB (~$50-100), load balancer             |
| 1000 tenants | ~$1,500-3,000/mo | 30-50 servers, DB cluster, custom provisioning tooling        |

Kamal itself is free (MIT license). Costs are purely VPS hosting. Nearly identical cost profile to Coolify and Docker Swarm.

**Ops Burden: LOW-MEDIUM**
Kamal is opinionated and simple. `kamal deploy` handles building, pushing images, and zero-downtime deployment. `kamal rollback` for rollbacks. `kamal app logs` for log access. Configuration is a single YAML file per app. Secret management integrates with 1Password, LastPass, or Bitwarden. However, Kamal provides no dashboard, no monitoring, no database management. You must set these up separately. The critical gap: Kamal has no API for programmatic tenant provisioning. You would need to generate YAML configs and run CLI commands via scripts, which is fragile.

**Secret Management:** Good. Per-destination secrets via `.kamal/secrets.<destination>`. Integrates with 1Password, LastPass, and Bitwarden for credential retrieval. Secrets are encrypted in transit and injected as environment variables. Per-tenant secrets via destination interpolation: `KAMAL_DESTINATION` variable scopes secret lookups.

**Database Management:** Not managed. Kamal can run "accessories" (Postgres, Redis) as Docker containers, but this is explicitly not recommended for production. Must use managed database or manage your own.

**Monitoring:** `kamal app logs` provides basic log access. No metrics, alerting, or observability. Must set up Prometheus/Grafana or similar externally.

**Disaster Recovery:** Not provided. Application containers are stateless and redeployable. Database and storage backups are your responsibility.

**SSL/Custom Domains:** Excellent. kamal-proxy handles automatic Let's Encrypt certificate issuance and renewal. Hostname-based routing is a first-class feature. Path-based routing also supported. Multiple apps on a single server with different hostnames work out of the box.

**Zero-Downtime Deploys:** Core feature. kamal-proxy manages the blue-green switchover seamlessly.

**Community/Support:** Growing community (Ruby/Rails ecosystem). MIT license aligns perfectly with open-source philosophy. Backed by 37signals (stable, profitable company). Active development. However, the community skews heavily toward Ruby/Rails -- Node.js/TypeScript usage is less common.

**Verdict:** Strong candidate for its simplicity, cost-effectiveness, and open-source alignment. The "deploy anywhere via SSH" model is elegant and avoids vendor lock-in. The main concerns are: (a) no programmatic API for tenant provisioning (must script around CLI), (b) no built-in monitoring or observability, (c) no auto-scaling (philosophy of over-provisioning), and (d) building the multi-tenant management layer is custom work. Best suited for a team that wants maximum control and minimal abstraction.

---

#### Summary Comparison

| Criterion                   | Kubernetes            | Fly.io               | Railway          | Coolify          | Docker Swarm     | Nomad             | Kamal            |
| --------------------------- | --------------------- | -------------------- | ---------------- | ---------------- | ---------------- | ----------------- | ---------------- |
| **Multi-tenant isolation**  | Excellent             | Strong               | Moderate         | Moderate         | Weak             | Good (Enterprise) | Moderate         |
| **Auto-scaling**            | Excellent             | Good (scale-to-zero) | Basic (manual)   | None             | None             | Enterprise only   | None             |
| **Cost @ 10 tenants**       | $250-400              | $80-150              | $150-300         | $30-60           | $20-50           | $40-80            | $30-60           |
| **Cost @ 100 tenants**      | $1,500-2,500          | $500-1,200           | $1,500-3,000     | $200-400         | $150-350         | $300-600          | $200-400         |
| **Cost @ 1000 tenants**     | $8,000-15,000         | $3,000-8,000         | $15,000-30,000   | $1,500-3,000     | $1,200-2,500     | $2,000-4,000      | $1,500-3,000     |
| **Ops burden (1-2 people)** | High                  | Low-Medium           | Low              | Medium           | Medium-High      | Medium-High       | Low-Medium       |
| **Secret management**       | Moderate              | Good (per-app)       | Basic (env vars) | Basic (env vars) | Weak             | Excellent (Vault) | Good (1Password) |
| **Database management**     | External              | External             | Built-in         | One-click + S3   | Manual           | Manual            | Manual           |
| **Monitoring**              | Excellent (ecosystem) | Basic                | Basic            | Basic            | None             | Moderate          | None             |
| **SSL / custom domains**    | Good (cert-manager)   | Excellent (API)      | Good             | Good             | Good (Traefik)   | Manual            | Excellent        |
| **Zero-downtime deploys**   | Yes                   | Yes                  | Yes              | Yes              | Yes              | Yes               | Yes              |
| **Programmatic tenant API** | Yes (K8s API)         | Yes (Machines API)   | Yes (GraphQL)    | Yes (REST)       | No               | Yes (HTTP API)    | No (CLI only)    |
| **Open-source aligned**     | Yes (CNCF)            | No (proprietary)     | No (proprietary) | Yes (AGPL)       | Yes (Apache 2.0) | No (BSL 1.1)      | Yes (MIT)        |
| **Vendor lock-in risk**     | Low                   | Medium               | High             | Low              | Low              | Medium (BSL)      | Low              |
| **Community trajectory**    | Massive, stable       | Growing              | Growing          | Large, growing   | Declining        | Stable, niche     | Growing          |

---

#### Recommendation

**Primary: Coolify + Hetzner (Phase 1), with migration path to Fly.io or Kubernetes (Phase 2+)**

**Phase 1 (0-100 tenants): Coolify on Hetzner**

Coolify is the best fit for Colophony's initial managed hosting because:

- **Cost-effective:** At $200-400/month for 100 tenants on Hetzner, the per-tenant infrastructure cost is $2-4/month, leaving ample margin for $25-75/month pricing.
- **Open-source aligned:** Coolify is AGPL-licensed and self-hosted, matching Colophony's values. No vendor dependency.
- **REST API for automation:** Coolify's OpenAPI-documented REST API enables building a tenant provisioning system (create project, add application, set environment variables, deploy, configure custom domain).
- **Built-in essentials:** Let's Encrypt SSL, custom domains, Docker Compose support, database deployment with S3 backups, git-push deploys.
- **Manageable ops burden:** The web dashboard handles day-to-day operations. Server management on Hetzner is straightforward. The 1-2 person team can handle this.
- **Familiar technology:** Docker-based deployments mean the same containers used for self-hosted Docker Compose work in Coolify.

**What you build on top of Coolify:**

- Tenant provisioning service (calls Coolify REST API to create/manage tenant instances)
- Shared infrastructure management (Postgres, Redis, MinIO as Coolify services)
- Monitoring stack (deploy Prometheus + Grafana via Coolify)
- Backup automation (Coolify's S3 backup for databases + custom scripts for verification)

**Risks to mitigate:**

- _Single-maintainer bus factor:_ Monitor Coolify project health. The 44,000+ star community and AGPL license mean forks are viable if needed.
- _Scaling limitations:_ At 100+ tenants, manual server management becomes tedious. This is when you evaluate Phase 2.
- _Docker Swarm immaturity:_ Avoid Coolify's Swarm features. Run single-server deployments per Coolify instance and add servers for capacity.

**Phase 2 (100-500 tenants): Evaluate Fly.io or Kamal**

If managed hosting grows beyond 100 tenants, re-evaluate:

- **Fly.io** if the team values auto-scaling and scale-to-zero (reduces cost for idle tenants, critical if many tenants have bursty traffic). The Machines API enables sophisticated tenant lifecycle management. Trade-off: vendor lock-in and higher per-unit cost.
- **Kamal** if the team values simplicity and wants to stay on Hetzner/bare-metal. Build a provisioning layer that generates Kamal configs and runs deployments. Trade-off: no auto-scaling, must build more tooling.

**Phase 3 (500+ tenants): Kubernetes**

At this scale, the economics and operational requirements justify Kubernetes. By this point, the team should be larger (dedicated platform/DevOps hire), revenue should support managed K8s costs, and the workload patterns will be well-understood.

**Why not the others?**

| Platform     | Elimination Reason                                                                |
| ------------ | --------------------------------------------------------------------------------- |
| Kubernetes   | Ops overhead too high for 1-2 person team at <500 tenants                         |
| Railway      | Too expensive at scale; not designed as multi-tenant hosting platform             |
| Docker Swarm | Declining ecosystem; weak isolation; too much custom tooling required             |
| Nomad        | BSL license conflicts with open-source values; Enterprise needed for key features |

**Architecture sketch for Phase 1 (Coolify + Hetzner):**

```
Hetzner Cloud
+-- Server 1: Coolify Manager (CX22, ~$4/mo)
|   +-- Coolify dashboard + agent
|
+-- Server 2-3: Shared Infrastructure (CX32, ~$7/mo each)
|   +-- PostgreSQL (shared, RLS-based multi-tenancy)
|   +-- Redis (shared, key-prefix isolation)
|   +-- MinIO (shared, bucket-per-tenant)
|   +-- Auth service (Keycloak/Zitadel, shared)
|   +-- Federation service (shared)
|   +-- Notification service (shared)
|
+-- Server 4-N: Tenant Workloads (CX22-CX32, ~$4-7/mo each)
|   +-- Tenant A: Core API + Web + Workers (containers)
|   +-- Tenant B: Core API + Web + Workers (containers)
|   +-- ... (density: ~5-10 tenants per CX32 server)
|
+-- Monitoring (CX22, ~$4/mo)
    +-- Prometheus
    +-- Grafana
    +-- Loki (logs)

Total for 50 tenants: ~8-10 servers = ~$50-70/mo infrastructure
```

**Per-tenant density estimate:** A small literary magazine tenant (Core API 256MB + Web 128MB + Workers 128MB = ~512MB) can fit approximately 10-15 tenants per CX32 server (8GB RAM). This assumes shared infrastructure (DB, Redis, MinIO, Auth) runs on separate servers.

#### Senior Dev Review Additions

**Monitoring stack — Phase 1 requirement (HIGH PRIORITY):**

Deploy Prometheus + Grafana + Loki via Coolify alongside application services from day one. Without this, you're flying blind on tenant resource usage, which is critical for capacity planning and knowing when to add servers.

```yaml
# coolify-monitoring.yml (deployed via Coolify)
services:
  prometheus:
    image: prom/prometheus:latest
  grafana:
    image: grafana/grafana:latest
  loki:
    image: grafana/loki:latest
```

**Backup verification — weekly automated restore (HIGH PRIORITY):**

Coolify backs up to S3, but verification is manual. Create a weekly cron job from day one that:

1. Restores latest DB backup to a test instance
2. Runs smoke tests (basic query, RLS check, data integrity)
3. Alerts on failure (email or Slack webhook)

This is table stakes for a platform hosting other people's data — not "we'll add it later."

**Coolify bus factor monitoring:**

Monitor Coolify GitHub activity monthly (commits, issue responses, release frequency). The 44K+ stars and AGPL license are genuine safety nets — a community fork is viable if needed. Budget for "worst case: maintain a fork" (~10-20% dev time).

**Cost modeling — break-even analysis:**

Build a spreadsheet before pricing decisions covering:

- Infrastructure cost per tenant at 10/50/100/500 scale
- Required pricing to achieve 60% gross margin (industry standard for SaaS)
- Break-even tenant count for Phase 1 infrastructure
- Current estimates: $2-4/tenant infra cost supports $25-75/month pricing with healthy margins

**Hetzner documentation:**

Hetzner is ~40% cheaper than DigitalOcean for equivalent specs but has less documentation. Create a `docs/deployment/hetzner-setup.md` with common setup gotchas (firewall rules, IPv6 defaults, API token setup) to help contributors unfamiliar with Hetzner.

#### Sources

- [Fly.io Pricing](https://fly.io/pricing/)
- [Fly.io Resource Pricing Documentation](https://fly.io/docs/about/pricing/)
- [Fly.io Custom Domains and Certificate Automation](https://fly.io/docs/networking/custom-domain-api/)
- [Fly.io Machines API Overview](https://fly.io/docs/machines/overview/)
- [Fly.io Multi-Tenant Community Discussion](https://community.fly.io/t/multi-tenant-applications/375)
- [Railway Pricing](https://railway.com/pricing)
- [Railway Pricing Plans Documentation](https://docs.railway.com/reference/pricing/plans)
- [Railway Public API Documentation](https://docs.railway.com/guides/public-api)
- [Coolify Official Site](https://coolify.io/)
- [Coolify Documentation](https://coolify.io/docs/)
- [Coolify Pricing](https://coolify.io/pricing/)
- [Coolify Scalability Documentation](https://coolify.io/docs/knowledge-base/internal/scalability)
- [Coolify REST API Reference](https://coolify.io/docs/api-reference/api/operations/deploy-by-tag-or-uuid)
- [Coolify GitHub Repository](https://github.com/coollabsio/coolify)
- [Kamal Official Site](https://kamal-deploy.org/)
- [Kamal Proxy Configuration](https://kamal-deploy.org/docs/configuration/proxy/)
- [Kamal Secrets and Environment Variables](https://kamal-deploy.org/docs/configuration/environment-variables/)
- [Deploying Multiple Apps with Kamal 2 (Honeybadger)](https://www.honeybadger.io/blog/new-in-kamal-2/)
- [Running Multiple Apps on Single Server with Kamal 2](https://nts.strzibny.name/multiple-apps-single-server-kamal-2/)
- [Kamal vs PaaS Comparison (Judoscale)](https://judoscale.com/blog/kamal-vs-paas)
- [GKE Multi-Tenancy Best Practices](https://docs.google.com/kubernetes-engine/docs/best-practices/enterprise-multitenancy)
- [GKE Pricing](https://cloud.google.com/kubernetes-engine/pricing)
- [Kubernetes Cost: EKS vs AKS vs GKE (Sedai)](https://sedai.io/blog/kubernetes-cost-eks-vs-aks-vs-gke)
- [Docker Swarm vs Kubernetes 2026 (Reintech)](https://reintech.io/blog/kubernetes-vs-docker-swarm-2026-comparison)
- [Docker Compose vs Docker Swarm Guidance (TheLinuxCode)](https://thelinuxcode.com/docker-compose-vs-docker-swarm-practical-differences-real-tradeoffs-and-2026-ready-guidance/)
- [HashiCorp BSL License Announcement](https://www.hashicorp.com/en/blog/hashicorp-adopts-business-source-license)
- [Nomad Enterprise Features](https://developer.hashicorp.com/nomad/docs/enterprise)
- [Self-Hosted Deployment Tools Compared (Haloy)](https://haloy.dev/blog/self-hosted-deployment-tools-compared)
- [Best VPS Providers for Self-Hosting 2026](https://selfhostable.dev/blog/best-vps-providers-for-self-hosting-2026/)
- [Hetzner Cloud Plans Announcement](https://datacentrenews.uk/story/hetzner-unveils-new-cloud-server-plans-from-eur-3-79-per-month)
- [DigitalOcean vs Hetzner Comparison](https://getdeploying.com/digitalocean-vs-hetzner)

### 5.5 API Layer Architecture

> **Researched:** 2026-02-11
> **Status:** Complete — recommendation provided
> **Full research:** [docs/api-layer-v2-research.md](api-layer-v2-research.md) (1,311 lines)

#### Executive Summary

Colophony needs three API surfaces serving different audiences:

| Surface     | Audience                     | Purpose                                        |
| ----------- | ---------------------------- | ---------------------------------------------- |
| **tRPC**    | Internal web frontend        | Type-safe, fast iteration — unchanged from MVP |
| **REST**    | Public API, webhooks, Zapier | Widest compatibility, primary public API       |
| **GraphQL** | Power users, Chill Subs      | Flexible queries, aggregator integration       |

**Critical insight:** All three surfaces share the same service layer and Zod schemas. The API surface is a thin adapter over shared business logic.

#### Key Recommendations

| Decision                    | Choice                             | Rationale                                                                             |
| --------------------------- | ---------------------------------- | ------------------------------------------------------------------------------------- |
| **GraphQL framework**       | Pothos (code-first) + GraphQL Yoga | Best Prisma integration, Zod via StandardSchema, no codegen, active maintenance       |
| **REST framework**          | ts-rest (contract-first)           | Native Zod schemas, OpenAPI 3.1 generation, NestJS adapter, typed client              |
| **Shared validation**       | Zod (runtime, single source)       | Already the source of truth in MVP; all three surfaces consume directly               |
| **REST versioning**         | URL path (`/v1/`)                  | Explicit, cacheable, well-understood; Stripe-style change modules later               |
| **GraphQL versioning**      | Schema evolution (no versions)     | Industry standard; field deprecation + usage tracking                                 |
| **Rate limiting (GraphQL)** | Cost-based (1000 pts/min)          | Prevents expensive queries; used by GitHub and Shopify                                |
| **Auth for public API**     | API keys + JWT                     | API keys for scripts/CI, JWT for interactive sessions, OAuth2 in Phase 2              |
| **SDK generation**          | Speakeasy                          | OpenAPI-native, webhook support, free OSS tier, multi-language (TS, Python, Ruby, Go) |

#### Migration Path (8 weeks)

1. **Phase 1 (Weeks 1-2):** Extract service layer from tRPC routers into NestJS Injectable services. Zero external impact.
2. **Phase 2 (Weeks 3-4):** Add REST surface with ts-rest contracts, API key auth, OpenAPI spec at `/v1/`.
3. **Phase 3 (Weeks 5-6):** Add GraphQL surface with Pothos + Yoga, cost-based rate limiting at `/graphql`.
4. **Phase 4 (Week 7):** SDK generation with Speakeasy (TypeScript, Python, Ruby, Go).
5. **Phase 5 (Week 8):** API docs, getting started guides, webhook docs, rate limit docs.

#### New Dependencies

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
    "graphql-yoga": "^5.x",
    "graphql": "^16.x",
    "dataloader": "^2.x"
  }
}
```

> **Note:** Dependencies updated for Fastify (5.1) and Drizzle (5.2). Removed: `@ts-rest/nest` → `@ts-rest/fastify`, `@pothos/plugin-prisma` (no Drizzle equivalent), `@graphql-yoga/nestjs` (Yoga integrates with Fastify directly). Added: `dataloader` for manual N+1 prevention.

> See [docs/api-layer-v2-research.md](api-layer-v2-research.md) for complete architecture diagrams, code examples, endpoint mapping tables, and risk assessment. Updated 2026-02-11 for Fastify + Drizzle decisions.

#### Senior Dev Review: Pothos + Drizzle Integration (CRITICAL)

The original Pothos recommendation scored 39/50, built heavily on `@pothos/plugin-prisma` (auto-mapped types, built-in dataloader, Relay pagination). With Drizzle (5.2 recommendation), all three features are unavailable. Revised score: **~29/50**, making TypeGraphQL competitive (~31/50).

**Two paths evaluated:**

|                      | Option A: Keep Pothos                                                         | Option B: Switch to TypeGraphQL                                                 |
| -------------------- | ----------------------------------------------------------------------------- | ------------------------------------------------------------------------------- |
| **Zod integration**  | Native (StandardSchema) — single validation source across tRPC, REST, GraphQL | None — requires class-validator, duplicating Zod schemas                        |
| **Type definitions** | Manual from Drizzle schema                                                    | Manual (class-based decorators)                                                 |
| **Dataloader**       | Manual setup with `dataloader` package                                        | First-class built-in support                                                    |
| **Pagination**       | Manual cursor implementation                                                  | Easier with community patterns                                                  |
| **Ongoing cost**     | One-time manual setup                                                         | Ongoing validation duplication (Zod for tRPC/REST, class-validator for GraphQL) |
| **Extra effort**     | 2-3 weeks initial, +30min/model                                               | 1-2 weeks initial, ongoing friction                                             |

**Decision: Keep Pothos (Option A).** The real value is single source of truth for validation (Zod) across all three API surfaces. Manual dataloader/pagination is a one-time cost. Validation duplication in Option B is ongoing friction that compounds as the schema evolves.

**What manual Pothos + Drizzle looks like:**

```typescript
// Manual GraphQL type definition from Drizzle schema
import { builder } from "../builder";
import type { InferSelectModel } from "drizzle-orm";
import { submissions } from "@colophony/db";

type Submission = InferSelectModel<typeof submissions>;

builder.objectType("Submission", {
  fields: (t) => ({
    id: t.exposeID("id"),
    title: t.exposeString("title"),
    status: t.exposeString("status"),
    createdAt: t.expose("createdAt", { type: "DateTime" }),
    // Relations resolved via dataloader (no N+1)
    files: t.field({
      type: [FileObject],
      resolve: (submission, _args, ctx) =>
        ctx.loaders.submissionFiles.load(submission.id),
    }),
  }),
});
```

```typescript
// Manual dataloader setup
import DataLoader from "dataloader";

export function createLoaders(db: DrizzleDB) {
  return {
    submissionFiles: new DataLoader(async (ids: readonly string[]) => {
      const files = await db.query.submissionFiles.findMany({
        where: inArray(submissionFiles.submissionId, [...ids]),
      });
      return ids.map((id) => files.filter((f) => f.submissionId === id));
    }),
  };
}
```

**GraphQL Yoga + Fastify integration** (replaces `@graphql-yoga/nestjs`):

```typescript
import { createYoga } from "graphql-yoga";
import Fastify from "fastify";

const yoga = createYoga({ schema });
const app = Fastify();

app.route({
  url: "/graphql",
  method: ["GET", "POST"],
  handler: async (req, reply) => {
    const response = await yoga.handleNodeRequest(req, { req, reply });
    response.headers.forEach((value, key) => reply.header(key, value));
    reply.status(response.status);
    reply.send(response.body);
  },
});
```

**Done:** `docs/api-layer-v2-research.md` updated 2026-02-11 — NestJS → Fastify, Prisma → Drizzle throughout. Evaluation tables retained for reference.

#### Senior Dev Review: Additional API Layer Notes

**Timeline adjustment (10-12 weeks, not 8):**

The 8-week estimate is aggressive given the adapter compatibility unknowns. Revised budget:

1. **Weeks 1-3:** Extract service layer from tRPC routers into shared services
2. **Weeks 4-6:** Add REST surface with ts-rest + Fastify, API key auth, OpenAPI spec
3. **Weeks 7-9:** Add GraphQL surface with Pothos + Yoga (extra time for manual Drizzle type definitions)
4. **Week 10:** Rate limiting implementation and testing across all surfaces
5. **Weeks 11-12:** SDK generation (TypeScript + Python only initially; Ruby + Go in Phase 2) + docs

**GraphQL cost model documentation:**

Document point costs clearly for API consumers:

- Simple field query: 1 point
- Relation traversal: 2 points
- Mutation: 5 points
- List fields: multiplied by `first`/`limit` argument (default 20)
- Nested pagination: multiplicative

Provide a playground query cost estimator. Use [GitHub's GraphQL rate limit docs](https://docs.github.com/en/graphql/overview/rate-limits-and-query-limits-for-the-graphql-api) as reference.

**SDK generation scope:**

Start with TypeScript + Python SDKs only. Ruby + Go can follow in a later phase. Budget 1-2 weeks for SDK setup (config, CI/CD, generated docs). Test generated SDKs in real-world scenarios (`npm link`, `pip install -e`) before publishing.

### 5.6 Form Builder Architecture

> **Researched:** 2026-02-11
> **Status:** Complete — recommendation provided
> **Full research:** [docs/form-builder-research.md](form-builder-research.md) (1,249 lines)

#### Executive Summary

Colophony needs a Submittable-level form builder with 15 field types, conditional logic, file uploads, and embeddable forms. After evaluating SurveyJS, Formbricks, Form.io, Typebot, HeyForm, and Tripetto, the recommendation is to **build custom**.

#### Key Recommendations

| Decision               | Choice                                                  | Rationale                                                                           |
| ---------------------- | ------------------------------------------------------- | ----------------------------------------------------------------------------------- |
| **Form schema format** | Custom (Form.io-inspired components array)              | Simple, flat, optimized for literary submissions. No over-engineering.              |
| **Schema storage**     | PostgreSQL JSONB column                                 | Consistent with existing stack. Queryable with GIN indexes.                         |
| **Form builder UI**    | Custom with dnd-kit + shadcn/ui                         | Full control, no license dependencies, consistent with existing UI.                 |
| **DnD library**        | dnd-kit (`@dnd-kit/core` + `@dnd-kit/sortable`)         | Best accessibility, hooks-based, proven for form builders. Pragmatic DnD as backup. |
| **Conditional logic**  | Custom rule engine (JSON Logic-inspired)                | Simple, performant, serializable. No external dependency.                           |
| **Embeddable forms**   | iframe (Phase 1) + Web Component wrapper (Phase 2)      | Complete style/security isolation, simple auth, works everywhere.                   |
| **File uploads**       | Existing tus pipeline, file references in form response | No new infrastructure needed.                                                       |
| **Validation**         | Zod schemas generated from form definition at runtime   | Server-side + client-side, consistent with existing stack.                          |

#### Form Field Types (15)

`text`, `textarea`, `rich_text`, `number`, `email`, `url`, `date`, `select`, `multi_select`, `radio`, `checkbox`, `checkbox_group`, `file_upload`, `section_header`, `info_text`

#### Schema Design (Form.io-Inspired)

Forms stored as a `FormDefinition` JSON with a `fields` array. Each field has: `id`, `key`, `type`, `label`, `description`, `placeholder`, `validate` (required, min/max, pattern), `conditional` (SHOW/HIDE/ENABLE/DISABLE/REQUIRE with AND/OR rule groups), and type-specific `properties`.

#### Database Changes

- `FormDefinition` table (JSONB `definition` column, versioned, org-scoped with RLS)
- `FormResponse` table (JSONB `data` column, links to `Submission`, references form version)
- `SubmissionPeriod` gains optional `formDefinitionId` FK

#### Implementation Phases (13-18 weeks)

1. **Phase 1: Complete Builder (6-8 weeks)** — DB tables + RLS, Zod schemas, tRPC router, builder UI (palette + canvas + properties), renderer, all 15 field types including file upload (tus + virus scanning)
2. **Phase 2: Conditional Logic + Preview (3-4 weeks)** — Rule engine + builder UI (SHOW/HIDE first, then ENABLE/DISABLE/REQUIRE), live preview, form versioning
3. **Phase 3: Embeddable Forms (2-3 weeks)** — Public form page, iframe embed with auto-resize, auth flow, analytics
4. **Phase 4: Polish (2-3 weeks)** — Templates (Fiction, Poetry, Nonfiction, Visual Art), duplicate/export/import

#### New Dependencies

```json
{
  "@dnd-kit/core": "^6.3",
  "@dnd-kit/sortable": "^8.0",
  "@dnd-kit/utilities": "^3.2"
}
```

No other new dependencies. Uses existing shadcn/ui, Zod, react-hook-form, and tus-js-client.

> See [docs/form-builder-research.md](form-builder-research.md) for complete TypeScript interfaces, example form JSON, conditional logic engine design, WCAG accessibility requirements, and architecture diagrams.

#### Senior Dev Review Additions

**Revised implementation phases:**

No time constraints. Implement all 15 field types in Phase 1 to enable complete end-to-end testing with real literary magazine editors from the start. A form builder that can't accept manuscripts, handle radio buttons for common questions ("Is this a simultaneous submission?"), or support rich text cover letters is not testable with real users.

1. **Phase 1: Complete Builder (6-8 weeks)** — DB tables + RLS, Zod schemas, tRPC router, builder UI (palette + canvas + properties), renderer, **all 15 field types** including file upload (tus integration with virus scanning). Phase 1 deliverable: a functional submission form that collects text, selections, files, and all field variations, with uploads virus-scanned and associated with submissions for review.
2. **Phase 2: Conditional Logic + Preview (3-4 weeks)** — Conditional logic engine + rule builder UI (start with SHOW/HIDE only, add ENABLE/DISABLE/REQUIRE after), live preview in builder, form versioning. Defer SET_VALUE to a future phase (complex, rarely needed).
3. **Phase 3: Embeddable Forms (2-3 weeks)** — Public form page, iframe embed with auto-resize via postMessage, auth flow within iframe, form analytics. Don't block v2 launch on Web Component wrapper — iframe is sufficient for 95% of use cases.
4. **Phase 4: Polish (2-3 weeks)** — Templates (Fiction, Poetry, Nonfiction, Visual Art), duplicate form, export/import JSON, keyboard shortcut cheat sheet for builder UI.

**Conditional logic — start simple:**

- Phase 2 initially: `SHOW`/`HIDE` effects only
- Phase 2 later: Add `ENABLE`/`DISABLE` and `REQUIRE`
- Defer `SET_VALUE` to a future phase (complex and rarely needed for literary submission forms)

**Embeddable forms — iframe is sufficient for v2.0:**

- Don't block v2 launch on the Web Component wrapper
- iframe covers 95% of use cases (WordPress, Squarespace, custom sites)
- Web Component becomes relevant when magazines want "native" embed (no iframe border) — this is a post-launch enhancement
- Plan for: CORS for postMessage communication, auto-resize script, style isolation

**Visual regression testing (RECOMMENDED):**

For a drag-and-drop UI with many field types, add visual regression testing to prevent accidental style breakage:

- Playwright screenshot comparisons (already in the stack)
- Or Percy/Chromatic for more sophisticated diffing
- Run on PRs that touch `components/form-builder/` or `components/form-renderer/`

**Accessibility target: WCAG 2.1 AA (not AAA).**

The research correctly targets AA. AAA is only required for government/healthcare — literary magazines need solid accessibility but not the strictest tier.

### 5.7 Federation Protocol

**Research date:** 2026-02-11
**Status:** Complete -- recommendation ready for review

#### 5.7.1 Executive Summary

**Recommendation: WebFinger + Custom REST Protocol (Option 5), with `did:web` identity anchoring.**

ActivityPub is designed for social networking (follows, boosts, timelines) and brings enormous complexity for features Colophony does not need. Matrix is even heavier. Pure OAuth2 federation solves identity but not submission operations. A purpose-built protocol using WebFinger for discovery and a custom REST API for operations gives Colophony exactly what it needs with minimal complexity, while remaining standards-based and interoperable.

Key insight from research: **Colophony's federation needs are fundamentally different from social networking.** The Fediverse protocols solve content distribution, social graphs, and timelines. Colophony needs cross-instance identity, submission status queries, and piece transfers. Building on proven discovery standards (WebFinger, `did:web`) while defining a domain-specific operations protocol is the pragmatic path.

---

#### 5.7.2 Protocol Candidate Evaluation

##### Evaluation Criteria

| Criterion                            | Weight | Rationale                                                     |
| ------------------------------------ | ------ | ------------------------------------------------------------- |
| **Complexity for Colophony's needs** | High   | Small team, must ship. Unnecessary complexity is a liability. |
| **Identity portability**             | High   | Core requirement: submitters move between instances.          |
| **Sim-sub enforcement**              | High   | Novel requirement with no existing solution.                  |
| **Privacy / data minimization**      | High   | Submission data is sensitive creative work.                   |
| **Standards compliance**             | Medium | Prefer standards, but not at the cost of fitness-for-purpose. |
| **Ecosystem / tooling**              | Medium | Libraries, documentation, community support.                  |
| **Self-hosted friendliness**         | Medium | Must work on a $10/month VPS.                                 |
| **Extensibility**                    | Medium | Protocol should support future needs without redesign.        |

##### Candidate 1: ActivityPub (W3C Standard)

**What it is:** W3C recommendation for decentralized social networking. JSON-LD over HTTP. Used by Mastodon, Lemmy, Pixelfed, PeerTube, WordPress.

**Pros:**

- W3C standard with broad adoption (13M+ accounts across the Fediverse)
- Well-understood federation model
- Rich TypeScript tooling via [Fedify](https://fedify.dev/) framework (funded by Sovereign Tech Fund, EUR 192k over 2025-2026)
- Instance discovery via WebFinger already built in
- HTTP Signatures for server-to-server authentication
- NestJS integration available (`@fedify/nestjs`)

**Cons:**

- Designed for social networking: the Activity/Object/Actor model maps poorly to submissions
- Requires JSON-LD processing (complex, error-prone, performance overhead)
- HTTP Signatures are [acknowledged as inadequate](https://swicg.github.io/activitypub-http-signature/) for comprehensive authentication
- Every implementation does ActivityPub slightly differently (interoperability is hard-won)
- Significant surface area that Colophony would never use (Following, Liking, Boosting, Timelines)
- Content moderation and spam tooling is immature across the Fediverse
- Defederation is a blunt instrument (all-or-nothing server block)

**Lessons from the Fediverse:**

_Mastodon:_

- Account migration moves followers but **not posts** due to technical limitations. 30-day cooldown between migrations. Alias system required on both ends.
- Spam handling is weak: defederation permanently cuts all connections. Silencing (temporary mute) is more practical but still crude.
- Volunteer-run servers lack tools to address harmful content in bulk (post-by-post moderation).
- Defederation makes servers responsible for the conduct of all their members (collective punishment model).

_Lemmy:_

- Different ActivityPub implementations require per-implementation "interpreters" -- cross-software federation is fragile.
- Backwards compatibility is maintained through careful activity versioning, but requires ongoing effort.
- Federation between Lemmy and PeerTube remains incomplete years after initial support: comments and likes do not reliably federate.

_Pixelfed:_

- Database schema decisions made before federation was implemented required significant refactoring later.
- Security vulnerability in v0.12.4: private accounts could be followed without approval due to incorrect ActivityPub Follow implementation.
- Federation between Pixelfed instances is "really lacking and inconsistent" per open issues.

_WordPress ActivityPub:_

- Actor modeling using virtual users creates friction and workarounds as features grow.
- Bulk federation (sending to 1000+ followers) required building a staggered delivery system from scratch.
- FEP (Fediverse Enhancement Proposal) approaches that work for simple apps break down for complex systems.

**Verdict: NOT RECOMMENDED.** ActivityPub brings enormous complexity for features Colophony does not need, while providing no built-in solution for Colophony's novel requirements (sim-sub enforcement, piece transfer). The Fediverse's ongoing struggles with interoperability, spam, and moderation further argue against adopting this protocol for a domain-specific application.

---

##### Candidate 2: Custom REST-based Federation

**What it is:** Purpose-built REST API that instances expose to each other for federation operations.

**Pros:**

- Total control over protocol design -- maps exactly to Colophony's domain
- Simple to implement and understand
- No unnecessary protocol overhead
- Can be versioned independently
- Easy to test and debug

**Cons:**

- No existing ecosystem or tooling
- Colophony-specific: no interoperability with other systems
- Must solve discovery, authentication, and trust from scratch
- Risk of poor protocol design without external review
- "Not Invented Here" perception

**Verdict: PARTIALLY RECOMMENDED as the operations layer.** A custom REST API is the right approach for Colophony-specific operations (sim-sub checks, piece transfers), but it should be built on top of existing standards for discovery and identity rather than reinventing everything.

---

##### Candidate 3: OAuth2-based Federation

**What it is:** Each instance acts as both an OAuth2 provider and consumer. Cross-instance identity established via OAuth2 authorization code flow.

**Pros:**

- Well-understood protocol with mature libraries
- Solves cross-instance identity naturally
- Works with existing auth services (Keycloak, Zitadel, etc.)
- Fine-grained scope-based authorization

**Cons:**

- Only solves identity, not operations (sim-sub enforcement, transfers)
- OAuth2 is designed for delegated authorization, not peer-to-peer federation
- Each instance pair requires bilateral OAuth2 client registration
- Does not scale well to many instances without a central registry
- Token management across many instances becomes complex

**Verdict: NOT RECOMMENDED as the primary protocol.** OAuth2 solves a subset of the problem (identity) but requires a separate protocol for operations. The bilateral registration model does not scale for open federation.

---

##### Candidate 4: Matrix Protocol

**What it is:** Decentralized, end-to-end encrypted communication protocol. Designed for real-time messaging, but extensible.

**Pros:**

- Strong encryption and privacy model
- Decentralized with no single point of failure
- Rich state synchronization
- Active development and growing ecosystem

**Cons:**

- Designed for real-time messaging (rooms, events, streams) -- poor fit for submissions
- Resource-intensive: full room state synchronization, JSON processing overhead, significant memory/CPU usage
- Acknowledged as overly complex even for its intended use case
- Very few non-messaging applications
- Massive operational overhead for self-hosted deployments (Synapse server is resource-hungry)
- No relevant prior art for domain-specific federation

**Verdict: NOT RECOMMENDED.** Matrix is solving a fundamentally different problem (real-time communication). Its resource requirements and complexity are unjustifiable for Colophony's federation needs.

---

##### Candidate 5: WebFinger + Custom Protocol (RECOMMENDED)

**What it is:** Use WebFinger (RFC 7033) for instance and identity discovery, `did:web` for identity anchoring, and a custom REST protocol for Colophony-specific operations.

**Pros:**

- WebFinger is an IETF standard used by Mastodon, Diaspora, OpenID Connect -- proven at scale
- `did:web` leverages existing web infrastructure (domain names, HTTPS) -- no blockchain, no external dependencies
- Custom operations protocol maps exactly to Colophony's domain
- Minimal complexity: only what is needed
- Discovery is standards-based; operations are domain-specific
- Easy to implement incrementally
- Lightweight enough for a $10/month VPS

**Cons:**

- Operations protocol is Colophony-specific (but this is also a pro -- it fits the domain)
- Must design the operations protocol carefully (but this is true regardless)
- Less "prestigious" than adopting a W3C standard

**Verdict: RECOMMENDED.** This approach uses proven standards where standards exist (discovery, identity) and builds domain-specific protocols where no existing standard fits (submission operations). It is the most pragmatic path.

---

##### Candidate 6: OpenID Connect Federation

**What it is:** OIDC Federation 1.0 extends OpenID Connect with a trust layer. Trust chains allow instances to establish trust without bilateral registration.

**Pros:**

- Solves trust establishment at scale through trust anchors and chains
- Dynamic metadata exchange and key verification
- Supported by Keycloak (experimental) and growing ecosystem
- Eliminates bilateral OAuth2 client registration

**Cons:**

- Complex: trust chains, intermediate authorities, signed metadata
- Still primarily an identity/auth protocol -- does not cover operations
- Young standard with limited real-world deployment
- Overkill for Colophony's trust model (likely tens to hundreds of instances, not millions)
- Requires understanding of PKI and trust chain concepts

**Verdict: NOT RECOMMENDED for initial implementation.** Interesting for future consideration if the federation grows to hundreds of instances, but the complexity is not justified for Colophony's initial scale. Elements of OIDC Federation (signed metadata, capability documents) inform the recommended design.

---

#### 5.7.3 Protocol Comparison Matrix

| Criterion                   |   ActivityPub   |  Custom REST  |    OAuth2    |   Matrix   |      WebFinger + Custom      |   OIDC Fed   |
| --------------------------- | :-------------: | :-----------: | :----------: | :--------: | :--------------------------: | :----------: |
| Fits Colophony's domain     |      Poor       |   Excellent   |   Partial    |    Poor    |          Excellent           |   Partial    |
| Implementation complexity   |    Very High    |    Medium     |    Medium    | Very High  |            Medium            |     High     |
| Identity portability        |      Weak       |  Must build   |     Good     |    N/A     |        Good (did:web)        |     Good     |
| Sim-sub enforcement         |   Must build    |  Must build   |  Must build  | Must build |          Must build          |  Must build  |
| Discovery                   |    Built-in     |  Must build   |     N/A      |  Built-in  |     WebFinger (standard)     |   Built-in   |
| Trust establishment         | HTTP Signatures |  Must build   | OAuth2 flows |  Built-in  |          Must build          | Trust chains |
| Privacy / data minimization |      Weak       | Full control  |     Good     |   Strong   |         Full control         |     Good     |
| Standards compliance        |       W3C       |     None      |     IETF     | Matrix.org | IETF (WebFinger) + W3C (DID) |     OIDF     |
| Self-hosted resource usage  |     Medium      |      Low      |     Low      |    High    |             Low              |    Medium    |
| Ecosystem / tooling         |  Good (Fedify)  |     None      |  Excellent   |    Good    |    Good (WebFinger libs)     |   Limited    |
| Extensibility               | Activity types  | Versioned API |    Scopes    | Room types |        Versioned API         |    Claims    |
| Time to implement           |    6+ months    |  2-3 months   |  1-2 months  | 6+ months  |          3-4 months          |  4-5 months  |

---

#### 5.7.4 Recommended Architecture: Colophony Federation Protocol (CFP)

##### Overview

The Colophony Federation Protocol consists of four layers:

```
+----------------------------------------------+
|  Layer 4: Domain Operations                   |
|  (sim-sub check, piece transfer, status)      |
+----------------------------------------------+
|  Layer 3: Identity                            |
|  (did:web, identity claims, key exchange)     |
+----------------------------------------------+
|  Layer 2: Trust                               |
|  (instance registration, capability docs,     |
|   signed metadata, allowlist/blocklist)       |
+----------------------------------------------+
|  Layer 1: Discovery                           |
|  (WebFinger, .well-known endpoints,           |
|   instance metadata)                          |
+----------------------------------------------+
```

##### Layer 1: Discovery (WebFinger + .well-known)

Instances discover each other using standard WebFinger and `.well-known` endpoints.

**Instance metadata endpoint:**

```
GET https://magazine.example/.well-known/colophony
```

Returns:

```json
{
  "version": "1.0",
  "software": "colophony",
  "softwareVersion": "2.1.0",
  "protocols": ["cfp/1.0"],
  "capabilities": ["identity", "sim-sub-check", "piece-transfer"],
  "federation": {
    "mode": "allowlist",
    "publicKey": "-----BEGIN PUBLIC KEY-----\n...",
    "keyId": "https://magazine.example/federation/keys/2026-01"
  },
  "publications": [
    {
      "id": "pub_abc123",
      "name": "The Quarterly Review",
      "slug": "quarterly-review",
      "url": "https://magazine.example/quarterly-review"
    }
  ],
  "contact": "admin@magazine.example"
}
```

**Submitter identity discovery (WebFinger):**

```
GET https://magazine.example/.well-known/webfinger
    ?resource=acct:author@magazine.example
```

Returns:

```json
{
  "subject": "acct:author@magazine.example",
  "aliases": ["did:web:magazine.example:users:author"],
  "links": [
    {
      "rel": "self",
      "type": "application/json",
      "href": "https://magazine.example/federation/actors/author"
    },
    {
      "rel": "https://colophony.dev/ns/submitter-profile",
      "type": "application/json",
      "href": "https://magazine.example/federation/submitters/author"
    }
  ]
}
```

##### Layer 2: Trust Establishment

Three trust models, configurable per instance:

| Model           | Description                                                  | Use Case                           |
| --------------- | ------------------------------------------------------------ | ---------------------------------- |
| **Open**        | Any Colophony instance can federate                          | Public/discovery-focused instances |
| **Allowlist**   | Only pre-approved instances (default)                        | Most magazines                     |
| **Managed Hub** | All managed-hosting instances trust each other automatically | Colophony managed hosting          |

**Trust establishment flow (allowlist mode):**

```
Instance A (magazine.example)          Instance B (review.example)
         |                                      |
         |  1. Admin navigates to federation     |
         |     settings, enters review.example   |
         |                                      |
         |---- 2. GET /.well-known/colophony -->|
         |<--- 3. Return instance metadata -----|
         |                                      |
         |  4. Admin reviews metadata, confirms  |
         |                                      |
         |---- 5. POST /federation/trust ------>|
         |     { instanceUrl, publicKey,         |
         |       requestedCapabilities,          |
         |       signedWith: A's private key }   |
         |                                      |
         |  6. Instance B admin receives         |
         |     federation request notification   |
         |                                      |
         |<--- 7. POST /federation/trust/accept -|
         |     { instanceUrl, publicKey,         |
         |       grantedCapabilities,            |
         |       signedWith: B's private key }   |
         |                                      |
         |  [Trust established bilaterally]       |
         |                                      |
```

**Managed hosting hub model:**

When Colophony operates managed hosting, all managed instances share a trust anchor:

```
                    +------------------+
                    | Colophony Hub   |
                    | (Trust Anchor)   |
                    |                  |
                    | Signs instance   |
                    | certificates     |
                    +--------+---------+
                             |
               +-------------+-------------+
               |             |             |
       +-------+--+  +------+---+  +------+---+
       | Managed  |  | Managed  |  | Self-    |
       | Inst. A  |  | Inst. B  |  | hosted   |
       |          |  |          |  | Inst. C  |
       +----------+  +----------+  +----------+
        auto-trust    auto-trust    allowlist
```

Managed instances auto-trust each other (signed by the hub). Self-hosted instances go through the allowlist flow with any instance (managed or self-hosted).

**Server-to-server authentication:**

All federation requests are signed using Ed25519 keys with HTTP Message Signatures (RFC 9421 -- the successor to the draft HTTP Signatures used by ActivityPub). Each request includes:

```
Signature-Input: sig1=("@method" "@target-uri" "content-digest" "date");
  keyid="https://magazine.example/federation/keys/2026-01";
  created=1707600000;alg="ed25519"
Signature: sig1=:base64-encoded-signature:
Content-Digest: sha-256=:base64-encoded-digest:
```

This is a significant improvement over ActivityPub's use of the older, draft HTTP Signatures spec.

##### Layer 3: Identity (did:web)

**Why `did:web`:**

| DID Method | Pros                                                            | Cons                                                   | Verdict                           |
| ---------- | --------------------------------------------------------------- | ------------------------------------------------------ | --------------------------------- |
| `did:web`  | Uses existing web infrastructure, easy to deploy, no blockchain | Requires domain availability, not offline-capable      | Best fit for Colophony            |
| `did:key`  | Offline, no server needed, generated from key pair              | No human-readable identifier, key loss = identity loss | Too bare for user-facing identity |
| `did:plc`  | Portable (Bluesky uses it), registry-based                      | Single registry (centralization risk), complex         | Interesting but dependency-heavy  |

**Submitter identity format:**

```
did:web:magazine.example:users:alice
```

This resolves to:

```
GET https://magazine.example/users/alice/did.json
```

Returns:

```json
{
  "@context": "https://www.w3.org/ns/did/v1",
  "id": "did:web:magazine.example:users:alice",
  "authentication": [
    {
      "id": "did:web:magazine.example:users:alice#key-1",
      "type": "Ed25519VerificationKey2020",
      "controller": "did:web:magazine.example:users:alice",
      "publicKeyMultibase": "z6MkhaXgBZDvotDkL5257faiztiGiC2QtKLGpbnnEGta2doK"
    }
  ],
  "service": [
    {
      "id": "did:web:magazine.example:users:alice#colophony",
      "type": "ColophonySubmitter",
      "serviceEndpoint": "https://magazine.example/federation/submitters/alice"
    }
  ]
}
```

**Identity portability (account migration):**

When a submitter moves from Instance A to Instance B:

```
Instance A                   Submitter                   Instance B
    |                            |                            |
    |                            |-- 1. Create account ------>|
    |                            |                            |
    |                            |-- 2. Request migration --->|
    |                            |    (prove ownership of     |
    |                            |     did:web:a.example:     |
    |                            |     users:alice by         |
    |                            |     signing challenge      |
    |                            |     with private key)      |
    |                            |                            |
    |<-- 3. Verify migration ----|----------------------------|
    |    request (check sig)     |                            |
    |                            |                            |
    |-- 4. Confirm + provide --->|---------------------------->
    |    migration bundle:       |                            |
    |    - submission history    |                            |
    |      (metadata only)       |                            |
    |    - active submissions    |                            |
    |      (full data)           |                            |
    |    - identity alias        |                            |
    |                            |                            |
    |-- 5. Update DID doc: ------|                            |
    |    add alsoKnownAs:        |                            |
    |    did:web:b.example:      |                            |
    |    users:alice             |                            |
    |                            |                            |
    |-- 6. Notify federated ---->| (broadcast to all trusted  |
    |    instances of migration  |  instances)                |
    |                            |                            |
```

This is significantly better than Mastodon's migration, which cannot transfer posts. Colophony transfers submission metadata and active submissions because the data model is well-defined and domain-specific.

**What transfers:**

- Submission metadata (titles, dates, statuses) -- for sim-sub history
- Active/pending submissions (full data including files) -- so they are not lost
- Identity alias chain (so other instances can verify the identity is the same person)

**What does NOT transfer:**

- Review comments and editorial notes (belong to the reviewing organization)
- Payment history (stays with the organization that processed payment)
- Org memberships and roles (per-org, not portable)

##### Layer 4: Domain Operations

Three primary operations, each described in detail below.

---

#### 5.7.5 Simultaneous Submission Enforcement (Novel Requirement)

This is the most novel and complex aspect of Colophony's federation. No existing platform enforces sim-sub rules across independent instances.

##### The Problem

Magazine A on Instance 1 has a policy: "No simultaneous submissions." Author submits a poem to Magazine A. Author then tries to submit the same poem to Magazine B on Instance 2. How does Instance 2 know?

##### Current Industry State

Today, sim-sub enforcement is entirely **honor-based**. Duotrope tracks submissions client-side and warns the author, but the magazine has no way to verify. Submittable only tracks within its own platform. There is no cross-platform enforcement anywhere in the literary magazine world.

##### Design Constraints

| Constraint            | Implication                                                                                           |
| --------------------- | ----------------------------------------------------------------------------------------------------- |
| **Privacy**           | Instances should not learn what a submitter has submitted elsewhere unless necessary                  |
| **Trust**             | Instances can lie about submission status (a malicious instance could claim everything is sim-subbed) |
| **Latency**           | Must be fast enough to check at submission time (< 2 seconds)                                         |
| **Availability**      | Must handle offline instances gracefully                                                              |
| **Data minimization** | Share the minimum data needed for enforcement                                                         |

##### Approach: Blind Submission Attestation Protocol (BSAP)

The key insight: **we do not need to share submission content across instances.** We only need to attest that a specific piece (identified by a content hash) is currently under active consideration somewhere, and that the destination has a no-sim-sub policy.

**How content hashing works:**

When a submitter creates a submission, the client generates a content fingerprint:

```
fingerprint = SHA-256(
  normalize(title) +
  normalize(content_text) +
  sorted(SHA-256(file_bytes) for each file)
)
```

The fingerprint is computed client-side and stored with the submission. It identifies the piece without revealing its content.

**Sim-sub check flow:**

```
Submitter                Instance 2              Instance 1
  (Author)               (Magazine B)            (Magazine A)
    |                         |                       |
    |-- 1. Submit piece ----->|                       |
    |   (includes content     |                       |
    |    fingerprint)         |                       |
    |                         |                       |
    |                   2. Magazine B checks:          |
    |                      Does Magazine B have        |
    |                      no-sim-sub policy?          |
    |                      If no: skip check.          |
    |                      If yes: continue.           |
    |                         |                       |
    |                   3. Look up author's            |
    |                      federated identity          |
    |                      (did:web:...)               |
    |                         |                       |
    |                         |-- 4. POST             |
    |                         |   /federation/        |
    |                         |   sim-sub/check       |
    |                         |   {                   |
    |                         |     submitter_did,    |
    |                         |     fingerprint,      |
    |                         |     requesting_pub    |
    |                         |   }                   |
    |                         |                       |
    |                         |   (signed by Inst 2)  |
    |                         |                       |
    |                         |<-- 5. Response -------|
    |                         |   {                   |
    |                         |     status:           |
    |                         |       "active",       |
    |                         |     no_sim_sub: true, |
    |                         |     publication:      |
    |                         |       "Magazine A",   |
    |                         |     submitted_at:     |
    |                         |       "2026-01-15"    |
    |                         |   }                   |
    |                         |                       |
    |<-- 6. Inform author ----|                       |
    |   "This piece is under  |                       |
    |    review at Magazine A  |                       |
    |    which prohibits       |                       |
    |    simultaneous subs.    |                       |
    |    Withdraw first or     |                       |
    |    wait for a decision." |                       |
    |                         |                       |
```

**Key design decisions:**

| Decision                                                   | Rationale                                                                                                      |
| ---------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------- |
| Check is per-fingerprint, not per-title                    | Titles can be changed; content fingerprints are stable                                                         |
| Only check instances the submitter has an identity on      | Reduces query scope; respects privacy                                                                          |
| The submitting instance does the check (not the submitter) | Server-to-server trust; submitters cannot bypass                                                               |
| Response includes publication name but NOT piece content   | Data minimization                                                                                              |
| Check is blocking but has a timeout (2 seconds)            | UX: do not let a slow/offline instance block submission                                                        |
| Offline instances default to "allow"                       | Availability over correctness -- the alternative (blocking all submissions when any instance is down) is worse |

**Failure modes and mitigations:**

| Failure Mode                                          | Behavior                               | Mitigation                                                    |
| ----------------------------------------------------- | -------------------------------------- | ------------------------------------------------------------- |
| Instance offline                                      | Allow submission, log warning          | Author sees "could not verify sim-sub status for [instance]"  |
| Instance lies (says no active sub when there is one)  | No technical mitigation                | Social/reputational (defederation from dishonest instances)   |
| Instance lies (says active sub when there is not one) | Author cannot submit                   | Author can dispute; admins can override; defederation         |
| Fingerprint collision                                 | False positive (unlikely with SHA-256) | Admin override                                                |
| Author modifies piece slightly to change fingerprint  | Bypass                                 | Accept this limitation; fuzzy matching is a privacy nightmare |
| Network timeout (> 2 seconds)                         | Allow submission, log warning          | Configurable timeout per instance                             |

**Privacy analysis:**

| Data Element                       | Crosses Instance Boundary? | Justification                                                    |
| ---------------------------------- | -------------------------- | ---------------------------------------------------------------- |
| Submitter DID                      | Yes                        | Required to identify whose submissions to check                  |
| Content fingerprint (SHA-256 hash) | Yes                        | Required for piece identification; reveals nothing about content |
| Submission content/text            | NO                         | Never crosses boundaries                                         |
| File contents                      | NO                         | Never crosses boundaries                                         |
| Publication name (of active sub)   | Yes (in response)          | Minimal: tells requesting instance where the conflict is         |
| Submission date                    | Yes (in response)          | Helps author understand the situation                            |
| Review status details              | NO                         | Only "active" (under consideration) or "none"                    |

**Consent model:**

Submitters opt into federation when they create their account. The sim-sub check is a feature of the platform, not an invasion of privacy -- it enforces rules the submitter agreed to when submitting to a no-sim-sub publication. However:

- Submitters can see which instances have queried their submission status (transparency)
- Submitters can revoke federation consent (their submissions become invisible to cross-instance checks, but they cannot submit to no-sim-sub publications on federated instances)
- The check only fires for publications with explicit no-sim-sub policies

---

#### 5.7.6 Cross-Journal Piece Transfer

##### Author-Initiated Transfer (Primary)

When a piece is rejected, the author can re-submit it to another publication on any federated instance with one click (no re-upload).

```
Author                    Instance 1              Instance 2
                          (Magazine A)            (Magazine B)
  |                            |                       |
  |  1. Piece rejected by      |                       |
  |     Magazine A             |                       |
  |                            |                       |
  |-- 2. Author clicks ------->|                       |
  |   "Transfer to             |                       |
  |    Magazine B"             |                       |
  |                            |                       |
  |                      3. Generate transfer          |
  |                         token (JWT, 72hr expiry,   |
  |                         signed by Instance 1)      |
  |                            |                       |
  |                            |-- 4. POST             |
  |                            |   /federation/        |
  |                            |   transfer/initiate   |
  |                            |   {                   |
  |                            |     token,            |
  |                            |     submitter_did,    |
  |                            |     piece_metadata    |
  |                            |   }                   |
  |                            |                       |
  |                            |<-- 5. 202 Accepted --|
  |                            |   {                   |
  |                            |     transfer_id,      |
  |                            |     status: "pending" |
  |                            |   }                   |
  |                            |                       |
  |<-- 6. "Transfer initiated" |                       |
  |                            |                       |
  |                            |-- 7. Fetch piece ---->|
  |                            |   data (files +       |
  |                            |   content) using      |
  |                            |   token as auth       |
  |                            |                       |
  |                            |-- 8. Create draft --->|
  |                            |   submission on       |
  |                            |   Instance 2          |
  |                            |                       |
  |<-- 9. "New draft ready ----|----------------------|
  |    at Magazine B.           |                       |
  |    Review and submit."     |                       |
  |                            |                       |
```

**What transfers:**

| Data                         | Transfers?      | Notes                                                             |
| ---------------------------- | --------------- | ----------------------------------------------------------------- |
| Manuscript files             | Yes             | The actual creative work                                          |
| Title, cover letter          | Yes             | Author can modify before re-submitting                            |
| Submission metadata          | Yes             | Date, category, author info                                       |
| Previous review comments     | NO              | Belong to the reviewing organization                              |
| Payment records              | NO              | Not relevant to the new submission                                |
| Submission history at origin | Author's choice | Author can choose to include "previously submitted to Magazine A" |

**Consent model:** Transfer is ALWAYS author-initiated. No instance can pull a submission without the author's explicit action.

##### Editor-Initiated Recommendation (Optional)

Editors can recommend a piece to another publication. This does NOT transfer the piece -- it sends a recommendation that the author can act on.

```
Editor                    Instance 1              Instance 2
(Magazine A)              (Magazine A)            (Magazine B)
  |                            |                       |
  |-- 1. "Recommend this ----->|                       |
  |   piece to Magazine B"     |                       |
  |                            |                       |
  |                            |-- 2. POST             |
  |                            |   /federation/        |
  |                            |   recommend           |
  |                            |   {                   |
  |                            |     piece_metadata    |
  |                            |     (title, genre,    |
  |                            |      NOT content),    |
  |                            |     recommender,      |
  |                            |     message           |
  |                            |   }                   |
  |                            |                       |
  |                            |   [Author notified]   |
  |                            |                       |
```

The author then decides whether to initiate a transfer. The editor never sees the outcome (privacy).

---

#### 5.7.7 Instance Discovery and Trust

##### How Instances Find Each Other

Three mechanisms, from most to least curated:

1. **Colophony Directory** (managed by the project): A public registry at `directory.colophony.dev` listing known Colophony instances. Opt-in. Crawls `.well-known/colophony` endpoints periodically.

2. **Managed hosting auto-discovery**: All managed-hosting instances are automatically listed and mutually trusted.

3. **Manual entry**: An admin enters another instance's URL, fetches its metadata, and initiates trust.

##### Trust Levels

| Level          | What It Allows                                            | How Established                                     |
| -------------- | --------------------------------------------------------- | --------------------------------------------------- |
| **None**       | Nothing                                                   | Default for unknown instances                       |
| **Discovery**  | Visible in directory, metadata accessible                 | Public `.well-known/colophony` endpoint             |
| **Identity**   | Cross-instance identity verification, submitter migration | Bilateral trust establishment (admin approval)      |
| **Operations** | Sim-sub checks, piece transfers, recommendations          | Bilateral trust + capability negotiation            |
| **Full**       | All operations + future capabilities                      | Managed hosting auto-trust, or explicit admin grant |

##### Capability Negotiation

During trust establishment, instances negotiate which operations they support:

```json
{
  "grantedCapabilities": {
    "identity.verify": true,
    "identity.migrate": true,
    "simsub.check": true,
    "simsub.respond": true,
    "transfer.initiate": true,
    "transfer.receive": true,
    "recommend.send": true,
    "recommend.receive": false
  },
  "protocolVersion": "1.0",
  "minProtocolVersion": "1.0"
}
```

This allows instances to opt in to specific federation features without all-or-nothing commitment. A magazine that wants sim-sub enforcement but not piece transfers can configure that.

##### Protocol Versioning

```
POST /federation/v1/sim-sub/check
POST /federation/v1/transfer/initiate
```

Version in the URL path. Instances advertise supported versions in `.well-known/colophony`. During trust establishment, instances agree on a common version. Breaking changes increment the major version; non-breaking additions are backwards compatible within a major version.

---

#### 5.7.8 Privacy and GDPR Compliance

##### Data Controller Responsibilities

In a federated system, each instance is an independent data controller. Under GDPR Article 26 (Joint Controllers), when two instances exchange personal data for federation purposes, they have shared responsibilities:

| Responsibility          | Who                                                            | How                                              |
| ----------------------- | -------------------------------------------------------------- | ------------------------------------------------ |
| Data collection consent | Home instance (where user registered)                          | Consent at signup includes federation notice     |
| Sim-sub check data      | Both instances (joint processing)                              | Only hashed fingerprints + DIDs cross boundaries |
| Right to access         | Home instance                                                  | Export includes federation activity log          |
| Right to erasure        | Home instance (primary), all federated instances (propagation) | Erasure propagation protocol (see below)         |
| Data processing records | Each instance independently                                    | Each logs its own federation activity            |

##### Erasure Propagation

When a user exercises their right to erasure on their home instance:

```
Home Instance                Federated Instance 1    Federated Instance 2
     |                              |                       |
     |-- 1. User requests -->       |                       |
     |   erasure                    |                       |
     |                              |                       |
     |-- 2. Process local -->       |                       |
     |   erasure (existing          |                       |
     |   GDPR flow)                 |                       |
     |                              |                       |
     |-- 3. POST /federation/ ----->|                       |
     |   erasure/propagate          |                       |
     |   { submitter_did,           |-- 3. Same request --->|
     |     erasure_scope:           |                       |
     |     "full" | "identity" }    |                       |
     |                              |                       |
     |<-- 4. 200 OK ---------------|                       |
     |   { erased: true }          |<-- 4. 200 OK ---------|
     |                              |                       |
     |-- 5. Log propagation -->     |                       |
     |   results in DSAR           |                       |
     |   request record            |                       |
     |                              |                       |
```

Erasure propagation is **best-effort** (per GDPR Article 19 -- "unless this proves impossible or involves disproportionate effort"). If a federated instance is offline, the home instance retries for 30 days (matching DSAR deadline), then logs the failure.

**What gets erased on federated instances:**

- Cached identity information (DID, display name)
- Sim-sub check logs referencing this submitter
- Transfer records
- Any locally cached submission metadata

**What is already not stored on federated instances:**

- Submission content (never crosses boundaries except during explicit transfer)
- Files (never crosses boundaries except during explicit transfer)
- After a transfer, the destination instance becomes the controller of that data

##### Data Minimization Summary

| Federation Operation  | Data That Crosses Boundaries             | What Is NOT Shared                               |
| --------------------- | ---------------------------------------- | ------------------------------------------------ |
| Identity verification | DID, public key, display name            | Email, password hash, IP, browsing history       |
| Sim-sub check         | DID, content fingerprint (hash)          | Submission content, files, cover letter, title   |
| Sim-sub response      | Publication name, date, "active/none"    | Review status details, editorial notes, scores   |
| Piece transfer        | Full submission (author-initiated)       | Review history, editorial notes, payment records |
| Recommendation        | Title, genre, recommender name           | Full content, files, review details              |
| Erasure propagation   | DID, erasure scope                       | Any personal data (that is the point)            |
| Migration             | Submission metadata + active submissions | Review history, payments, org memberships        |

---

#### 5.7.9 Managed Hosting Implications

| Scenario                    | Trust Model                | Complexity | Notes                                                                 |
| --------------------------- | -------------------------- | ---------- | --------------------------------------------------------------------- |
| Managed <-> Managed         | Auto-trust (same operator) | Trivial    | Hub signs both instances; can even share database for some operations |
| Managed <-> Self-hosted     | Allowlist (bilateral)      | Medium     | Standard federation protocol                                          |
| Self-hosted <-> Self-hosted | Allowlist (bilateral)      | Medium     | Standard federation protocol                                          |

**Hub advantages for managed hosting:**

1. **Centralized sim-sub index**: For managed-to-managed checks, the hub can maintain a centralized fingerprint index -- instant lookups, no instance-to-instance queries. This is an optimization, not a requirement.

2. **Trust bootstrapping**: New managed instances are immediately trusted by all other managed instances. Self-hosted instances joining the network only need to establish trust with the hub to access all managed instances.

3. **Protocol upgrades**: The hub can enforce minimum protocol versions across managed instances, making upgrades smoother.

4. **Monitoring**: The hub can monitor federation health across managed instances.

**Self-hosted instances are first-class citizens.** The hub is a convenience optimization for managed hosting, not a requirement for federation. Self-hosted instances can federate directly with each other without any hub involvement.

---

#### 5.7.10 Implementation Roadmap

| Phase                  | Scope                                                                                   | Timeline Estimate | Dependencies                   |
| ---------------------- | --------------------------------------------------------------------------------------- | ----------------- | ------------------------------ |
| **Phase 1: Discovery** | `.well-known/colophony` endpoint, instance metadata, WebFinger for submitter identities | 2-3 weeks         | Core API service               |
| **Phase 2: Identity**  | `did:web` documents, key generation, identity verification between instances            | 3-4 weeks         | Phase 1, Auth service          |
| **Phase 3: Trust**     | Allowlist-based trust establishment, capability negotiation, HTTP Message Signatures    | 3-4 weeks         | Phase 2                        |
| **Phase 4: Sim-sub**   | Content fingerprinting, sim-sub check protocol, author notification                     | 4-5 weeks         | Phase 3                        |
| **Phase 5: Transfer**  | Piece transfer initiation, file transfer, draft creation                                | 3-4 weeks         | Phase 3                        |
| **Phase 6: Hub**       | Managed hosting hub, centralized sim-sub index, auto-trust                              | 3-4 weeks         | Phase 4, Managed hosting infra |
| **Phase 7: Migration** | Identity migration, submission history transfer, DID alias chain                        | 4-5 weeks         | Phase 3, Phase 5               |

**Total: ~22-29 weeks** (roughly 5-7 months for full federation). Phases 1-4 are the minimum viable federation. Phases 5-7 can follow.

#### Senior Dev Review Additions

**Federation is v2.0, not v2.1** — per product decision, federation ships with v2.0. There are no time constraints, but federation should be deferred to late in v2 development to allow the core platform to stabilize first. Careful planning around federation interfaces is required from the start so late integration is clean.

**Implementation strategy for v2.0 inclusion:**

1. **Build core platform first** (form builder, API surfaces, auth, hosting) — these establish the service layer that federation operates on
2. **Define federation interfaces early** — even before implementing federation, define the service interfaces (`FederationService`, `IdentityService`, `SimSubService`) so other services can be built with federation in mind
3. **Implement federation late** — once the core platform is stable with real user testing, implement federation phases
4. **Prioritize within federation:** If timeline pressure emerges, ship v2.0 with Phases 1-3 (Discovery, Identity, Trust) and defer Phase 4 (sim-sub) to a fast follow-up. Identity federation and piece transfer are valuable without sim-sub enforcement.

**Feature flag architecture:**

Create `services/federation` that is **feature-flagged off by default** in self-hosted deployments:

- Managed hosting enables it immediately
- Self-hosted instances opt in when ready
- Allows gradual rollout of federation features
- Flag at the service level, not per-feature (simpler)

**High-risk elements requiring extra attention:**

1. **Sim-sub enforcement novelty:** No existing platform does this. Design from first principles means:
   - Extensive testing with edge cases (offline instances, malicious instances, fingerprint collisions)
   - Beta period with friendly magazines before production
   - Clear "this is experimental" disclaimer in initial release

2. **Trust model UI/UX:** Three trust levels (Open, Allowlist, Managed Hub) with capability negotiation adds significant admin UI surface area. Budget extra time for the federation admin panel — it needs to be very clear about implications of trust decisions.

3. **Privacy/GDPR compliance:**
   - Consult an actual GDPR lawyer before shipping erasure propagation (not just research)
   - Document joint controller responsibilities in Terms of Service
   - Provide sample DPA (Data Processing Agreement) templates for federated instances

4. **Fingerprint bypass:** Slightly modifying a piece changes the SHA-256 fingerprint. This is an accepted limitation for v2.0:
   - Document the limitation clearly to magazines
   - Consider "fuzzy threshold" config (e.g., "flag if >80% similar") as a post-v2.0 enhancement
   - Fuzzy matching requires storing n-grams or embeddings, which has its own privacy implications — research separately

---

#### 5.7.11 Technology Choices

| Component           | Recommendation                     | Rationale                                                    |
| ------------------- | ---------------------------------- | ------------------------------------------------------------ |
| **Discovery**       | WebFinger (RFC 7033)               | IETF standard, used by Mastodon/OIDC, mature libraries       |
| **Identity**        | `did:web` (W3C DID)                | Leverages existing web infrastructure, no blockchain, simple |
| **Signing**         | HTTP Message Signatures (RFC 9421) | Modern standard, successor to draft used by ActivityPub      |
| **Key algorithm**   | Ed25519                            | Fast, small keys, widely supported                           |
| **Transport**       | HTTPS + JSON                       | Standard, simple, debuggable                                 |
| **Fingerprinting**  | SHA-256                            | Standard, collision-resistant, fast                          |
| **Transfer tokens** | JWT (short-lived, 72h)             | Proven, stateless, signed by origin instance                 |
| **API format**      | REST with JSON                     | Simple, no JSON-LD, no special parsers needed                |

**Libraries (TypeScript):**

| Need            | Library                              | Notes                            |
| --------------- | ------------------------------------ | -------------------------------- |
| WebFinger       | `webfinger.js` or custom (trivial)   | Simple HTTP + JSON               |
| DID resolution  | `did-resolver` + `did-web-resolver`  | W3C DID Foundation packages      |
| HTTP Signatures | `http-message-signatures`            | RFC 9421 implementation          |
| Ed25519         | `@noble/ed25519` or Node.js `crypto` | Native support in Node 18+       |
| JWT             | `jose`                               | Already likely in the auth stack |

---

#### 5.7.12 Open Questions for Federation

1. **Fuzzy fingerprint matching**: Should we support near-duplicate detection (e.g., same poem with minor edits)? This would require sharing more information (n-grams, embeddings) which has privacy implications. **Recommendation: Do not implement in v1.** SHA-256 exact match is sufficient and privacy-preserving.

2. ~~**Federation governance**: Who decides what instances can join the Colophony directory? A nonprofit foundation? The company? A community vote?~~ **RESOLVED:** Admin-controlled via `HUB_REGISTRATION_TOKEN` for managed hosting; per-instance trust mode (`allowlist`, `open`, `managed_hub`) for self-hosted. Community governance deferred to post-launch.

3. **Sim-sub check for non-federated submissions**: If an author submits via email to a non-Colophony magazine, the system cannot know. **Recommendation: Accept this limitation. Colophony can only enforce within its federation. This is still a massive improvement over the honor system.**

4. **Rate limiting federation requests**: Malicious instances could DDoS via federation requests. **Recommendation: Rate limit per-instance (e.g., 100 federation requests/minute), with configurable limits per trusted instance.**

5. **Federation metrics and monitoring**: What telemetry should the federation service expose? **Recommendation: Prometheus metrics for federation request counts, latencies, errors, trust changes. Essential for operating a federation hub.**

6. **Partial content fingerprinting**: Should we fingerprint at the section/chapter level for collections? A poetry collection might have individual poems submitted elsewhere. **Recommendation: Research in Phase 4. Could fingerprint both the collection and individual components, checking both.**

---

#### 5.7.13 Sources

**Standards and Specifications:**

- [RFC 7033 -- WebFinger](https://tools.ietf.org/html/rfc7033)
- [W3C Decentralized Identifiers (DIDs)](https://www.w3.org/TR/did-core/)
- [did:web Method Specification](https://w3c-ccg.github.io/did-method-web/)
- [RFC 9421 -- HTTP Message Signatures](https://www.rfc-editor.org/rfc/rfc9421)
- [W3C ActivityPub](https://www.w3.org/TR/activitypub/)
- [OpenID Connect Federation 1.0](https://connect2id.com/learn/openid-federation)

**Fediverse Implementation Lessons:**

- [Mastodon Account Migration Docs](https://docs.joinmastodon.org/user/moving/)
- [Mastodon Moderation Actions](https://docs.joinmastodon.org/admin/moderation/)
- [Mastodon and the Challenges of Abuse in a Federated System](https://nolanlawson.com/2018/08/31/mastodon-and-the-challenges-of-abuse-in-a-federated-system/)
- [Navigating Defederation on Decentralized Social Media (Carnegie)](https://carnegieendowment.org/research/2025/03/fediverse-social-media-internet-defederation)
- [Content Moderation Challenges in Mastodon Growth](https://policyreview.info/articles/analysis/content-moderation-challenges)
- [Evidence-Based Analysis of Fediverse Decentralization Promises](https://arxiv.org/html/2408.15383v1)
- [ActivityPub HTTP Signatures](https://swicg.github.io/activitypub-http-signature/)
- [Fediverse Migrations: Account Portability Study (ACM)](https://dl.acm.org/doi/10.1145/3646547.3689027)

**Identity and Federation:**

- [Bluesky AT Protocol FAQ](https://atproto.com/guides/faq)
- [AT Protocol vs ActivityPub](https://fedimeister.onyxbits.de/blog/bluesky-at-protocol-vs-activity-pub/)
- [Fedify -- ActivityPub Framework](https://fedify.dev/)
- [WordPress Federation Recap 2025](https://activitypub.blog/2026/01/12/wordpress-federation-recap-of-2025/)

**GDPR in Federated Context:**

- [GDPR Article 26 -- Joint Controllers](https://gdprinfo.eu/gdpr-article-26-explained-joint-controllers-responsibilities-and-real-world-examples)
- [GDPR Article 17 -- Right to Erasure](https://gdpr-info.eu/art-17-gdpr/)
- [EDPB Guidelines on Controller and Processor Concepts](https://www.edpb.europa.eu/sites/default/files/consultation/edpb_guidelines_202007_controllerprocessor_en.pdf)

**Domain-Specific:**

- [Simultaneous Submissions Guide (Duotrope)](https://duotrope.com/guides/simultaneous-submissions.aspx)
- [Duosuma Submission Manager (Duotrope)](https://duotrope.com/duosuma/)
- [Social Media Protocols Comparison](https://www.paulstephenborile.com/2024/11/social-media-protocols-comparison/)

### 5.8 Plugin / Extension System

**Research date:** 2026-02-11
**Status:** Complete -- recommendation ready for review

Full research document: [docs/research/plugin-extension-system.md](./research/plugin-extension-system.md)

**Summary:** Studied 7 plugin/extension systems (WordPress, Strapi, Ghost, OJS, Grafana, VS Code, Backstage). Recommends a **five-tier extensibility model** combining patterns from all systems studied:

- **Tier 0: Webhooks** (Ghost-inspired) -- zero-code external HTTP notifications
- **Tier 1: Adapters** (Backstage extension points) -- typed interface implementations for email, payment, storage, auth, search
- **Tier 2: Workflow Hooks** (WordPress-inspired, fully typed) -- action hooks (fire-and-forget) and filter hooks (data transformation chain) for editorial pipeline
- **Tier 3: UI Extensions** (VS Code contribution points) -- declarative manifest-based admin panel extensions
- **Tier 4: Full Plugins** (Strapi + Backstage lifecycle) -- register/bootstrap/destroy lifecycle with full service access

Key design decisions: TypeScript-only (no Go/WASM), npm distribution, Zod config schemas rendered as admin panel forms, permission-scoped security (not sandboxed), two-phase lifecycle, OJS-inspired plugin categories.

Includes complete TypeScript interfaces for EmailAdapter, PaymentAdapter, StorageAdapter, SearchAdapter, HookEngine, UIExtensionHost, PluginManifest, and ColophonyPlugin base class. Implementation roadmap spans v2 launch through v2.4+.

---

### 5.9 Decision Interaction Matrix

> **Added:** Post-review — identifies interaction effects between research areas that were evaluated in isolation.

Each research area (5.1-5.8) was evaluated independently. Some decisions interact in ways that require additional attention:

```
           5.1       5.2       5.3       5.4       5.5       5.6       5.7       5.8
           Fastify   Drizzle   Zitadel   Coolify   APIs      Forms     Fed       Plugins
5.1 Fast    -         ✅        ✅        ✅        ⚠️ [1]    ✅        ✅        ✅
5.2 Driz   ✅         -        ⚠️ [3]    ✅        ⚠️ [2]    ✅        ✅        ✅
5.3 Zita   ✅        ⚠️ [3]     -        ✅        ✅        ✅       ⚠️ [4]     ✅
5.4 Cool   ✅        ✅         ✅        -         ✅        ✅        ✅        ✅
5.5 APIs   ⚠️ [1]    ⚠️ [2]     ✅        ✅        -         ✅        ✅        ✅
5.6 Form   ✅        ✅         ✅        ✅        ✅        -         ✅        ✅
5.7 Fed    ✅        ✅        ⚠️ [4]     ✅        ✅        ✅        -         ✅
5.8 Plug   ✅        ✅         ✅        ✅        ✅        ✅        ✅        -

✅ = No conflict     ⚠️ = Interaction effect (all 4 now resolved/documented)
```

#### [1] Fastify + API Layer (5.1 + 5.5) — RESOLVED

**Problem:** API layer research assumed NestJS adapters (`@ts-rest/nest`, `@graphql-yoga/nestjs`).
**Resolution:** `@ts-rest/fastify` exists and is maintained. GraphQL Yoga integrates with Fastify directly via `handleNodeRequest`. Dependencies updated in 5.5 above.

#### [2] Drizzle + Pothos (5.2 + 5.5) — RESOLVED, manual work required

**Problem:** Pothos recommendation scored 39/50 based on `@pothos/plugin-prisma`. No Drizzle plugin exists. Revised score: ~29/50.
**Resolution:** Keep Pothos for Zod single-source-of-truth validation across all API surfaces. Accept manual type definitions, dataloader setup, and cursor pagination. See "Pothos + Drizzle Integration" section in 5.5 above for code patterns.
**Impact:** +2-3 weeks initial setup, +30min per model ongoing.

#### [3] Drizzle + Zitadel (5.2 + 5.3) — DOCUMENTED

**Problem:** Zitadel manages user identity. Drizzle has a `users` table. How do they stay in sync?
**Solution:** Webhook-based sync via Zitadel Actions (v2 API).

**Drizzle schema for users table:**

```typescript
// packages/db/src/schema/users.ts
import {
  pgTable,
  uuid,
  text,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { pgPolicy } from "drizzle-orm/pg-core";

export const users = pgTable(
  "users",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    zitadelUserId: text("zitadel_user_id").notNull(),
    email: text("email").notNull(),
    displayName: text("display_name"),
    avatarUrl: text("avatar_url"),
    emailVerified: timestamp("email_verified", { withTimezone: true }),
    deactivatedAt: timestamp("deactivated_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    uniqueIndex("users_zitadel_user_id_idx").on(table.zitadelUserId),
    uniqueIndex("users_email_idx").on(table.email),
  ],
);
```

**Zitadel webhook configuration:**

Zitadel uses "Actions" (v2) to fire webhooks on lifecycle events. Configure in Zitadel Console → Actions → Targets:

| Zitadel Event         | Webhook Endpoint         | Handler Action                       |
| --------------------- | ------------------------ | ------------------------------------ |
| `user.created`        | `POST /webhooks/zitadel` | Create local user record             |
| `user.changed`        | `POST /webhooks/zitadel` | Update email, display name           |
| `user.deactivated`    | `POST /webhooks/zitadel` | Set `deactivatedAt`, revoke sessions |
| `user.reactivated`    | `POST /webhooks/zitadel` | Clear `deactivatedAt`                |
| `user.removed`        | `POST /webhooks/zitadel` | Soft-delete or anonymize (GDPR)      |
| `user.email.verified` | `POST /webhooks/zitadel` | Set `emailVerified` timestamp        |

**Webhook handler (Fastify route):**

```typescript
// apps/api/src/webhooks/zitadel.webhook.ts
import type { FastifyInstance } from "fastify";
import { eq } from "drizzle-orm";
import { users } from "@colophony/db";

// Zitadel signs webhooks with a shared secret (configured in Actions target)
const ZITADEL_WEBHOOK_SECRET = process.env.ZITADEL_WEBHOOK_SECRET;

export function registerZitadelWebhooks(app: FastifyInstance) {
  app.post("/webhooks/zitadel", async (request, reply) => {
    // 1. Verify signature
    const signature = request.headers["x-zitadel-signature"] as string;
    if (
      !verifyZitadelSignature(request.body, signature, ZITADEL_WEBHOOK_SECRET)
    ) {
      return reply.status(401).send({ error: "Invalid signature" });
    }

    const event = request.body as ZitadelEvent;

    // 2. Idempotency: use Zitadel event ID to prevent duplicate processing
    const alreadyProcessed = await db.query.zitadelWebhookEvents.findFirst({
      where: eq(zitadelWebhookEvents.eventId, event.eventId),
    });
    if (alreadyProcessed) {
      return reply.status(200).send({ status: "already_processed" });
    }

    // 3. Process event in transaction
    await db.transaction(async (tx) => {
      switch (event.type) {
        case "user.created":
          await tx.insert(users).values({
            zitadelUserId: event.userId,
            email: event.data.email,
            displayName: event.data.displayName,
          });
          break;

        case "user.changed":
          await tx
            .update(users)
            .set({
              email: event.data.email,
              displayName: event.data.displayName,
              updatedAt: new Date(),
            })
            .where(eq(users.zitadelUserId, event.userId));
          break;

        case "user.deactivated":
          await tx
            .update(users)
            .set({ deactivatedAt: new Date(), updatedAt: new Date() })
            .where(eq(users.zitadelUserId, event.userId));
          break;

        case "user.reactivated":
          await tx
            .update(users)
            .set({ deactivatedAt: null, updatedAt: new Date() })
            .where(eq(users.zitadelUserId, event.userId));
          break;

        case "user.removed":
          // GDPR: anonymize rather than hard-delete
          await tx
            .update(users)
            .set({
              email: `deleted-${event.userId}@anonymized.local`,
              displayName: "Deleted User",
              deactivatedAt: new Date(),
              updatedAt: new Date(),
            })
            .where(eq(users.zitadelUserId, event.userId));
          break;

        case "user.email.verified":
          await tx
            .update(users)
            .set({ emailVerified: new Date(), updatedAt: new Date() })
            .where(eq(users.zitadelUserId, event.userId));
          break;
      }

      // 4. Record event as processed (idempotency)
      await tx.insert(zitadelWebhookEvents).values({
        eventId: event.eventId,
        eventType: event.type,
        processedAt: new Date(),
      });
    });

    return reply.status(200).send({ status: "processed" });
  });
}
```

**Error handling and resilience:**

- **Retries:** Zitadel retries failed webhook deliveries (configurable in Actions). Return 5xx to trigger retry, 2xx to acknowledge.
- **Ordering:** Events may arrive out of order. The `updatedAt` field prevents stale updates from overwriting newer data — check `event.timestamp > existingUser.updatedAt` before applying.
- **Initial sync:** On first deployment, use Zitadel's Management API to bulk-import existing users: `GET /management/v1/users/_search`.
- **Monitoring:** Track `zitadelWebhookEvents` table for processing lag. Alert if events are >5min old and unprocessed.

#### [4] Zitadel + Federation (5.3 + 5.7) — DOCUMENTED

**Problem:** How does `did:web` identity resolution interact with Zitadel's OIDC Provider role?
**Solution:** Two-layer identity architecture with clear boundaries.

**Layer architecture:**

```
┌─────────────────────────────────────────────────────────────┐
│                    External Requests                         │
│                                                             │
│  Cross-instance queries    │    Local user login            │
│  (federation protocol)     │    (browser/app)               │
└──────────┬─────────────────┴──────────┬─────────────────────┘
           │                            │
           ▼                            ▼
┌─────────────────────┐    ┌─────────────────────────┐
│  Federation Service  │    │   Zitadel (OIDC/OAuth2) │
│                      │    │                         │
│  - WebFinger         │    │  - Login/signup flows   │
│  - did:web documents │    │  - Session management   │
│  - HTTP Signatures   │    │  - Token issuance       │
│  - BSAP protocol     │    │  - MFA                  │
│  - Trust registry    │    │  - User lifecycle       │
│                      │    │                         │
│  Reads Zitadel ──────┼───>│  Management API         │
│  (verify identity)   │    │  (read-only access)     │
└──────────┬───────────┘    └───────────┬─────────────┘
           │                            │
           └────────────┬───────────────┘
                        ▼
              ┌──────────────────┐
              │  Colophony DB    │
              │  (Drizzle)       │
              │                  │
              │  users table     │
              │  (canonical)     │
              └──────────────────┘
```

**Key principle:** Zitadel is the **authentication authority** (who is this person?). The Federation service is the **identity publisher** (how does the world refer to this person?). They share a data source (the users table) but have different responsibilities.

**1. WebFinger endpoint (discovery):**

```typescript
// apps/api/src/federation/webfinger.route.ts
app.get("/.well-known/webfinger", async (request, reply) => {
  const resource = request.query.resource as string; // acct:alice@magazine.example
  const [, acct] = resource.match(/^acct:(.+)$/) || [];
  if (!acct) return reply.status(400).send({ error: "Invalid resource" });

  const [localPart, domain] = acct.split("@");

  // Verify this is our domain
  if (domain !== process.env.FEDERATION_DOMAIN) {
    return reply.status(404).send({ error: "Unknown domain" });
  }

  // Look up user in local DB (NOT Zitadel — the DB is the canonical source)
  const user = await db.query.users.findFirst({
    where: and(eq(users.email, acct), isNull(users.deactivatedAt)),
  });
  if (!user) return reply.status(404).send({ error: "User not found" });

  return reply.send({
    subject: resource,
    links: [
      {
        rel: "self",
        type: "application/activity+json",
        href: `https://${domain}/federation/users/${user.id}`,
      },
      {
        rel: "https://colophony.dev/ns/did",
        type: "application/did+json",
        href: `https://${domain}/.well-known/did.json?user=${user.id}`,
      },
    ],
  });
});
```

**2. did:web document generation:**

```typescript
// apps/api/src/federation/did.route.ts
app.get("/.well-known/did.json", async (request, reply) => {
  const userId = request.query.user as string;
  const user = await db.query.users.findFirst({
    where: eq(users.id, userId),
  });
  if (!user || user.deactivatedAt) {
    return reply.status(404).send({ error: "Identity not found" });
  }

  const domain = process.env.FEDERATION_DOMAIN;

  // did:web document — the federation-facing identity
  return reply.send({
    "@context": ["https://www.w3.org/ns/did/v1"],
    id: `did:web:${domain}:users:${user.id}`,
    controller: `did:web:${domain}`,
    verificationMethod: [
      {
        id: `did:web:${domain}:users:${user.id}#key-1`,
        type: "JsonWebKey2020",
        controller: `did:web:${domain}:users:${user.id}`,
        // Public key for HTTP Message Signatures verification
        publicKeyJwk: await getFederationPublicKey(user.id),
      },
    ],
    service: [
      {
        id: `did:web:${domain}:users:${user.id}#colophony`,
        type: "ColophonySubmitter",
        serviceEndpoint: `https://${domain}/federation/users/${user.id}`,
      },
    ],
  });
});
```

**3. Cross-instance identity verification:**

When Instance B receives a submission from a user on Instance A, it needs to verify the identity:

```
Instance A (sender)                     Instance B (receiver)
──────────────────                     ──────────────────────
1. User submits via API
2. Sign request with                    3. Receive signed request
   HTTP Message Signatures              4. Extract did:web from signature
                                        5. Resolve did:web → fetch DID document
                                           GET https://instance-a.example/
                                                .well-known/did.json?user=xxx
                                        6. Extract public key from DID document
                                        7. Verify HTTP Message Signature
                                        8. If valid → trust the identity
```

**4. Boundary between Zitadel and Federation:**

| Concern                     | Zitadel           | Federation Service                       |
| --------------------------- | ----------------- | ---------------------------------------- |
| **User login**              | Handles (OIDC)    | Does not participate                     |
| **Token issuance**          | Issues JWTs       | Does not issue tokens                    |
| **Session management**      | Manages           | Does not manage                          |
| **User creation**           | Source of truth   | Receives via webhook (interaction [3])   |
| **Identity publication**    | Not involved      | Generates did:web documents              |
| **Cross-instance trust**    | Not involved      | HTTP Message Signatures + trust registry |
| **User lookup (internal)**  | Token → user ID   | Not involved                             |
| **User lookup (federated)** | Not involved      | WebFinger → did:web → verify             |
| **Account migration**       | Exports user data | Transfers did:web, notifies instances    |

**5. When Federation needs Zitadel:**

The Federation service queries Zitadel's Management API in exactly two cases:

1. **User metadata enrichment** — When generating a did:web document, the Federation service may need profile fields (display name, avatar) that are managed in Zitadel but synced to the local DB via webhooks. The local DB is the primary read source; Zitadel Management API is the fallback if data is stale.

2. **Account migration verification** — When a user migrates their identity from Instance A to Instance B, Instance B's Federation service calls Instance A's Zitadel to verify the user initiated the migration (via a signed migration token).

**6. Federation feature flag:**

Federation is built into v2.0 but feature-flagged off by default:

```typescript
// Federation routes are only registered when enabled
if (config.federation.enabled) {
  registerWebFinger(app);
  registerDidRoutes(app);
  registerFederationApi(app);
  registerBsapEndpoints(app);
}
```

This means Zitadel works standalone for single-instance deployments. The Federation service is an additive layer that doesn't modify Zitadel's behavior.

---

## 6. Implementation Strategy

> **Added:** 2026-02-11, post senior dev review
> **Key insight:** The MVP was never publicly released. There are no existing users, no backwards compatibility constraints, and no time pressure. This enables building a complete, polished platform for a single v2.0 release rather than shipping incremental public versions.

### 6.1 Development Philosophy

**Not a "minimum viable product" — a complete platform that competes with Submittable on day one.**

| Assumption           | Old (Wrong)               | Revised (Correct)                                 |
| -------------------- | ------------------------- | ------------------------------------------------- |
| **Timeline**         | 6-9 months to v2.0 MVP    | 18-24 months to single complete release           |
| **Federation**       | Defer to v2.1 (too risky) | Build alongside core features (Months 10-15)      |
| **GraphQL**          | Defer to v2.1             | Build alongside REST (Months 5-9)                 |
| **Form builder**     | Ship basic, iterate later | Build complete (all 15 types + conditional logic) |
| **Plugin system**    | Ship webhooks only        | Build Tier 0-4 before launch                      |
| **Beta testing**     | None (ship to real users) | 4 private cohorts over 18 months                  |
| **Release strategy** | v2.0 → v2.1 → v2.2        | Single v2.0 with complete feature set             |

**Why this is architecturally superior:**

- Identity model baked in from day one (`did:web`, federated accounts)
- Submission data model includes federation fields (content fingerprint, cross-instance references) from the start
- No painful migration from "single-instance" to "federated" mode
- Beta testing with 5-10 magazines covers the full stack including federation

### 6.2 Development Tracks (Parallel)

Six tracks with explicit dependency chains. Tracks 3, 4, 5, and 6 can run in parallel once the API layer is stable.

```
Track 1: Core Infrastructure (Months 1-4)
├─ Framework migration (NestJS → Fastify)
├─ ORM migration (Prisma → Drizzle)
├─ Auth integration (Zitadel)
├─ Managed hosting setup (Coolify + Hetzner)
├─ Monitoring/observability (Prometheus + Grafana + Loki)
└─ CI/CD pipeline

Track 2: Colophony API (Months 3-8)
├─ Service layer extraction from tRPC routers
├─ REST + GraphQL + tRPC (parallel, shared service layer)
├─ Pothos + Drizzle manual integration patterns
├─ SDK generation (TypeScript, Python)
└─ API documentation

Track 3: Hopper — Submission Management (Months 5-12)
├─ Form builder (complete, all 15 field types)
├─ Conditional logic engine
├─ File upload + virus scanning (tus pipeline)
├─ Embeddable forms (iframe)
├─ Submission review pipeline
└─ GDPR tools (mostly done in MVP)

Track 4: Slate — Publication Pipeline (Months 8-15)
├─ Post-acceptance workflow
├─ Copyedit/proofread stages
├─ Contract generation + e-signature (Documenso via adapter)
├─ Workflow orchestration evaluation (Inngest vs Temporal)
├─ Issue assembly
├─ CMS integration (WordPress, Ghost)
└─ Editorial calendar

Track 5: Register — Identity & Federation (Months 10-18)
├─ Discovery (WebFinger, .well-known)
├─ Identity (did:web documents)
├─ Trust establishment
├─ Sim-sub enforcement (BSAP)
├─ Piece transfer
├─ Identity migration
└─ Hub for managed hosting

Track 6: Colophony Plugins (Months 14-20)
├─ Webhooks (Tier 0)
├─ Adapters (Tier 1)
├─ Workflow hooks (Tier 2)
├─ UI extensions (Tier 3)
├─ Full plugins (Tier 4)
└─ Plugin marketplace/registry

Cross-cutting: Relay — Notifications & Communications
├─ Email templates + provider integration (SendGrid)
├─ Webhook delivery system
├─ In-app notification center
└─ Integrated across Hopper (submission updates), Slate (contract notices), Register (federation events)
```

**Dependency graph:**

```
Track 1 (Infrastructure)     → Blocks everything
Track 2 (Colophony API)      → Depends on Track 1
Track 3 (Hopper)             → Depends on Track 1 + 2
Track 4 (Slate)              → Depends on Track 1 + 2, NOT on Track 3
Track 5 (Register)           → Depends on Track 1 + 2, NOT on Track 3 or 4
Track 6 (Colophony Plugins)  → Depends on Track 2, NOT on Track 3/4/5
Relay (cross-cutting)        → Starts in Track 1, evolves with each track
```

Tracks 3, 4, 5, and 6 can all proceed in parallel once the API layer (Track 2) is stable (~Month 8). Relay is a cross-cutting service — its core (email + webhook delivery) is built in Track 1, then each subsequent track adds notification types.

### 6.3 Timeline (18-24 Months)

**Phase 1: Foundation (Months 1-4)**

Goal: Infrastructure is solid, all architectural decisions locked in.

- Fastify + Drizzle + Zitadel migration complete
- Monorepo structure finalized (`@colophony/*` packages)
- Coolify deployment working on Hetzner test servers
- Prometheus + Grafana + Loki monitoring
- CI/CD pipeline (tests, linting, builds, deploy to Coolify)
- Deliverable: Dev environment where you can create orgs, publications, users (basic CRUD)

**Phase 2: Core Features (Months 3-9)**

Goal: Submission management is fully functional.

- Form builder (all 15 field types, conditional logic, embeds)
- Submission intake + review pipeline
- File uploads + virus scanning (tus pipeline)
- tRPC + REST + GraphQL API surfaces (all three, shared service layer)
- Pothos + Drizzle integration patterns established (or switch to TypeGraphQL if too painful — decision point at Month 3)
- SDK generation for TypeScript + Python
- Deliverable: A magazine can create a submission form, collect submissions, and review them. Single-instance deployment.
- **Beta Cohort 1 (Month 6-9):** 2-3 friendly magazines test core submission flow

**Phase 3: Publication + Federation (Months 8-15)**

Goal: Post-acceptance workflow + cross-instance federation.

- Publication pipeline (copyedit, contracts, issue assembly, CMS integration)
- Federation (discovery, identity, trust, sim-sub, transfers)
- Identity migration between instances
- Deliverable: A magazine can take an accepted submission through to publication. Multiple instances can federate.
- **Beta Cohort 2 (Month 12-15):** 5-8 magazines test publication pipeline
- **Beta Cohort 3 (Month 16-19):** Include at least 2 federated pairs testing trust, sim-sub, transfers

**Phase 4: Extensions + Polish (Months 14-20)**

Goal: Plugin ecosystem + production hardening.

- Plugin system (Tier 0-4)
- First-party adapters (SendGrid, Postmark, PayPal, S3)
- Visual regression testing (Playwright)
- Load testing (simulate 100 concurrent submitters)
- Security audit (penetration testing)
- GDPR legal review (actual lawyer, not just research)
- Documentation (user guides, API docs, plugin development guides)
- **Beta Cohort 4 (Month 20-22):** 10-15 magazines test full platform

**Phase 5: Public Launch (Months 20-24)**

Goal: Prepare for public availability.

- Marketing site (colophony.press)
- Managed hosting infrastructure at scale (10-20 test tenants)
- Community setup (Discord/forum or GitHub Discussions)
- Pricing finalized for managed hosting
- Terms of Service + Privacy Policy
- Federation directory (directory.colophony.dev)
- Public announcement, open for self-hosted installs and managed hosting signups

### 6.4 Beta Testing Strategy

No public releases during development. Private beta testing throughout:

| Cohort | Timing      | Who                                          | What They Test                                       | What's NOT Ready                                |
| ------ | ----------- | -------------------------------------------- | ---------------------------------------------------- | ----------------------------------------------- |
| **1**  | Month 6-9   | 2-3 friendly magazines                       | Submission forms, intake, review pipeline            | Federation, publication pipeline, plugins       |
| **2**  | Month 12-15 | Original + 2-3 new                           | Publication pipeline, copyedit, contracts, CMS       | Federation, advanced plugins                    |
| **3**  | Month 16-19 | Original + 2-3 new (incl. 2 federated pairs) | Federation trust, sim-sub, piece transfers           | Full plugin ecosystem, managed hosting at scale |
| **4**  | Month 20-22 | 10-15 magazines                              | Full platform, plugins, managed hosting, self-hosted | Final polish items                              |

### 6.5 Revised Risk Assessment

**Risks that are now LOWER** (due to no time pressure):

- Federation complexity — time to build right, test with beta cohort 3, iterate
- Pothos + Drizzle gap — can build patterns upfront, or switch to TypeGraphQL if needed (pre-release, low switching cost)
- Form builder scope — all 15 field types + conditional logic without rushing
- Plugin system maturity — Tier 0-4 before launch

**Risks that are still HIGH:**

- Coolify single-maintainer — mitigated by monitoring + AGPL fork viability
- Sim-sub enforcement novelty — mitigated by beta cohort 3
- Federation GDPR compliance — requires legal review in Phase 4

**NEW risks from long development cycle:**

| Risk                                                             | Mitigation                                                               |
| ---------------------------------------------------------------- | ------------------------------------------------------------------------ |
| **Scope creep** ("one more feature" syndrome)                    | Lock feature scope after Phase 2. Phase 3-4 is polish, not new features. |
| **Technology churn** (dependencies break over 2 years)           | Pin LTS versions. Node 22 LTS, Fastify 5.x stable, Drizzle stable.       |
| **Motivation/burnout** (long projects without public validation) | Beta testing provides validation. Monthly milestone demos.               |

### 6.6 Pothos + Drizzle Decision Point

With no time pressure, the Pothos + Drizzle integration can be evaluated empirically rather than theoretically:

- **Month 3:** Start building GraphQL surface with Pothos + Drizzle manual patterns
- **After 2-3 weeks:** Evaluate if the manual work (type definitions, dataloader, pagination) is acceptable
- **If acceptable:** Continue with Pothos (Zod single-source-of-truth advantage)
- **If too painful:** Switch to TypeGraphQL (low cost since no users, no public API, pre-release)

This is only possible because there are no existing users to migrate.

---

## 7. Open Questions

Questions that emerged during the interview that need further discussion:

1. ~~**Submitter role architecture:** How does the Submitter role work when someone is a submitter at one publication and an editor at another? Is this per-org role assignment, or a global identity with per-org role bindings?~~ **RESOLVED:** Submitter is **not an org role** — it is a global user capability. `organization_members` stays `ADMIN | EDITOR | READER` (staff only). A user's submitter identity is expressed through their **manuscript library** (user-owned, cross-org) and **submissions** (the junction between a manuscript and an org's submission period). No org membership is required to submit. Org-to-writer broadcast (calls for submissions, announcements) is handled through a **follow/subscribe** model (Relay), not membership. Post-acceptance contributor relationships are a Slate (Track 4) concern. A person can simultaneously be a submitter (global) and an editor/admin at different orgs — these are independent relationships.

2. ~~**Self-serve org creation:** For managed hosting, can anyone create an org, or is it provisioned? For self-hosted, the deployer is presumably the admin.~~ **PARTIALLY RESOLVED:** Org creation is **self-serve** in both contexts — no approval gates. **Self-hosted:** deployer creates the first org, becomes ADMIN; additional orgs at deployer's discretion (most deployments are single-org). **Managed hosting:** self-serve with a **free tier** (hard quota limits on submissions, storage, etc.) and paid upgrade to remove limits. All features available on all tiers (no feature gating). Managed hosting infrastructure (Coolify provisioning, Stripe subscription billing, quota enforcement, free-tier limits) **deferred** — not in scope until post-Track 3. Implementation details to be decided when managed hosting work begins.

3. ~~**Data model for federation:** What data crosses instance boundaries? Just identity? Submission metadata? Full submissions? How is this governed?~~ **RESOLVED:** Identity (DID-based user keys), content fingerprints (SHA-256 for sim-sub), submission metadata (title, cover letter), and files (via signed JWT transfer tokens) cross boundaries. Governed per-instance: admin-controlled trust (allowlist/open/managed_hub modes), per-peer capability grants, hub attestation for managed hosting. See Track 5 PRs #180-#184.

4. **CMS "starter home" scope:** How basic is the built-in publishing layer? Static pages? Blog-like? Magazine-format with issue structure?

5. **Subscription/membership research:** Need to evaluate Ghost memberships, Memberful, Steady, and open-source alternatives for the magazine subscription feature.

6. **Billing for managed hosting:** How does the flat-rate + volume add-on pricing actually work? What's the volume threshold? How are overages calculated?

7. **Migration path from MVP:** For any existing MVP deployments (if any), how do they migrate to v2? _(Note: MVP was never publicly released, so this is lower priority — internal migration only.)_

8. ~~**Brand and naming:** Is "Colophony" the final name? Does the reconceive warrant a rebrand?~~ **RESOLVED:** Suite is **Colophony**. Components: **Hopper** (submissions), **Slate** (publication), **Relay** (notifications), **Register** (federation). API layer and plugin system use the Colophony name directly.

---

## Appendix: Decision Trail

All product decisions are documented in `docs/competitive-analysis.md` Section 9. Key architectural decisions made during the planning conversation:

| Date       | Decision                                                                                                                 | Rationale                                                                                                                                                                                                                                                                              |
| ---------- | ------------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 2026-02-10 | Full reconceive (not incremental evolution)                                                                              | Vision is fundamentally different from MVP scope                                                                                                                                                                                                                                       |
| 2026-02-10 | Decomposed service architecture                                                                                          | 6+ services with distinct scaling/lifecycle needs                                                                                                                                                                                                                                      |
| 2026-02-10 | Monorepo for core + separate repos for ecosystem                                                                         | Atomic commits for core; independent lifecycle for integrations                                                                                                                                                                                                                        |
| 2026-02-10 | Docker Compose for self-hosted, TBD orchestrator for managed                                                             | Small magazines shouldn't need K8s; managed hosting needs more                                                                                                                                                                                                                         |
| 2026-02-10 | Research before committing to framework, ORM, auth, orchestration                                                        | Too consequential to decide without evaluation                                                                                                                                                                                                                                         |
| 2026-02-11 | Suite naming: Colophony (suite), Hopper (submissions), Slate (publication), Relay (notifications), Register (federation) | Clear identity per component; literary metaphors; API + plugins use Colophony name                                                                                                                                                                                                     |
| 2026-02-11 | Single complete release, not phased public rollout                                                                       | No existing users, no time pressure; build it right over 18-24 months                                                                                                                                                                                                                  |
| 2026-02-11 | Federation in v2.0 (built alongside core, not deferred)                                                                  | No time constraints; architecturally superior to bolt-on later                                                                                                                                                                                                                         |
| 2026-02-11 | 6 parallel development tracks with 4 beta cohorts                                                                        | Maximize parallelism; validate with real magazines throughout                                                                                                                                                                                                                          |
| 2026-02-15 | Documenso as default e-sign integration for Slate contracts (via Tier 1 adapter)                                         | TypeScript, self-hostable, active releases, embedding support. Adapter pattern allows swap to OpenSign/LibreSign later                                                                                                                                                                 |
| 2026-02-15 | Evaluate Inngest (preferred) vs Temporal for Slate workflow orchestration at Track 4 design time                         | BullMQ stays for simple async jobs; durable multi-step workflows (contract signing, copyedit chains) need a workflow engine. Inngest: TS-native, self-hostable, lower ops overhead. Temporal: max durability, higher complexity. No action until Track 4 design starts (~month 5-6)    |
| 2026-02-15 | npm trusted publishing + Sigstore Cosign + OPA for plugin distribution/governance                                        | De-scopes custom marketplace and signing infrastructure. See plugin-extension-system.md Section 6-7                                                                                                                                                                                    |
| 2026-02-15 | Keep custom form builder for submissions; consider JSON Forms/RJSF for generic admin forms only                          | Submission forms are product-differentiating (tus/ClamAV integration, submission periods, blind submission toggles). Generic admin/settings forms could use JSON Forms to reduce maintenance if we build many of them                                                                  |
| 2026-02-15 | Federation uses openid-client + jose + did:web (specific library choices for Track 5)                                    | Standard libraries for OIDC/JWT/JWK crypto; custom logic only for domain-specific operations (sim-sub, piece transfer, blind submission attestation)                                                                                                                                   |
| 2026-02-15 | External automation (n8n/Activepieces) as Tier 0 webhook consumer, not embedded                                          | Evaluate as recommended external target in plugin Phase 3-4 (v2.2+). Security concern: n8n has had multiple CVEs; must be network-isolated with strict allow-listing if integrated                                                                                                     |
| 2026-02-19 | Submitter is a global user capability, not an org role                                                                   | Submitters need cross-org agency (manuscript library, sim-sub). Org membership (`ADMIN/EDITOR/READER`) is staff-only. Submission is the junction between user-owned manuscripts and org submission periods. Follow/subscribe model (Relay) for org-to-writer broadcast, not membership |
| 2026-02-19 | Self-serve org creation with free tier for managed hosting                                                               | Self-serve in both contexts (no approval gates). Managed hosting: free tier with hard quotas, paid upgrade removes limits, all features on all tiers. Self-hosted: no billing. Managed hosting infra deferred to post-Track 3                                                          |
