# Colophony — Architecture Planning

> **Status:** All architectural decisions finalized and implemented. This document updated to reflect the built system.
> **Created:** 2026-02-10
> **Updated:** 2026-03-02
> **Context:** Product vision defined in `docs/competitive-analysis.md` (Section 9). The MVP prototype ("Prospector") proved the concept; Colophony is a full reconceive as open-source infrastructure for literary magazines.
>
> **Note:** Sections 4 and 5 originally contained detailed research evaluations for each architectural decision. These have been collapsed to decision summaries now that all decisions are finalized and implemented. Full evaluation text is preserved in git history (see commits before 2026-03-02).
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
| tRPC router structure        | Keeping for internal use, adding REST                         |
| Prisma schema                | ORM under evaluation; data model changing significantly       |
| Current auth implementation  | Replacing with external auth service                          |
| Frontend component structure | Will be redesigned for new features                           |
| Docker Compose configs       | Self-hosted keeps Compose; managed hosting needs orchestrator |

---

## 3. Service Architecture

### Actual Architecture (as built)

The original plan proposed 6 separate services. In practice, all backend logic runs in a single Fastify API (`apps/api/`) with internal module boundaries. Workers run in-process via BullMQ.

| Service          | Responsibility                                                                                                                                                 | Communication                              |
| ---------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------ |
| **Core API**     | All backend logic: submissions, editorial workflow, organizations, publications, forms, payments, GDPR, audit, federation, notifications, publication pipeline | REST (public), tRPC (internal to web)      |
| **Web Frontend** | Editor UI, submitter UI, admin UI                                                                                                                              | Consumes Core API via tRPC                 |
| **Workers**      | Background jobs: virus scan, email, webhook delivery, S3 cleanup, outbox polling                                                                               | BullMQ queues via Redis (in-process)       |
| **Auth**         | Authentication, OAuth, SSO                                                                                                                                     | Zitadel (external service, Docker sidecar) |

### Deployment Models

| Environment         | Orchestration             | Target User                                     |
| ------------------- | ------------------------- | ----------------------------------------------- |
| **Self-hosted**     | Docker Compose            | Small magazine with a VPS                       |
| **Managed hosting** | Coolify + Hetzner         | Magazines that don't want to run infrastructure |
| **Development**     | Docker Compose + hivemind | Contributors                                    |

### Monorepo Structure (Actual)

```
apps/
  api/                  Fastify API server (all backend logic, workers, federation)
  web/                  Next.js frontend
packages/
  db/                   Drizzle schema + RLS policies + migrations
  types/                Shared Zod schemas
  auth-client/          Zitadel OIDC/webhook utilities
  api-client/           TypeScript API client (openapi-fetch)
  plugin-sdk/           Adapter interfaces + plugin contracts + testing utilities
sdks/
  typescript/           Generated TypeScript SDK (@colophony/sdk)
  python/               Generated Python SDK (colophony)
  openapi.json          Exported OpenAPI 3.1 spec
```

All adapters (email, storage, payment, CMS) are built into `apps/api/src/adapters/` rather than separate packages. The plugin SDK defines adapter interfaces for third-party implementations.

---

## 4. Research Areas — Resolved

All eight research areas have been investigated and decisions finalized. Each subsection below links to the detailed evaluation in Section 5.

