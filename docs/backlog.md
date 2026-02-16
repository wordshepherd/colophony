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
- [ ] API key authentication with scopes — blocks Track 2 REST API — (security checklist)
- [ ] Input validation with Zod on all API surfaces — tRPC has it, needs enforcement on future REST/GraphQL — (security checklist)
- [ ] Storage: block public access via MinIO bucket policy — (security checklist)
- [ ] Stripe webhook signature verification + idempotency — no Stripe handler exists yet — (security checklist)
- [ ] Dedicated `audit_writer` DB role with INSERT-only on `audit_events` — production hardening — (DEVLOG 2026-02-12, 2026-02-13)
- [ ] In-memory per-IP throttle for auth failure auditing — DoS protection — (DEVLOG 2026-02-12, 2026-02-13)
- [ ] Restore two-tier rate limiting (AUTH_MAX for authenticated users) via second-pass hook after auth — (DEVLOG 2026-02-15, Codex review)
- [ ] Request correlation columns (`requestId`, `method`, `route`) in `audit_events` — requires schema migration — (DEVLOG 2026-02-12, 2026-02-13)
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

- [ ] Clean up v1 components (`_v1/` directory) — (DEVLOG 2026-02-15)
- [ ] Consider Playwright tsconfig extending web for E2E type-checking — nice-to-have — (DEVLOG 2026-02-15)

---

## Track 2 — Colophony API

### Code

- [ ] Service layer extraction from tRPC routers — (architecture doc Track 2)
- [ ] ts-rest REST API surface with Fastify adapter — (architecture doc Track 2)
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

## Production Deployment Checklist

- [ ] Change `app_user` password from default — (CLAUDE.md)
- [ ] PostgreSQL SSL/TLS (`sslmode=require`) — (CLAUDE.md)
- [ ] Connection pooling (PgBouncer) — (CLAUDE.md)
- [ ] Backups (WAL-G to S3) — (CLAUDE.md)
- [ ] `pg_stat_statements` for query monitoring — (CLAUDE.md)
- [ ] Rotate credentials quarterly — (CLAUDE.md)
- [ ] AGPL license boundary documented (Zitadel is AGPL) — (CLAUDE.md)
- [ ] Verify RLS in production — see `packages/db/CLAUDE.md` for verification queries — (CLAUDE.md)
