# Backlog

> Items deferred from sessions or identified during reviews, organized by development track.
> Promote to GitHub Issues when ready to actively schedule.
>
> **Maintenance:** `/end-session` captures new deferrals here. `/start-session` surfaces items for the current track.
> DEVLOG "Next" sections should only contain immediate session-to-session continuity (e.g., "finish the PR I started"). Anything else belongs here.

---

## Track 1 — Core Infrastructure

### Code

- [x] Security headers via @fastify/helmet (CSP, HSTS, X-Content-Type-Options) — (security checklist)
- [x] Add `Permissions-Policy` header to restrict browser features — (Codex review 2026-02-15)
- [x] Endpoint-specific `Cache-Control` for authenticated JSON responses — (Codex review 2026-02-15)
- [x] Wire rate limiting globally on all API surfaces — hook exists in `apps/api/src/hooks/rate-limit.ts`, needs registration on all routes — (security checklist)
- [x] Zitadel OIDC token validation enforced on all protected routes — (security checklist, PR #72)
- [x] API key authentication with scopes — blocks Track 2 REST API — (security checklist, PR pending 2026-02-15)
- [ ] Input validation with Zod on all API surfaces — tRPC has it, needs enforcement on future REST/GraphQL — (security checklist)
- [x] Storage: block public access via MinIO bucket policy — (security checklist, PR #90)
- [x] Stripe webhook signature verification + idempotency — (security checklist)
- [x] Dedicated `audit_writer` DB role with INSERT-only on `audit_events` — production hardening — (DEVLOG 2026-02-12, 2026-02-13; done 2026-02-17 PR #89)
- [x] In-memory per-IP throttle for auth failure auditing — DoS protection — (DEVLOG 2026-02-12, 2026-02-13; done 2026-02-17 PR #89)
- [x] Restore two-tier rate limiting (AUTH_MAX for authenticated users) via second-pass hook after auth — (DEVLOG 2026-02-15, Codex review; done 2026-02-17 PR #89)
- [x] Request correlation columns (`requestId`, `method`, `route`) in `audit_events` — requires schema migration — (DEVLOG 2026-02-12, 2026-02-13; done 2026-02-17 PR #89)
- [x] Zitadel webhook two-step idempotency — current one-step pattern doesn't handle crash recovery (row inserted but `processed=false`); align with Stripe webhook's two-step pattern — (Codex review 2026-02-17; done 2026-02-17)
- [ ] Audit query/list endpoints — wait for API surfaces — (DEVLOG 2026-02-13)
- [ ] Seed data (`packages/db/src/seed.ts` has TODO) — wait for API layer — (code TODO)

### Ops / Deployment

- [ ] Coolify + Hetzner managed hosting setup — (architecture doc Track 1)
- [ ] Monitoring stack: Prometheus + Grafana + Loki — (architecture doc Track 1)

### QA / Testing

- [ ] Manual testing of 4 submission pages with dev server — (DEVLOG 2026-02-15)
- [ ] E2E tests for submission flow — (DEVLOG 2026-02-15)
- [ ] E2E tests for upload flow — needs tusd + MinIO in CI — (DEVLOG 2026-02-15)
- [ ] E2E tests for OIDC flow — requires Zitadel instance — (DEVLOG 2026-02-13)
- [ ] Manual QA of full org management flow with Zitadel + dev services running — (DEVLOG 2026-02-13)
- [ ] Manual QA: webhook freshness/rate-limit/ordering with Docker Compose + Zitadel — (DEVLOG 2026-02-15)

### Housekeeping

- [x] Clean up v1 components (`_v1/` directory) — (DEVLOG 2026-02-15; done 2026-02-17)
- [ ] Consider Playwright tsconfig extending web for E2E type-checking — nice-to-have — (DEVLOG 2026-02-15)
- [x] Migrate `forwardRef` → ref-as-prop in 19 shadcn/ui components — React 19 deprecation — (DEVLOG 2026-02-16; done 2026-02-17)
- [x] Migrate `Context.Provider` → `Context` — React 19 deprecation — (DEVLOG 2026-02-16; done 2026-02-17)
- [x] Refactor OIDC guard `setState` in effects to satisfy `react-hooks/set-state-in-effect` — `callback/page.tsx` — (DEVLOG 2026-02-16; done 2026-02-17)

---

## Track 2 — Colophony API

### Code

- [x] Service layer extraction from tRPC routers — PR 1 (foundation) done 2026-02-17 #94; PR 2 (router refactor) done 2026-02-17 — (architecture doc Track 2)
- [x] oRPC REST API surface — PR 1: contracts + organizations (replaces ts-rest; done 2026-02-18) — (architecture doc Track 2)
- [x] oRPC REST API surface — PR 2: submissions, files, users, API keys contracts + OpenAPI spec endpoint — (DEVLOG 2026-02-18; done 2026-02-18)
- [ ] oRPC REST API surface — PR 3: typed client package — (DEVLOG 2026-02-18)
- [ ] API key scope enforcement on REST endpoints — (DEVLOG 2026-02-18, plan)
- [ ] Pothos + GraphQL Yoga surface — decision point at Month 3: Pothos vs TypeGraphQL — (architecture doc Track 2, Section 6.6)
- [ ] SDK generation (TypeScript, Python) — (architecture doc Track 2)
- [ ] API documentation — (architecture doc Track 2)

### Design Decisions

- [ ] Submitter role architecture: per-org role assignment vs global identity with per-org role bindings — (architecture doc Open Question #1)
- [ ] Self-serve org creation: managed hosting provisioning model vs self-hosted admin — (architecture doc Open Question #2)

---

## Track 3 — Hopper (Submission Management)

### Code

- [ ] Form builder — all 15 field types — (architecture doc Track 3, form-builder-research.md)
- [ ] Conditional logic engine — (architecture doc Track 3, form-builder-research.md)
- [ ] Embeddable forms (iframe) — (architecture doc Track 3, form-builder-research.md)
- [ ] Submission periods UI — schema exists, no UI — (DEVLOG 2026-02-15)
- [ ] Editor dashboard rewrite (`/editor` pages) — current pages are stubs — (DEVLOG 2026-02-15)
- [ ] GDPR deletion mutation — stubbed with TODO — (DEVLOG 2026-02-15)
- [ ] GDPR tools finalization from MVP — (architecture doc Track 3)
- [ ] Org deletion — needs careful cascade handling — (DEVLOG 2026-02-13)

---

## Track 4 — Slate (Publication Pipeline)

### Code

- [ ] Post-acceptance workflow — (architecture doc Track 4)
- [ ] Copyedit/proofread stages — (architecture doc Track 4)
- [ ] Contract generation + e-signature — Documenso via Tier 1 adapter — (architecture doc Track 4, decision 2026-02-15)
- [ ] Issue assembly — (architecture doc Track 4)
- [ ] CMS integration (WordPress, Ghost) — (architecture doc Track 4)
- [ ] Editorial calendar — (architecture doc Track 4)

### Research / Design

- [ ] Workflow orchestration evaluation: Inngest (preferred) vs Temporal — evaluate at Track 4 design time — (decision 2026-02-15)
- [ ] CMS "starter home" scope: static pages vs blog-like vs magazine-format with issue structure — (architecture doc Open Question #4)

---

## Track 5 — Register (Identity & Federation)

### Code

- [ ] Discovery: WebFinger + `.well-known` endpoints — (architecture doc Track 5)
- [ ] Identity: `did:web` documents — use `jose` library — (architecture doc Track 5, decision 2026-02-15)
- [ ] Trust establishment — use `openid-client` for OIDC flows — (architecture doc Track 5, decision 2026-02-15)
- [ ] Sim-sub enforcement (BSAP) — (architecture doc Track 5)
- [ ] Piece transfer — (architecture doc Track 5)
- [ ] Identity migration — (architecture doc Track 5)
- [ ] Hub for managed hosting — (architecture doc Track 5)

### Design Decisions

- [ ] Data model for federation: what data crosses instance boundaries, governance — (architecture doc Open Question #3)

---

## Track 6 — Colophony Plugins

### Phase 1-2 (v2 launch)

- [ ] `@colophony/plugin-sdk` with adapter interfaces (Email, Payment, Storage, Search, Auth, Newsletter) — (plugin research Section 11)
- [ ] Built-in adapters: SMTP, Stripe, S3 — (plugin research Section 11)
- [ ] `colophony.config.ts` plugin loader — (plugin research Section 11)
- [ ] HookEngine with typed hooks for submission lifecycle — (plugin research Section 11)
- [ ] Webhook delivery via BullMQ with retry + dead letter queue — (plugin research Section 11)
- [ ] Webhook configuration UI — (plugin research Section 11)

### Phase 3-4 (v2.1-v2.2)

- [ ] UI contribution point system (dashboard widgets, settings pages, submission detail sections) — (plugin research Section 11)
- [ ] In-app Plugin Gallery (JSON registry, one-click install) — (plugin research Section 11)
- [ ] `@colophony/create-plugin` scaffolding CLI — (plugin research Section 11)
- [ ] Evaluate n8n / Activepieces as recommended external automation target — security: must be network-isolated — (decision 2026-02-15)

### Phase 5-6 (v2.3+)

- [ ] Plugin signing via npm trusted publishing + Sigstore Cosign — (plugin research Section 6, decision 2026-02-15)
- [ ] OPA load-time permission policy for managed hosting — (plugin research Section 6, decision 2026-02-15)
- [ ] Frontend sandboxing for community UI plugins — (plugin research Section 11)
- [ ] Managed hosting plugin allow-list — (plugin research Section 11)
- [ ] Full marketplace website with ratings, reviews, compatibility matrix — (plugin research Section 11)

### Design Decisions

- [ ] Plugin configuration storage: database per-org (encrypted) vs env vars per-deployment — (plugin research Open Question #1)
- [ ] Hot-reload in production: loadable without restart vs requires restart — (plugin research Open Question #2)
- [ ] Plugin marketplace governance: review criteria, signing key management — (plugin research Open Question #3)
- [ ] Database access for Tier 4 plugins: direct DB (with RLS) vs service API — (plugin research Open Question #4)
- [ ] Frontend plugin bundling: runtime dynamic import vs compile-time — (plugin research Open Question #5)
- [ ] Webhook vs event bus for Tier 0: webhooks only vs Redis pub/sub or NATS — (plugin research Open Question #6)

---

## Cross-Cutting — Relay (Notifications & Communications)

- [ ] Email templates + provider integration (SendGrid) — (architecture doc, Relay)
- [ ] Webhook delivery system (outbound) — (architecture doc, Relay)
- [ ] In-app notification center — (architecture doc, Relay)

---

## Dependency Upgrades

> Most dependencies were not deliberately pinned — they were current-at-the-time when v2 started (Feb 2026).
> Several were already behind at that point. Prioritized by EOL risk and security impact.

### [P0] Urgent — EOL / Security

- [x] Node.js 20 → 22 LTS — Node 20 EOL is April 30, 2026; upgraded to v22.22.0 — (dependabot 2026-02-15, done 2026-02-16)
- [x] Next.js 15 → 16 + React 18 → 19 + eslint-config-next 15 → 16 — bundled upgrade; Next 16 requires React 19; Next 16 shipped Oct 2025 — (dependabot #79, #81, #75; done 2026-02-16)

### [P1] High — Major versions, actively maintained

- [x] Zod 3 → 4 — ground-up rewrite (stable May 2025); touches types package, all tRPC inputs, env config; largest migration surface — (dependabot #80; done 2026-02-17)
- [x] TanStack Query 4 → 5 — upgraded with tRPC 11; `isPending` alias pattern used; `fetchStatus` workaround removed from `use-auth.ts` — (dependabot #74; done 2026-02-17)
- [x] tRPC 10 → 11 — combined tRPC 11 + TQ5 + TS 5.7.2 migration; TS2742 quirk resolved — (CLAUDE.md version pin; done 2026-02-17)

### [P2] Medium — Dev tooling, lower risk

- [x] Vitest 3 → 4 — shipped Oct 2025; dev-only, but 261+ tests need validation — (dependabot #76; done 2026-02-17)
- [x] @testing-library/react 14 → 16 — dev-only; skipped v15; bundled with Next 16 + React 19 upgrade — (dependabot #78; done 2026-02-16)

### [P3] Low — Unused or minimal impact

- [ ] nodemailer 7 → 8 — Relay not built yet; upgrade when starting Relay — (dependabot #77)

### Upgrade order notes

- **Node 22** can be done independently — update `.nvmrc`, engines fields, CI matrix, test
- **Next 16 + React 19** must move together; eslint-config-next follows
- **Zod 4** should happen before or alongside **tRPC 11** since tRPC's Zod error behavior is the pin reason
- **TanStack Query 5** is independent but touches the same web app files as React 19

---

## Production Deployment Checklist

- [ ] Change `app_user` password from default — (CLAUDE.md)
- [ ] PostgreSQL SSL/TLS (`sslmode=require`) — (CLAUDE.md)
- [ ] Connection pooling (PgBouncer) — (CLAUDE.md)
- [ ] Backups (WAL-G to S3) — (CLAUDE.md)
- [ ] `pg_stat_statements` for query monitoring — (CLAUDE.md)
- [ ] Rotate credentials quarterly — (CLAUDE.md)
- [ ] AGPL license boundary documented (Zitadel is AGPL) — (CLAUDE.md)
- [ ] Verify RLS in production — see `packages/db/CLAUDE.md` for verification queries — (CLAUDE.md)