**4.1 Backend Framework** — Resolved: **Fastify 5**. Best balance of contributor friendliness, ecosystem, and performance. See [Section 5.1](#51-backend-framework).

**4.2 ORM / Data Access** — Resolved: **Drizzle ORM**. Best-in-class RLS support via `pgPolicy`, smallest runtime footprint, SQL-first philosophy. See [Section 5.2](#52-orm--data-access).

**4.3 Auth Service** — Resolved: **Zitadel**. Native multi-tenancy, API-first design for federation, ~512 MB RAM fits VPS. AGPL compatible with Colophony's open-source model. See [Section 5.3](#53-auth-service).

**4.4 Managed Hosting Orchestration** — Resolved: **Coolify + Hetzner** (Phase 1, 0-100 tenants). Cheapest cost-to-feature ratio, REST API for tenant automation, open-source aligned. See [Section 5.4](#54-managed-hosting-orchestration).

**4.5 API Layer Architecture** — Resolved: **tRPC (internal) + oRPC REST + OpenAPI 3.1 (public)**. GraphQL (Pothos + Yoga) was built but extracted to a feature branch pending user demand. Both surfaces share the service layer and Zod schemas. See [Section 5.5](#55-api-layer-architecture).

**4.6 Form Builder Architecture** — Resolved: **Custom build** with dnd-kit + shadcn/ui. JSON-based form definitions stored in PostgreSQL JSONB. 15 field types, conditional logic, embeddable via iframe. See [Section 5.6](#56-form-builder-architecture).

**4.7 Federation Protocol** — Resolved: **WebFinger + did:web + HTTP Message Signatures (RFC 9421) + custom REST operations**. Purpose-built for literary magazine federation. Includes Blind Submission Attestation Protocol (BSAP) for sim-sub enforcement. See [Section 5.7](#57-federation-protocol).

**4.8 Plugin / Extension System** — Resolved: **Five-tier extensibility model** (Webhooks → Adapters → Workflow Hooks → UI Extensions → Full Plugins). TypeScript-only, npm distribution. See [Section 5.8](#58-plugin--extension-system).

---

## 5. Research Results

> All research areas investigated 2026-02-11. Full evaluation text archived in git history.

### 5.1 Backend Framework

**Decision:** Fastify 5
**Decided:** 2026-02-11
**Candidates evaluated:** NestJS 11, Fastify 5, Hono 4, Elysia 1.4, Express 5
**Rationale:** Best balance of contributor friendliness (Express-like API, no decorators/DI), ecosystem completeness (tRPC adapter, OpenAPI), performance (~70-80k req/s), and maturity (OpenJS Foundation). Workers run in-process via BullMQ rather than separate worker apps.
**Key implementation details:**

- Plugin encapsulation model maps to shared packages in monorepo
- `@fastify/helmet` for security headers, `@fastify/websocket` for real-time
- oRPC for REST + OpenAPI 3.1 generation (replaced ts-rest from original plan)
- Tests use `app.inject()` (Fastify built-in), not supertest
  **Archived:** Full evaluation (88 lines) — see git history

### 5.2 ORM / Data Access

**Decision:** Drizzle ORM
**Decided:** 2026-02-11
**Candidates evaluated:** Prisma 5/7, Drizzle ORM, Kysely, TypeORM, raw pg + pgtyped
**Rationale:** Best-in-class RLS support — `pgPolicy` definitions in TypeScript schema files (version-controlled alongside tables), `sql` template tag for parameterized `set_config()` calls (no `$executeRawUnsafe` hack needed). Smallest runtime (~57 KB), fastest ORM benchmarks, SQL-first philosophy lowers contributor onboarding.
**Key implementation details:**

- RLS policies defined via `pgPolicy` in Drizzle schema — included in generated migrations
- `withRls()` wrapper in `packages/db/src/context.ts` sets `app.current_org` and `app.user_id` via `set_config()` inside transactions
- Forward-only migrations (no automatic rollbacks); rollback = write a new forward migration
- Relational query API covers most Prisma `include` patterns
- JSONB queries use `sql` template tag for PostgreSQL operators
- Nested transactions use savepoints internally
  **Archived:** Full evaluation (499 lines, 5 candidates) — see git history

### 5.3 Auth Service

**Decision:** Zitadel
**Decided:** 2026-02-11
**Candidates evaluated:** Keycloak, Zitadel, Ory (Kratos + Hydra), Logto, Authentik, SuperTokens
**Rationale:** Native multi-tenancy maps to Colophony's org model. API-first design (gRPC + REST) enables federation service integration. ~512 MB RAM fits VPS targets. Event-sourced architecture provides audit logging. AGPL license compatible with open-source distribution.
**Key implementation details:**

- User lifecycle synced via Zitadel webhooks → local `users` table
- Two-step webhook idempotency (INSERT event, check `processed` status)
- `@colophony/auth-client` package wraps REST-only methods
- Dual auth: Zitadel OIDC tokens (interactive) + API keys (programmatic)
- AGPL applies only to Zitadel modifications; Colophony code unaffected — see [`docs/licensing.md`](licensing.md) for full boundary documentation
  **Archived:** Full evaluation (440 lines, 6 candidates with weighted scoring) — see git history

### 5.4 Managed Hosting Orchestration

**Decision:** Coolify + Hetzner (Phase 1, 0-100 tenants)
**Decided:** 2026-02-11
**Candidates evaluated:** Kubernetes (managed), Fly.io, Railway, Coolify, Docker Swarm, HashiCorp Nomad, Kamal
**Rationale:** Best cost-to-feature ratio ($200-400/mo for 100 tenants on Hetzner). Open-source aligned (AGPL). REST API enables tenant provisioning automation. Built-in Let's Encrypt SSL, custom domains, Docker Compose support, database deployment with S3 backups. Manageable ops burden for 1-2 person team.
**Key implementation details:**

- Hetzner CX32 servers (~$7/mo each, 4 vCPU, 8GB), ~10-15 tenants per server
- Shared infrastructure (PostgreSQL with RLS, Redis, MinIO, Zitadel) on dedicated servers
- Monitoring via Prometheus + Grafana (deployed alongside via Coolify)
- Phase 2 (100-500 tenants): evaluate Fly.io or Kamal
- Phase 3 (500+ tenants): Kubernetes with dedicated platform hire
  **Archived:** Full evaluation (495 lines, 7 candidates with cost modeling) — see git history

### 5.5 API Layer Architecture

**Decision:** tRPC (internal) + oRPC REST + OpenAPI 3.1 (public)
**Decided:** 2026-02-11 (GraphQL extracted to feature branch 2026-03-16)
**Full research:** [docs/api-layer-v2-research.md](api-layer-v2-research.md)
**Rationale:** Two API surfaces share the same service layer and Zod schemas from `@colophony/types`. tRPC for type-safe internal frontend communication, oRPC for OpenAPI 3.1 REST at `/v1/docs`. GraphQL (Pothos + Yoga) was built but extracted to a feature branch (`chore/extract-graphql-to-feature-branch`) pending user demand — re-merge when needed.
**Key implementation details:**

- oRPC replaced ts-rest (from original plan) for better OpenAPI 3.1 and Zod 4 support
- SDK generation: TypeScript (openapi-fetch) + Python (openapi-python-client)
- REST versioning: URL path (`/v1/`)
  **Archived:** Full evaluation (175 lines) — see git history. Full API research: `docs/api-layer-v2-research.md`

### 5.6 Form Builder Architecture

**Decision:** Custom build with dnd-kit + shadcn/ui
**Decided:** 2026-02-11
**Full research:** [docs/form-builder-research.md](form-builder-research.md)
**Candidates evaluated:** SurveyJS, Formbricks, Form.io, Typebot, HeyForm, Tripetto
**Rationale:** Submission forms are product-differentiating (tus/ClamAV integration, submission periods, blind submission toggles). Custom build gives full control with no license dependencies, consistent with existing shadcn/ui.
**Key implementation details:**

- JSON-based form definitions stored in PostgreSQL JSONB (`FormDefinition` table)
- 15 field types: text, textarea, rich_text, number, email, url, date, select, multi_select, radio, checkbox, checkbox_group, file_upload, section_header, info_text
- dnd-kit (`@dnd-kit/core` + `@dnd-kit/sortable`) for drag-and-drop
- Conditional logic engine (JSON Logic-inspired): SHOW/HIDE/ENABLE/DISABLE/REQUIRE
- Embeddable forms via iframe with postMessage auto-resize
- Zod schemas generated from form definitions at runtime
  **Archived:** Full evaluation (94 lines) — see git history. Full research: `docs/form-builder-research.md`

### 5.7 Federation Protocol

**Decision:** WebFinger + did:web + HTTP Message Signatures (RFC 9421) + custom REST operations
**Decided:** 2026-02-11
**Candidates evaluated:** ActivityPub, custom REST, OAuth2 federation, Matrix, WebFinger + custom (hybrid), OpenID Connect Federation
**Rationale:** Colophony's federation needs are fundamentally different from social networking. ActivityPub brings complexity for features not needed (follows, boosts, timelines). A purpose-built protocol using WebFinger for discovery and did:web for identity gives exactly what's needed with minimal complexity while remaining standards-based.
**Key implementation details:**

- Discovery: WebFinger (RFC 7033) at `/.well-known/webfinger`
- Identity: did:web (W3C DID) documents at `/.well-known/did.json`
- Server-to-server auth: HTTP Message Signatures (RFC 9421) with Ed25519
- Sim-sub enforcement: Blind Submission Attestation Protocol (BSAP) — content fingerprints (SHA-256) shared without revealing submission content
- Piece transfer: JWT-based transfer tokens (72h TTL), signed by origin instance
- Trust: Admin-controlled per-instance (allowlist, open, managed_hub modes)
- Identity migration: DID document transfer + cross-instance notification
- Hub mode: Managed hosting instances auto-trust via `HUB_REGISTRATION_TOKEN`
- Feature-flagged: `FEDERATION_ENABLED=false` by default
- Libraries: `jose` for JWT/JWK, Node.js `crypto` for Ed25519, custom HTTP signature implementation
  **Key design decisions:**
- SHA-256 exact match for fingerprinting (not fuzzy — privacy-preserving)
- Per-instance rate limiting for federation requests (configurable per trusted peer)
- Two-layer identity: Zitadel = authentication authority, Federation service = identity publisher
- Federation GDPR: each instance is an independent data controller
  **Archived:** Full evaluation (1010 lines, 6 candidates + full protocol design) — see git history

### 5.8 Plugin / Extension System

**Decision:** Five-tier extensibility model
**Decided:** 2026-02-11
**Full research:** [docs/research/plugin-extension-system.md](./research/plugin-extension-system.md)
**Rationale:** Studied 7 plugin/extension systems (WordPress, Strapi, Ghost, OJS, Grafana, VS Code, Backstage). Combined patterns into a five-tier model matching different integration depths.
**Key implementation details:**

- **Tier 0: Webhooks** (Ghost-inspired) — zero-code external HTTP notifications
- **Tier 1: Adapters** (Backstage extension points) — typed interface implementations for email, payment, storage, auth, search
- **Tier 2: Workflow Hooks** (WordPress-inspired, fully typed) — action hooks (fire-and-forget) and filter hooks (data transformation chain)
- **Tier 3: UI Extensions** (VS Code contribution points) — declarative manifest-based admin panel extensions
- **Tier 4: Full Plugins** (Strapi + Backstage lifecycle) — register/bootstrap/destroy lifecycle with full service access
- TypeScript-only, npm distribution, Zod config schemas, permission-scoped security
- Plugin SDK: `packages/plugin-sdk/src/` (adapters, hooks, config, plugin-base, testing)
- Remote plugin registry with fetch + cache via `plugin-registry.service.ts`
  **Archived:** Full research: `docs/research/plugin-extension-system.md`

### 5.9 Decision Interaction Matrix

Four interaction effects between independently-evaluated research areas were identified and resolved:

| Interaction                          | Problem                                                                            | Resolution                                                                                                                                                                                       |
| ------------------------------------ | ---------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **Fastify + API Layer** (5.1 + 5.5)  | API layer research assumed NestJS adapters                                         | `@ts-rest/fastify` exists; GraphQL Yoga integrates via `handleNodeRequest`. Later replaced ts-rest with oRPC.                                                                                    |
| **Drizzle + Pothos** (5.2 + 5.5)     | Pothos scored 39/50 with Prisma plugin; no Drizzle plugin exists (revised: ~29/50) | Keep Pothos for Zod single-source-of-truth. Accept manual type definitions and dataloader setup. Works well in practice.                                                                         |
| **Drizzle + Zitadel** (5.2 + 5.3)    | User identity lives in Zitadel; `users` table in Drizzle DB                        | Webhook-based sync via Zitadel Actions. Two-step idempotency. Local DB is canonical read source.                                                                                                 |
| **Zitadel + Federation** (5.3 + 5.7) | did:web identity resolution vs Zitadel OIDC                                        | Two-layer architecture: Zitadel = authentication authority, Federation service = identity publisher. Share `users` table, different responsibilities. Federation feature-flagged off by default. |

**Archived:** Full interaction analysis (374 lines with code examples) — see git history

---

## 6. Implementation Strategy

> **Added:** 2026-02-11, post senior dev review
> **Key insight:** The MVP was never publicly released. There are no existing users, no backwards compatibility constraints, and no time pressure. This enables building a complete, polished platform for a single v2.0 release rather than shipping incremental public versions.

### 6.1 Development Philosophy

**Not a "minimum viable product" — a complete platform that competes with Submittable on day one.**

| Assumption           | Old (Wrong)               | Revised (Correct)                                                         |
| -------------------- | ------------------------- | ------------------------------------------------------------------------- |
| **Timeline**         | 6-9 months to v2.0 MVP    | 18-24 months to single complete release                                   |
| **Federation**       | Defer to v2.1 (too risky) | Build alongside core features (Months 10-15)                              |
| **GraphQL**          | Defer to v2.1             | Built alongside REST, then extracted to feature branch (no active demand) |
| **Form builder**     | Ship basic, iterate later | Build complete (all 15 types + conditional logic)                         |
| **Plugin system**    | Ship webhooks only        | Build Tier 0-4 before launch                                              |
| **Beta testing**     | None (ship to real users) | 4 private cohorts over 18 months                                          |
| **Release strategy** | v2.0 → v2.1 → v2.2        | Single v2.0 with complete feature set                                     |

**Why this is architecturally superior:**

- Identity model baked in from day one (`did:web`, federated accounts)
- Submission data model includes federation fields (content fingerprint, cross-instance references) from the start
- No painful migration from "single-instance" to "federated" mode
- Beta testing with 5-10 magazines covers the full stack including federation

### 6.2 Development Tracks (Parallel)

Ten tracks covering the full platform build. Tracks 1-8 and 10 are complete; Track 9 (governance docs) is not yet started.

```
Track 1: Core Infrastructure                    ✅ Complete
├─ Framework migration (NestJS → Fastify)
├─ ORM migration (Prisma → Drizzle)
├─ Auth integration (Zitadel)
├─ Managed hosting setup (Coolify + Hetzner)
├─ Monitoring/observability (Prometheus + Grafana + Sentry)
└─ CI/CD pipeline

Track 2: Colophony API                          ✅ Complete
├─ Service layer extraction from tRPC routers
├─ REST + tRPC (parallel, shared service layer)
├─ SDK generation (TypeScript, Python)
├─ API documentation (OpenAPI 3.1)
└─ GraphQL (Pothos + Yoga) built then extracted to feature branch

Track 3: Hopper — Submission Management         ✅ Complete
├─ Form builder (all 15 field types + conditional logic)
├─ File upload + virus scanning (tus pipeline)
├─ Embeddable forms (iframe)
├─ Submission review pipeline
├─ Writer workspace (portfolio, manuscript library, analytics)
└─ GDPR tools

Track 4: Slate — Publication Pipeline           ✅ Complete
├─ Post-acceptance workflow
├─ Copyedit/proofread stages
├─ Contract generation + e-signature (Documenso adapter)
├─ Workflow orchestration (Inngest)
├─ Issue assembly
├─ CMS integration (WordPress, Ghost adapters)
└─ Editorial calendar

Track 5: Register — Identity & Federation       ✅ Complete
├─ Discovery (WebFinger, .well-known)
├─ Identity (did:web documents)
├─ Trust establishment (allowlist/open/managed_hub)
├─ Sim-sub enforcement (BSAP)
├─ Piece transfer
├─ Identity migration
└─ Hub for managed hosting

Track 6: Colophony Plugins                      📦 Extracted
├─ Webhooks (Tier 0) — kept (Relay webhook system)
├─ Adapters (Tier 1) — kept (email, storage, payment, CMS)
├─ Workflow hooks (Tier 2)  ─┐
├─ UI extensions (Tier 3)   ├─ extracted to `chore/extract-plugin-system`
├─ Full plugins (Tier 4)    │  Re-merge when demand materializes.
└─ Plugin SDK + registry   ─┘

Track 7: Writer Experience                      ✅ Complete
├─ Writer workspace (cross-org portfolio)
├─ Manuscript library
├─ CSV import flows
├─ Writer analytics (personal stats/charts)
└─ CSR data portability (export/import)

Track 8: Data Portability & Standards           ✅ Complete
├─ Colophony Submission Record (CSR) format spec
├─ Manual correspondence tracking
├─ Duplicate detection (fingerprinting)
└─ CSR documentation

Track 9: Governance & Public Docs               🔲 Not started
├─ AGPL compliance documentation
├─ Contributor guidelines
├─ Code of conduct
└─ Public-facing architecture docs

Track 10: Observability & Hardening             ✅ Complete
├─ Sentry error tracking
├─ Prometheus metrics (/metrics endpoint)
├─ Instrumented BullMQ workers
├─ SSRF validation for outbound URLs
└─ Webhook hardening (signatures, timestamps, rate limiting)

Cross-cutting: Relay — Notifications            ✅ Complete
├─ Email templates + provider integration (SMTP, SendGrid)
├─ Webhook delivery system
├─ In-app notification center
└─ Integrated across Hopper, Slate, Register
```

**Dependency graph:**

```
Track 1 (Infrastructure)     → Blocked everything
Track 2 (Colophony API)      → Depended on Track 1
Track 3 (Hopper)             → Depended on Track 1 + 2
Track 4 (Slate)              → Depended on Track 1 + 2
Track 5 (Register)           → Depended on Track 1 + 2
Track 6 (Colophony Plugins)  → Depended on Track 2
Track 7 (Writer Experience)  → Depended on Track 3
Track 8 (Data Portability)   → Depended on Track 3 + 5
Track 9 (Governance Docs)    → Depends on Track 1-8
Track 10 (Observability)     → Depended on Track 1
Relay (cross-cutting)        → Started in Track 1, evolved with each track
```

### 6.3 Timeline

**Original estimate:** 18-24 months across 5 phases with 4 beta cohorts.

**Actual:** Tracks 1-8 and 10 completed in ~3 weeks (2026-02-10 to 2026-03-02). The original timeline assumed a single developer working part-time with manual coding. AI-assisted development (Claude Code) dramatically compressed the schedule. All architectural decisions, implementation, testing, and CI/CD were completed in this period.

**Remaining:** Track 9 (governance docs) and public launch preparation are not yet started.

### 6.4 Beta Testing Strategy

> **Note:** This section was pre-launch planning written 2026-02-11. The 4-cohort beta strategy was designed for an 18-24 month timeline. Actual testing has been done via CI (unit, RLS integration, Playwright E2E) and manual QA. Real-world beta testing with external magazines has not yet begun.

### 6.5 Risk Assessment — Post-Implementation Review

**Risks that were resolved during development:**

- ~~Federation complexity~~ — Built and tested across Tracks 5 and 8. did:web + HTTP signatures + BSAP all working.
- ~~Pothos + Drizzle gap~~ — Manual integration patterns worked well. GraphQL surface later extracted to feature branch (no active user demand).
- ~~Form builder scope~~ — All 15 field types + conditional logic shipped.
- ~~Plugin system maturity~~ — Tier 0-4 built; plugin system (Tiers 2-4, SDK, registry) later extracted to feature branch `chore/extract-plugin-system` pending demand. Adapters and webhooks remain in main.

**Risks that remain open:**

- **Coolify single-maintainer** — Still a concern. Monitoring in place (Prometheus, Sentry), AGPL fork remains viable fallback.
- **Sim-sub enforcement novelty** — Built but untested with real magazines. Needs beta validation.
- **Federation GDPR compliance** — Requires legal review before public launch.

**Risks that did NOT materialize:**

- Scope creep — Compressed timeline eliminated this concern.
- Technology churn — 3-week build avoided dependency drift entirely.
- Motivation/burnout — AI-assisted development kept momentum high.

### 6.6 Pothos + Drizzle Decision Point — Resolved (Extracted)

**Decision:** Pothos was chosen and worked well. Manual integration patterns (type definitions, dataloader, pagination) were acceptable. The GraphQL surface was later extracted to a feature branch (`chore/extract-graphql-to-feature-branch`) during architecture review — no active user demand justified the maintenance burden (~8,350 lines, 5 npm deps). Re-merge when demand materializes.

---

## 7. Open Questions

Questions that emerged during the interview that need further discussion:

1. ~~**Submitter role architecture:** How does the Submitter role work when someone is a submitter at one publication and an editor at another? Is this per-org role assignment, or a global identity with per-org role bindings?~~ **RESOLVED:** Submitter is **not an org role** — it is a global user capability. `organization_members` stays `ADMIN | EDITOR | READER` (staff only). A user's submitter identity is expressed through their **manuscript library** (user-owned, cross-org) and **submissions** (the junction between a manuscript and an org's submission period). No org membership is required to submit. Org-to-writer broadcast (calls for submissions, announcements) is handled through a **follow/subscribe** model (Relay), not membership. Post-acceptance contributor relationships are a Slate (Track 4) concern. A person can simultaneously be a submitter (global) and an editor/admin at different orgs — these are independent relationships.

2. ~~**Self-serve org creation:** For managed hosting, can anyone create an org, or is it provisioned? For self-hosted, the deployer is presumably the admin.~~ **PARTIALLY RESOLVED:** Org creation is **self-serve** in both contexts — no approval gates. **Self-hosted:** deployer creates the first org, becomes ADMIN; additional orgs at deployer's discretion (most deployments are single-org). **Managed hosting:** self-serve with a **free tier** (hard quota limits on submissions, storage, etc.) and paid upgrade to remove limits. All features available on all tiers (no feature gating). Managed hosting infrastructure (Coolify provisioning, Stripe subscription billing, quota enforcement, free-tier limits) **deferred** — not in scope until post-Track 3. Implementation details to be decided when managed hosting work begins.

3. ~~**Data model for federation:** What data crosses instance boundaries? Just identity? Submission metadata? Full submissions? How is this governed?~~ **RESOLVED:** Identity (DID-based user keys), content fingerprints (SHA-256 for sim-sub), submission metadata (title, cover letter), and files (via signed JWT transfer tokens) cross boundaries. Governed per-instance: admin-controlled trust (allowlist/open/managed_hub modes), per-peer capability grants, hub attestation for managed hosting. See Track 5 PRs #180-#184.

4. ~~**CMS "starter home" scope:** How basic is the built-in publishing layer? Static pages? Blog-like? Magazine-format with issue structure?~~ **RESOLVED:** Integration-only for v2.0. CMS adapters (WordPress, Ghost) push content to external CMS platforms. No built-in publishing layer — magazines use their existing CMS.

5. **Subscription/membership research:** Need to evaluate Ghost memberships, Memberful, Steady, and open-source alternatives for the magazine subscription feature.

6. **Billing for managed hosting:** How does the flat-rate + volume add-on pricing actually work? What's the volume threshold? How are overages calculated?

7. ~~**Migration path from MVP:** For any existing MVP deployments (if any), how do they migrate to v2?~~ **RESOLVED:** MVP was never publicly released — no external users to migrate. Clean break: v2 is a full rewrite with no data migration path from v1. Internal dev data was discarded.

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
