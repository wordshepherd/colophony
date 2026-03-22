# Backlog

> Items deferred from sessions or identified during reviews, organized by development track.
> Promote to GitHub Issues when ready to actively schedule.
>
> **Maintenance:** `/end-session` captures new deferrals here. `/start-session` surfaces items for the current track.
> DEVLOG "Next" sections should only contain immediate session-to-session continuity (e.g., "finish the PR I started"). Anything else belongs here.

---

## Track 1 — Core Infrastructure ✓

> **Status:** Code and QA complete. Remaining ops items moved to Production Deployment Checklist.

### Code

- [x] Security headers via @fastify/helmet (CSP, HSTS, X-Content-Type-Options) — (security checklist)
- [x] Add `Permissions-Policy` header to restrict browser features — (Codex review 2026-02-15)
- [x] Endpoint-specific `Cache-Control` for authenticated JSON responses — (Codex review 2026-02-15)
- [x] Wire rate limiting globally on all API surfaces — hook exists in `apps/api/src/hooks/rate-limit.ts`, needs registration on all routes — (security checklist)
- [x] Zitadel OIDC token validation enforced on all protected routes — (security checklist, PR #72)
- [x] API key authentication with scopes — blocks Track 2 REST API — (security checklist, PR pending 2026-02-15)
- [x] Input validation with Zod on all API surfaces — schema tightening + shared-schema consolidation done 2026-02-18; `.output()` validation deferred to PR 2 — (security checklist)
- [x] Storage: block public access via MinIO bucket policy — (security checklist, PR #90)
- [x] Stripe webhook signature verification + idempotency — (security checklist)
- [x] Dedicated `audit_writer` DB role with INSERT-only on `audit_events` — production hardening — (DEVLOG 2026-02-12, 2026-02-13; done 2026-02-17 PR #89)
- [x] In-memory per-IP throttle for auth failure auditing — DoS protection — (DEVLOG 2026-02-12, 2026-02-13; done 2026-02-17 PR #89)
- [x] Restore two-tier rate limiting (AUTH_MAX for authenticated users) via second-pass hook after auth — (DEVLOG 2026-02-15, Codex review; done 2026-02-17 PR #89)
- [x] Request correlation columns (`requestId`, `method`, `route`) in `audit_events` — requires schema migration — (DEVLOG 2026-02-12, 2026-02-13; done 2026-02-17 PR #89)
- [x] Zitadel webhook two-step idempotency — current one-step pattern doesn't handle crash recovery (row inserted but `processed=false`); align with Stripe webhook's two-step pattern — (Codex review 2026-02-17; done 2026-02-17)
- [x] Audit query/list endpoints — wait for API surfaces — (DEVLOG 2026-02-13; done 2026-02-18 PR #101)
- [x] Seed data (`packages/db/src/seed.ts` has TODO) — wait for API layer — (code TODO; done 2026-02-18 PR #104)
- [x] [P2] Sliding window rate limiting — replaced fixed-window Lua script with sliding-window-log algorithm using Redis sorted sets; fixes burst-at-boundary 2x rate vulnerability; kept custom two-tier design (IP pre-auth + user post-auth) — (dev feedback 2026-02-25; done 2026-02-25)
- [x] [P2] RLS app connection fallback to superuser — packages/db/src/client.ts appPool falls back to DATABASE_URL when DATABASE_APP_URL is unset; production could silently use superuser credentials — (Codex review 2026-03-03; done 2026-03-04)

### QA / Testing

- [x] Manual testing of 4 submission pages with dev server — (DEVLOG 2026-02-15; done 2026-02-19)
- [x] E2E tests for submission flow — (DEVLOG 2026-02-15; done 2026-02-18 PR pending)
- [x] E2E tests for upload flow — needs tusd + MinIO in CI — (DEVLOG 2026-02-15; done 2026-02-18)
- [x] E2E tests for OIDC flow — requires Zitadel instance — (DEVLOG 2026-02-13; done 2026-02-18)
- [x] Manual QA of full org management flow with Zitadel + dev services running — (DEVLOG 2026-02-13; done 2026-02-19)
- [x] Manual QA: webhook freshness/rate-limit/ordering with Docker Compose + Zitadel — (DEVLOG 2026-02-15; done 2026-02-19)
- [x] Web unit tests: auth hooks (`use-auth`, `use-organization`, `use-slug-check`) — (DEVLOG 2026-02-18; done 2026-02-19)
- [x] Web unit tests: `ProtectedRoute` rendering states (loading, no org, authenticated, error) — (DEVLOG 2026-02-18; done 2026-02-19)
- [x] Web unit tests: form components (org creation) — (DEVLOG 2026-02-18; done 2026-02-19)
- [x] Web unit tests: layout components with data states (user menu, sidebar, org switcher) — (DEVLOG 2026-02-18; done 2026-02-19)
- [x] Web unit tests: `SubmissionForm` + `FileUpload` — complex component with 5 tRPC queries/mutations, deferred from org/layout test PR — (DEVLOG 2026-02-19; done 2026-02-19)
- [x] Fix `create-org-form.spec.tsx` broken mocks — `mockDebouncedSlug` referenced in `beforeEach` but never declared; `slug` used in `useSlugCheck` mock factory instead of `_slug` parameter. All 7 tests fail. — (discovered 2026-02-19; done 2026-02-19)
- [x] Webhook integration tests: Stripe webhook → DB → side-effects with real database — (DEVLOG 2026-02-18; done 2026-02-19)
- [x] Webhook integration tests: Zitadel webhook → user sync → DB with real database — (DEVLOG 2026-02-18; done 2026-02-19)
- [x] Webhook integration tests: tusd webhook → file record → BullMQ job with real database — (DEVLOG 2026-02-18; done 2026-02-19)
- [x] CI: enable `@colophony/web` in type-check, build, and unit-test jobs — excluded during rewrite, rewrite is done — (DEVLOG 2026-02-18; done 2026-02-19)
- [x] CI: add Playwright submission E2E job (20 tests, needs Postgres service) — (DEVLOG 2026-02-18; done 2026-02-19)
- [x] CI: add Playwright uploads E2E job (6 tests, needs tusd + MinIO services) — (DEVLOG 2026-02-19; done 2026-02-19 PR #115)
- [x] CI: add Playwright OIDC E2E job (6 tests, needs Zitadel service) — (DEVLOG 2026-02-19; done 2026-02-19 PR #115)

### Housekeeping

- [x] Clean up v1 components (`_v1/` directory) — (DEVLOG 2026-02-15; done 2026-02-17)
- [x] Consider Playwright tsconfig extending web for E2E type-checking — nice-to-have — (DEVLOG 2026-02-15; done 2026-02-26)
- [x] Rewrite `docs/testing.md` for v2 — still references v1 patterns (Prisma, NestJS, old test counts/tiers); Playwright section updated but rest is stale — (DEVLOG 2026-02-18; done 2026-02-18)
- [x] Migrate `forwardRef` → ref-as-prop in 19 shadcn/ui components — React 19 deprecation — (DEVLOG 2026-02-16; done 2026-02-17)
- [x] Migrate `Context.Provider` → `Context` — React 19 deprecation — (DEVLOG 2026-02-16; done 2026-02-17)
- [x] Refactor OIDC guard `setState` in effects to satisfy `react-hooks/set-state-in-effect` — `callback/page.tsx` — (DEVLOG 2026-02-16; done 2026-02-17)

---

## Track 2 — Colophony API

### Code

- [x] Service layer extraction from tRPC routers — PR 1 (foundation) done 2026-02-17 #94; PR 2 (router refactor) done 2026-02-17 — (architecture doc Track 2)
- [x] oRPC REST API surface — PR 1: contracts + organizations (replaces ts-rest; done 2026-02-18) — (architecture doc Track 2)
- [x] oRPC REST API surface — PR 2: submissions, files, users, API keys contracts + OpenAPI spec endpoint — (DEVLOG 2026-02-18; done 2026-02-18)
- [x] oRPC REST API surface — PR 3: typed client package — (DEVLOG 2026-02-18; done 2026-02-18)
- [x] API key scope enforcement on REST + tRPC endpoints — (DEVLOG 2026-02-18, done 2026-02-18)
- [x] API key scope enforcement on GraphQL surface — `requireScopes` guard wired on all 10 query resolvers — (DEVLOG 2026-02-18; done 2026-02-19)
- [x] Stripe webhook: audit raw payload storage for PCI compliance — `stripe.webhook.ts` stores raw event payload in `stripe_webhook_events`; verified: Checkout Session events contain amounts/currency/payment_intent ID/metadata only, never card numbers/CVV/cardholder data. Added PCI note comment. — (Codex review 2026-02-18; done 2026-02-19)
- [x] Stripe webhook: `resourceId` passed to `insert_audit_event()` is Stripe session ID (`cs_...`), not UUID — fails `::uuid` cast in production. Fixed: removed `resourceId` from audit calls (session ID already in `newValue.stripeSessionId`); updated tests to use realistic `cs_test_` IDs. — (DEVLOG 2026-02-19; done 2026-02-19)
- [x] tRPC `.output()` runtime response validation — all 30 procedures wired with Zod output schemas; 9 new response schemas added — (input validation audit 2026-02-18; done 2026-02-18)
- [x] Pothos + GraphQL Yoga surface — PR 1: foundation (types, queries, DataLoaders, scope enforcement, Fastify integration) done 2026-02-19; PR 2: mutations done 2026-02-19 — (architecture doc Track 2, Section 6.6)
- [x] GraphQL mutations (PR 2) — 16 mutations + API key list query, unit tests (36 new tests) — done 2026-02-19
- [x] SDK generation (TypeScript, Python) — openapi-typescript + openapi-fetch TS SDK, openapi-python-client Python SDK, generation script + CI drift check — (architecture doc Track 2; done 2026-02-27)
- [x] API documentation — Zod descriptions, oRPC metadata, GraphQL Pothos descriptions, Scalar UI, export scripts — (architecture doc Track 2; done 2026-02-19)

### Design Decisions

- [x] Submitter role architecture: per-org role assignment vs global identity with per-org role bindings — **Resolved 2026-02-19:** Submitter is a global user capability, not an org role. Staff roles (`ADMIN/EDITOR/READER`) unchanged. Manuscript library is user-owned and cross-org. Follow/subscribe for org-to-writer comms. — (architecture doc Open Question #1)
- [x] Self-serve org creation: managed hosting provisioning model vs self-hosted admin — **Partially resolved 2026-02-19:** Self-serve in both contexts. Managed hosting: free tier with quotas, paid upgrade, all features on all tiers. Self-hosted: no billing. Managed hosting infra deferred to post-Track 3. — (architecture doc Open Question #2)

---

## Track 3 — Hopper (Submission Management)

### Code

- [x] Form builder backend — DB schema (form_definitions + form_fields), Zod types, service layer, tRPC + REST + GraphQL endpoints, validateFormData, audit constants, API key scopes — (architecture doc Track 3; done 2026-02-20)
- [x] Form builder frontend — editor UI for creating/editing form definitions, field drag-and-drop, field config panels — (architecture doc Track 3, form-builder-research.md; done 2026-02-20)
- [x] Form renderer for submitters — render published forms in submission flow — (architecture doc Track 3, form-builder-research.md; done 2026-02-20)
- [x] Form builder integration — wire validateFormData into submission create/update flow, formData persistence + validation on submit — (architecture doc Track 3, deferred from backend PR 2026-02-20; done 2026-02-20)
- [x] Add `formDefinitionId` to `createSubmissionPeriodSchema` — done 2026-02-21 as part of submission periods UI PR
- [x] [P2] GraphQL resolvers: add `idParamSchema` validation on all raw string ID args passed to services — forms (query + field mutations), submissions (query + history), audit (query) — (Codex plan review 2026-02-20; done 2026-02-21)
- [x] Conditional logic engine — (architecture doc Track 3, form-builder-research.md; done 2026-02-21)
- [x] Form branching logic PR 1 — schema, evaluation engine, all API surfaces, form builder UI, renderer; single-page branching complete — (roadmap idea 2026-02-21; done 2026-02-21)
- [x] Form branching logic PR 2 — multi-page wizard renderer, per-page validation, page navigation with branching rules, stepper UI — (roadmap idea 2026-02-21; done 2026-02-21)
- [x] Embeddable forms (iframe) — PR 1 backend foundation done 2026-02-22; PR 2 file uploads done 2026-02-22; PR 3 frontend widget done 2026-02-22 — (architecture doc Track 3, form-builder-research.md)
- [x] Submission periods UI — schema exists, no UI — (DEVLOG 2026-02-15; done 2026-02-21)
- [x] Submission periods: REST oRPC router + GraphQL resolvers for parity with forms/submissions — (DEVLOG 2026-02-21, deferred from submission periods PR; done 2026-02-21)
- [x] Editor dashboard rewrite (`/editor` pages) — submission queue + detail view reuse — (DEVLOG 2026-02-15; done 2026-02-21)
- [x] Fix stale cache after submit: `submission-form.tsx` `submitMutation.onSuccess` does `router.push` but doesn't invalidate `getById` query — detail page shows stale DRAFT status — (DEVLOG 2026-02-18, E2E test run; done 2026-02-19)
- [x] Manuscript entity — separate manuscripts (with versions) from submissions; creators maintain a manuscript library and attach manuscripts to submissions rather than uploading per-submission. Enables one-click withdraw-on-accept across all pending submissions of the same manuscript — (roadmap idea 2026-02-19; backend done 2026-02-22)
- [x] Manuscript entity frontend — manuscript library UI, submission form refactor to use manuscript versions instead of direct file upload — (DEVLOG 2026-02-22, PR 2 follow-up; done 2026-02-22)
- [x] GDPR deletion mutation — stubbed with TODO — (DEVLOG 2026-02-15; done 2026-02-23)
- [x] GDPR tools finalization from MVP — (architecture doc Track 3; done 2026-02-23)
- [x] Org deletion — needs careful cascade handling — (DEVLOG 2026-02-13; done 2026-02-23)
- [x] [P3] Form editor: debounce or batch field add/update API calls to avoid 429 rate limiting on rapid edits — (manual QA 2026-02-20; done 2026-02-23 — arrow-button reorder debounced at 300ms)
- [x] Form selector UI in submission creation — submitters need a way to select a published form when creating a submission (currently requires DB linkage) — (manual QA 2026-02-20; done 2026-02-20)
- [x] [P2] E2E Playwright tests for embed form flow — 10 tests (8 core + 2 wizard), CI job added — (DEVLOG 2026-02-22, embed widget session; done 2026-02-22)
- [x] [P2] Manual QA of embed form widget — test iframe embedding on third-party page, identity step, form filling (flat + wizard), file uploads with scan status, error states, theme inheritance — (backlog 2026-02-23; done 2026-02-23 — found + fixed CORS + dark mode bugs)
- [x] [P3] Embed form genre validation: show human-readable labels instead of raw enum values — (manual QA 2026-02-23; done 2026-02-23)
- [x] [P2] Migration 0015 production reliability — `db:verify` / `db:verify:repair` scripts check `information_schema` for FK constraint drift and auto-repair; integrated into `db:reset` — (GDPR manual QA 2026-02-23; done 2026-02-23)
- [x] [P2] Status token expiry: add `status_token_expires_at` column, enforce TTL in `verify_status_token()`, rotate on resubmission — (audit finding #2, 2026-03-01; done 2026-03-01 PR #225)
- [x] [P2] Unbounded aging/reminder queries: cap `getAgingSubmissions()` and `listAgingByOrg()` with LIMIT, paginate analytics, summarize reminder emails — (audit finding #3, 2026-03-01; done 2026-03-01 PR #225)

---

## Track 4 — Slate (Publication Pipeline)

### Code

- [x] Post-acceptance workflow — pipeline-workflow Inngest function with waitForEvent — (architecture doc Track 4; done 2026-02-23 PR pending)
- [x] Copyedit/proofread stages — PipelineStage enum + transition state machine + pipeline service — (architecture doc Track 4; done 2026-02-23 PR pending)
- [x] Contract generation + e-signature — contract templates with merge fields, Documenso adapter + webhook — (architecture doc Track 4, decision 2026-02-15; done 2026-02-23 PR pending)
- [x] Issue assembly — issues, sections, items with reorder + TOC generation — (architecture doc Track 4; done 2026-02-23 PR pending)
- [x] CMS integration (WordPress, Ghost) — CmsAdapter interface, WordPress REST API + Ghost Admin API implementations — (architecture doc Track 4; done 2026-02-23 PR pending)
- [x] Editorial calendar frontend — (architecture doc Track 4; done 2026-02-23 PR pending)
- [x] Slate frontend PR1 — sidebar navigation + publications CRUD — (architecture doc Track 4; done 2026-02-23)
- [x] Slate frontend PR2 — pipeline dashboard (list/detail/transitions/comments/history/roles) — (architecture doc Track 4; done 2026-02-23)
- [x] Slate frontend PR3 — issues + sections (CRUD, item assignment, DnD reordering) — (architecture doc Track 4; done 2026-02-23)
- [x] Slate frontend PR4 — editorial calendar — (architecture doc Track 4; done 2026-02-23 PR pending)
- [x] Slate frontend PR5 — contracts + templates (Tiptap WYSIWYG + merge fields) — (architecture doc Track 4; done 2026-02-24 PR pending)
- [x] Slate frontend PR6 — CMS connections (CRUD, adapter config, test) — (architecture doc Track 4; done 2026-02-24)
- [x] [P2] Redact CMS credentials from audit logs — `updateWithAudit` writes raw `config` (including passwords) to audit table; needs field-level redaction before `newValue` storage — (Codex review 2026-02-24; done 2026-02-24)
- [x] [P2] Add audit logging for `testConnection` — sensitive operation using stored credentials, currently not audit-logged — (Codex review 2026-02-24; done 2026-02-24)
- [x] Slate E2E tests — Playwright tests for pipeline flows (30 tests, 5 spec files) — (architecture doc Track 4; done 2026-02-24)

### Research / Design

- [x] Workflow orchestration evaluation: Inngest (preferred) vs Temporal — **Resolved:** Inngest chosen — step functions, waitForEvent, single Docker container — (decision 2026-02-15; resolved 2026-02-23)
- [x] CMS "starter home" scope: static pages vs blog-like vs magazine-format with issue structure — **Resolved:** Integration-only for v2.0 (WordPress/Ghost adapters), defer built-in pages — (architecture doc Open Question #4; resolved 2026-02-23)

---

## Track 5 — Register (Identity & Federation)

### Code

- [x] Discovery: WebFinger + `.well-known` endpoints — (architecture doc Track 5; done 2026-02-24)
- [x] Identity: `did:web` DID document resolution — per-user Ed25519 keypairs, native crypto (no jose needed) — (architecture doc Track 5; done 2026-02-24)
- [x] [P2] Split `getOrInitConfig()` to separate public-key-only read from private-key read — reduces private key exposure surface — (Codex review 2026-02-24, deferred to Phase 3; done 2026-02-25)
- [x] [P3] Key rotation mechanism for user keypairs — (architecture doc Track 5, deferred to Phase 7; done 2026-02-25)
- [x] [P2] Inbound metadata fetch hardening — SSRF protection, domain mismatch, size limits, shared `fetchAndValidateMetadata()` helper — (Codex review 2026-02-24, deferred to Phase 3; done 2026-02-25)
- [x] Trust establishment — bilateral trust with HTTP signatures, trust service, public S2S + admin routes — (architecture doc Track 5; done 2026-02-24)
- [x] [P2] Federation signature verification middleware — protect all federation endpoints with signature-based auth — (DEVLOG 2026-02-24, done 2026-02-24)
- [x] Sim-sub enforcement (BSAP) — fingerprint service, sim-sub service (local+remote check), S2S endpoint, admin routes, submission flow integration, all 3 API surfaces — (architecture doc Track 5; done 2026-02-24)
- [x] [P3] Sim-sub manual verification — test with two running instances: submit to no-sim-sub period, submit same manuscript to second org, verify CONFLICT; test admin override flow — (DEVLOG 2026-02-24; done 2026-02-26)
- [x] Piece transfer — cross-instance submission transfer with JWT tokens, dual-scope S2S routes, file proxy — (architecture doc Track 5; done 2026-02-25)
- [x] [P3] Piece transfer: upgrade fire-and-forget file fetch to BullMQ for retry/dead-letter — (DEVLOG 2026-02-25, v1 acceptable; done 2026-02-25)
- [x] Identity migration — (architecture doc Track 5; done 2026-02-25)
- [x] Hub for managed hosting — (architecture doc Track 5; done 2026-02-25)
- [x] Per-peer federation rate limiting — sliding window plugin on all S2S routes — (plan B1; done 2026-02-25)
- [x] Enum cleanup — varchar→pgEnum for identity migration direction, hub instance status, trust initiator — (plan C1; done 2026-02-25)
- [x] Open mode auto-accept for inbound trust — (plan C2; done 2026-02-25)
- [x] Inbound transfer tracking table with status lifecycle — (plan C4; done 2026-02-25)
- [x] [P3] Per-capability rate limiting — rate limit per federation capability (simsub, transfer, etc.) rather than global per-peer — (OpenCode review 2026-02-25, deferred to production hardening; done 2026-02-26)
- [x] [P3] Migration rollback testing — enum casts can fail on dirty data; add rollback scenario tests before production deployment — (OpenCode review 2026-02-25, deferred pre-launch; done 2026-02-26)
- [x] [P4] Consider splitting schema migrations (enum changes vs new tables) for safer production rollback — documented as pattern + pre-flight validator instead of splitting 0031 (already applied) — (OpenCode review 2026-02-25, deferred pre-launch; done 2026-02-26)
- [x] [P3] Federation rate limit fail mode: configurable fail-open/fail-closed + in-process fallback when Redis unavailable — (audit finding #4, 2026-03-01; done 2026-03-01 PR #225)
- [x] [P3] Federation test gaps: integration tests for trust handshake flow and hub-first discovery path — (audit finding #5, 2026-03-01; done 2026-03-01 PR #225)
- [x] [P3] Unbounded peer query in migration broadcast — migration.service.ts:870 fetches all trusted peers with no LIMIT; small dataset in practice but violates pagination rule — (Codex review 2026-03-03; done 2026-03-04)
- [x] [P3] Trust metadata SSRF uses custom resolveAndCheckPrivateIp instead of validateOutboundUrl — trust.service.ts:88; functionally equivalent but inconsistent with the standard pattern — (Codex review 2026-03-03; done 2026-03-04)

### Design Decisions

- [x] Data model for federation: what data crosses instance boundaries, governance — (architecture doc Open Question #3) — **Resolved:** Identity (DID-based), content fingerprints (SHA-256), submission metadata (title/cover letter), and files cross boundaries. Governed per-instance by admin-controlled trust (allowlist/open/managed_hub modes). See PRs #180-#184.

---

## Track 6 — Colophony Plugins

### Phase 1-2 (v2 launch)

- [x] `@colophony/plugin-sdk` with adapter interfaces (Email, Payment, Storage, Search, Auth, Newsletter) — (plugin research Section 11; done 2026-02-26)
- [x] Built-in adapters: SMTP, Stripe, S3 — refactor existing to implement SDK interfaces (plugin research Section 11; done 2026-02-26 PR2)
- [x] `colophony.config.ts` plugin loader — wire `loadConfig()` into `main.ts` (plugin research Section 11; done 2026-02-26 PR2)
- [x] HookEngine with typed hooks for submission lifecycle — 14 hooks (11 action + 3 filter) (plugin research Section 11; done 2026-02-26)
- [x] Webhook delivery via BullMQ with retry + dead letter queue — (plugin research Section 11; done 2026-02-26 as Relay webhook system)
- [x] Webhook configuration UI — (plugin research Section 11; done 2026-02-26 as Relay webhook admin pages)

### Phase 3-4 (v2.1-v2.2)

- [x] UI contribution point system (dashboard widgets, settings pages, submission detail sections) — (plugin research Section 11; done 2026-02-26 PR3)
- [x] In-app Plugin Gallery (JSON registry, browse + install instructions) — (plugin research Section 11; done 2026-02-26 PR4)
- [x] `@colophony/create-plugin` scaffolding CLI — (plugin research Section 11; done 2026-02-26)
- [x] Evaluate n8n / Activepieces as recommended external automation target — **Resolved:** Recommend n8n (no privileged container, mature webhooks, 5800+ nodes); Activepieces as MIT-licensed alternative. Deliverables (docs, custom n8n node, Docker profile) deferred post-v2.0. See `docs/research/automation-platform-evaluation.md` — (decision 2026-02-15; resolved 2026-02-26)

### Phase 5-6 (v2.3+)

- [ ] `n8n-nodes-colophony` custom node — API credential type, webhook triggers for Tier 0 events, common API actions — (automation eval 2026-02-26)
- [ ] Docker Compose `--profile automation` — n8n sidecar on internal network, pre-configured webhook URL — (automation eval 2026-02-26)
- [ ] "Automation with n8n" documentation — sidecar setup, webhook config, example workflows, Activepieces alternative note — (automation eval 2026-02-26)
- [ ] Plugin signing via npm trusted publishing + Sigstore Cosign — (plugin research Section 6, decision 2026-02-15)
- [ ] OPA load-time permission policy for managed hosting — (plugin research Section 6, decision 2026-02-15)
- [ ] Frontend sandboxing for community UI plugins — (plugin research Section 11)
- [ ] Managed hosting plugin allow-list — (plugin research Section 11)
- [ ] Full marketplace website with ratings, reviews, compatibility matrix — (plugin research Section 11)

### Design Decisions

- [x] Plugin configuration storage: env vars only per-deployment for v2.0; per-org DB deferred to managed-hosting milestone — (plugin research Open Question #1; resolved 2026-02-26)
- [x] Hot-reload in production: restart required for v2.0; `destroy()` lifecycle exists for future support — (plugin research Open Question #2; resolved 2026-02-26)
- [x] Plugin marketplace governance: define criteria spec now, defer enforcement to v2.3+ — (plugin research Open Question #3; resolved 2026-02-26)
- [x] Database access for Tier 4 plugins: plugin data namespace (`ctx.store`) + read-only service API for v2.0 — (plugin research Open Question #4; resolved 2026-02-26)
- [x] Frontend plugin bundling: build-time only for v2.0; runtime loading deferred to v2.3+ — (plugin research Open Question #5; resolved 2026-02-26)
- [x] Webhook vs event bus for Tier 0: webhooks only for v2.0; pub/sub deferred post-launch — (plugin research Open Question #6; resolved 2026-02-26)

---

## Cross-Cutting — Relay (Notifications & Communications)

- [x] Email templates + provider integration (SMTP + SendGrid) — adapters, MJML templates, BullMQ queue/worker, notification preferences, Inngest functions — (architecture doc, Relay; done 2026-02-26)
- [x] Notification preferences frontend — UI for users to manage email opt-in/opt-out per event type — (DEVLOG 2026-02-26; done 2026-02-26)
- [x] Webhook delivery system (outbound) — (architecture doc, Relay; done 2026-02-26)
- [x] In-app notification center — SSE + Redis pub/sub + bell UI + dual-channel preferences — (architecture doc, Relay; done 2026-02-26)
- [x] [P2] Defense-in-depth org filtering missing in webhook.service.ts — getEndpoint, listEndpoints, rotateSecret query by ID only (RLS-only, no explicit organizationId filter) — (Codex review 2026-03-03; done 2026-03-04)

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

- [x] nodemailer 7 → 8 — already at v8.0.1; bumped @types/nodemailer 7.0.9 → 7.0.11 — (dependabot #77; done 2026-02-26)

### Upgrade order notes

- **Node 22** can be done independently — update `.nvmrc`, engines fields, CI matrix, test
- **Next 16 + React 19** must move together; eslint-config-next follows
- **Zod 4** should happen before or alongside **tRPC 11** since tRPC's Zod error behavior is the pin reason
- **TanStack Query 5** is independent but touches the same web app files as React 19

---

## Code Quality

### File Size & Complexity

- [x] Add soft 500-line guideline to CLAUDE.md — flag files over 500 lines for review during `/codex-review`; not a hard gate, just a review trigger — (dev workflow session 2026-02-20; done 2026-02-20)
- [x] Extract `validateFormData` and per-type validators from `form.service.ts` (912 lines) into `form-validation.service.ts` — natural seam between CRUD operations and validation logic — (dev workflow session 2026-02-20; done 2026-02-20)

### Defense-in-Depth (Codex Review Findings 2026-03-03)

- [x] [Critical] `submission_discussions` missing `FORCE ROW LEVEL SECURITY` — `packages/db/migrations/0041_submission_discussions.sql` enables RLS but does not force it — (Codex review 2026-03-03; done 2026-03-03 migration 0050)
- [x] [P2] Defense-in-depth: transfer service org-scoped methods missing explicit `organizationId` predicate — `apps/api/src/services/transfer.service.ts:347,361,382,423` — (Codex review 2026-03-03; done 2026-03-03)
- [x] [P2] Unbounded query: transfer listing by submission has no pagination/limit — `apps/api/src/services/transfer.service.ts:339` — (Codex review 2026-03-03; done 2026-03-03)
- [x] [P2] Migration token verification unused `_submissionId` parameter (missing binding check) — `apps/api/src/services/migration.service.ts:958` — (Codex review 2026-03-03; done 2026-03-03)
- [x] [P2] Unbounded query: migration pending approvals — `apps/api/src/services/migration.service.ts:1119` — (Codex review 2026-03-03; done 2026-03-03)
- [x] [P2] Defense-in-depth: sim-sub peer query lacks explicit `organizationId` filter — `apps/api/src/services/simsub.service.ts:403` — (Codex review 2026-03-03; done 2026-03-03)
- [x] [P3] Notification preferences list has no `LIMIT` — `apps/api/src/services/notification-preference.service.ts:71` — (Codex review 2026-03-03; done 2026-03-03)
- [x] [P3] Defense-in-depth: pipeline service query methods missing explicit `organizationId` filter — `apps/api/src/services/pipeline.service.ts:113,196,500,512` — (Codex plan review 2026-03-03, deferred from READER role PR)

### Dev Workflow

- [x] Structured session handoff doc (`session-handoff.md`, gitignored) — `/end-session` writes machine-readable state (branch, status, files touched, decisions made, open questions, next action) alongside DEVLOG narrative; `/start-session` reads handoff first for instant context restoration, falls back to DEVLOG if missing. DEVLOG becomes purely archival/human-readable — (dev workflow session 2026-02-20; done 2026-02-20)
- [x] Add decision-surfacing step to plan mode — after exploring code but before writing the plan, explicitly enumerate architectural gray areas and present them with a recommended path and rationale; get user preferences before committing to an approach. Still recommend, just surface the choice — (dev workflow session 2026-02-20; done 2026-02-20)
- [x] Integrate Codex plan review into plan mode — run `/codex-review plan` automatically after writing the plan but before ExitPlanMode; adjust plan based on findings, note changes and dismissals with rationale; user sees a Codex-vetted plan at approval time instead of reviewing then manually triggering Codex — (dev workflow session 2026-02-20; done 2026-02-20)
- [x] Increase plan specificity standard — plans should include exact file paths, concrete type/prop names, and named test cases with setup and assertions where feasible; specific enough to mechanically verify post-implementation. Update plan mode instructions in CLAUDE.md — (dev workflow session 2026-02-20; done 2026-02-20)
- [x] Plan drift detection — after implementation, verify that the delivered code matches the approved plan. Check that specified files exist, export expected symbols, and follow specified patterns. Run as part of `/codex-review branch` or as a standalone `/plan-drift` skill — (dev workflow session 2026-02-20; done 2026-02-20)
- [x] Plan override log for drift detection — during implementation, when discoveries require deliberate divergence from the plan, log overrides with rationale (file, what changed, why) in a structured format (e.g., task list metadata or a plan-overrides section in the PR). Drift detection reads the override log and excludes acknowledged divergences, only flagging unlogged drift — (dev workflow session 2026-02-20; done 2026-02-20)
- [x] Automatic Codex branch review before PR — run `/codex-review branch` automatically after implementation is complete (all tasks done, tests passing) but before creating the PR; incorporate findings before presenting the PR for user review. Mirrors the plan review integration: user sees a Codex-vetted PR, not a raw first draft — (dev workflow session 2026-02-20; done 2026-02-20)

### Test Coverage Improvement

- [x] [P0] Security invariant tests — SSRF validation, defense-in-depth, pagination bounds (20 tests) — (DEVLOG 2026-03-02; done 2026-03-02)
- [x] [P0] Service integration tests — submission, form-validation, org, portfolio, CSR, contract (63 tests) — (DEVLOG 2026-03-02; done 2026-03-02)
- [x] [P0] Documenso webhook integration tests (10 tests) — (DEVLOG 2026-03-02; done 2026-03-02)
- [x] [P0] Writer Workspace E2E — dashboard, external submissions, portfolio, CSR import (21 Playwright tests) — (DEVLOG 2026-03-02; done 2026-03-02)
- [x] [P1] Queue/worker integration tests — email, webhook, file-scan workers with real Redis (~19 tests) — (test coverage plan 2026-03-02; done 2026-03-03)
- [x] [P1] Form builder E2E — create form, add fields, configure, submit through it (~16 Playwright tests) — (test coverage plan 2026-03-02; done 2026-03-03)
- [x] [P1] Organization & settings E2E — org management, member management (~14 Playwright tests) — (test coverage plan 2026-03-02; done 2026-03-03)
- [x] [P1] Submission analytics E2E — dashboard, charts, date range filter (~6 Playwright tests) — (test coverage plan 2026-03-02; done 2026-03-03)
- [x] [P2] Federation admin E2E — peer management, sim-sub, transfers, audit log (~16 Playwright tests) — (test coverage plan 2026-03-02; done 2026-03-03)
- [x] [P2] Federation S2S integration tests — simsub, transfer, migration (15 tests) — (test coverage plan 2026-03-02; done 2026-03-03)
- [x] [P2] Notification prefs + writer analytics E2E (7 tests) — (test coverage plan 2026-03-02; done 2026-03-03)
- [x] CI: Add service-integration-tests, security-tests jobs — (test coverage plan 2026-03-02; done 2026-03-03)
- [x] [P2] Fix flaky workspace analytics E2E — `workspace-analytics-correspondence.spec.ts` "Total Submissions" card times out intermittently (10s timeout); reproduces on both `main` and feature branches; likely slow tRPC query or rendering delay in CI — (CI flake 2026-03-03; resolved 2026-03-04)

### Testing Infrastructure Hardening

- [x] [P1] Console error/warn as test failures — add `vi.spyOn(console, 'error')` / `jest.spyOn(console, 'error')` in global setup files with `afterEach` assertions; allowlist intentional warnings; fix `act(...)` warnings in web tests and Vitest mock warnings — (Codex feedback 2026-03-03; done 2026-03-03)
- [x] [P2] Add `test:cov` scripts to all packages — add `--coverage` with lcov.info + JSON output to api, web, api-client, auth-client, create-plugin, plugin-sdk, types; collect coverage artifacts in CI — (Codex feedback 2026-03-03; done 2026-03-03)
- [x] [P2] Per-package coverage gates — add `coverageThreshold` in `apps/web/jest.config.ts` and Vitest thresholds in `apps/api/vitest.config.ts`; measure current coverage first, set floors at current minus 5% buffer, ratchet up monthly — (Codex feedback 2026-03-03; done 2026-03-03)
- [x] [P2] Changed-code coverage guardrails — enforce minimum coverage on changed files/lines in PRs (e.g., `diff-cover` or Codecov PR checks); prevents new low-coverage hotspots while legacy gaps burn down gradually — (Codex feedback 2026-03-03; done 2026-03-03 diff-cover 80% threshold)
- [x] [P3] Flakiness and determinism CI checks — run unit tests with retries disabled and `--sequence.shuffle` on at least one CI lane; add quarantine convention (`.flaky.test.ts` suffix or skip marker) and fail PRs that introduce new flaky markers — (Codex feedback 2026-03-03; done 2026-03-04)
- [x] [P3] Risk-based test matrix — audit coverage per domain (pipeline, federation, workspace, forms) and document minimum test layers per domain (unit + service integration + API route + E2E happy path) in `docs/testing.md`; identify high-risk low-coverage hotspots — (Codex feedback 2026-03-03; done 2026-03-04)
- [ ] [P3] ESLint 9 → 10 upgrade — blocked by `eslint-plugin-react`, `eslint-plugin-react-hooks`, `eslint-plugin-jsx-a11y` (transitive via `eslint-config-next`); Dependabot canary will signal when unblocked; tracking issue #273 — (2026-03-16)
- [ ] [P3] Skill update: /codex-review should auto-add actionable out-of-scope findings to backlog — during both plan review and branch/diff review, any Important+ findings outside the current task scope should be appended to docs/backlog.md automatically — (workflow improvement 2026-03-03)
- [ ] [P4] Ephemeral DB/queue per test worker — standardize `TestContext` factory for isolated schemas per worker; replace ad-hoc Redis db 1 patching in `vitest-setup.ts`; add explicit contract tests around external boundaries (webhooks, auth, adapters) with fixture replay — (Codex feedback 2026-03-03)
- [x] [P4] Manual QA tracking — establish lightweight QA log (structured markdown or checklist) for pre-release smoke tests, exploratory testing sessions, and regression checks; track what was tested, time spent, and issues found — (Codex feedback 2026-03-03; done 2026-03-03)

### CI

- [x] [P2] CI path filtering for Playwright suites — skip irrelevant E2E suites on PRs based on changed files; `.github/scripts/detect-changes.sh` with fail-open strategy — (DEVLOG 2026-02-24; done 2026-02-24)

### Dev Environment

- [x] [P1] Add Overmind as process manager for dev servers — replaces `turbo run dev` for persistent server lifecycle (API + web); Turbo stays for build graph. Overmind manages tmux session so killing it kills entire process group — eliminates orphaned `tsx watch` / `next-server` / `postcss` processes that accumulate across sessions. Turbo's SIGINT forwarding is a known open issue (#9666, #9694). — (manual QA session 2026-02-21, found 60 orphaned processes; done 2026-02-21)
- [x] [P2] Add `dev:clean` script — kill processes on ports 4000/3000, remove stale lock files (`apps/web/.next/dev/lock`). Fallback for when Overmind isn't running or crashes. Add as `pnpm dev:clean` in root package.json. — (manual QA session 2026-02-21; done 2026-02-21)
- [x] [P2] Simplify Docker profile handling — wrapper script or Makefile target that always includes `--profile auth` for Zitadel. Current setup requires remembering `docker compose --profile auth up -d zitadel` separately from `docker compose up -d`. — (manual QA session 2026-02-21; done 2026-02-21)
- [x] [P3] Docker Compose staging override — `docker-compose.staging.yml` with built API/web production images alongside shared infra services. For local staging testing and future deployed staging. Do NOT use `docker compose watch` for Next.js (Turbopack hot-reload bug, docker/compose#12827). — (manual QA session 2026-02-21; done 2026-02-26)
- [x] [P2] Zitadel dev setup automation — `pnpm zitadel:setup` provisions Zitadel and patches .env files after volume wipe — (manual QA friction 2026-02-24; done 2026-02-24)
- [x] [P2] Stale org context recovery — `useOrganization` detects stale localStorage org ID and auto-switches — (manual QA friction 2026-02-24; done 2026-02-24)
- [x] [P2] Slate seed data — publications, pipeline items, issues, contracts, CMS connections in `db:seed` — (manual QA friction 2026-02-24; done 2026-02-24)

### QA Observations

- [x] [P2] Submission detail page: display custom form field data — `/submissions/[id]` detail view only shows Title, Content, and History. Custom form fields (Category, Word Count, Bio from form definitions) are not rendered. Form data is persisted and visible on edit page but not on read-only detail view. — (manual QA 2026-02-21, conditional logic testing; done 2026-02-21)
- [x] [P3] Submissions list stale cache after create — after creating a new submission via "Create Draft", navigating to My Submissions shows "No submissions" until page reload. Likely TanStack Query cache not invalidated on create mutation success. Submission does exist (API returned 200, detail page loads). — (manual QA 2026-02-21, conditional logic testing; done 2026-02-21)

---

## Track 7 — Editorial Experience (Pre-Launch)

> **Status:** Complete. All P0-P3 items shipped.

### Correspondence & Communication

- [x] [P0] Editor-to-writer personalized correspondence — compose and send messages to individual submitters from the submission detail view; editor comments on status transitions included in notification emails — (persona gap analysis 2026-02-27; done 2026-02-27 PR pending)
- [x] [P0] Customizable email templates — admin UI for editing MJML templates per org (acceptance, rejection, under review, custom); replace hardcoded boilerplate with org-branded voice — (persona gap analysis 2026-02-27; done 2026-02-27 PR pending)
- [x] [P1] "Revise and resubmit" status — add R&R to SubmissionStatus enum + transition map; editor sends revision notes, writer resubmits against the same submission record — (persona gap analysis 2026-02-27; done 2026-02-27 PR pending)
- [x] [P2] Embed submitter confirmation email — send a receipt email to the address provided in the embed identity step; include submission title, journal name, and a status-check token/link — (persona gap analysis 2026-02-27; done 2026-02-28)
- [x] [P2] Embed submitter status check — public page at `/embed/status/:token` where embed submitters (no account) can check their submission status — (persona gap analysis 2026-02-27; done 2026-02-28)
- [x] [P3] Embed status check: handle 410 Gone for expired tokens — show user-friendly "token expired" message in `embed-status-check.tsx` — (audit remediation P2/P3, 2026-03-01; done 2026-03-01)
- [ ] [P3] Status token rotation on R&R resubmission — generate new token when embed submitter resubmits after revise-and-resubmit; no resubmit flow in embed service yet — (audit remediation P2/P3, 2026-03-01)

### Editorial Workflow

- [x] [P1] Reviewer assignment per submission — assign one or more org members as readers on a submission; track who has read it; show assignment in submission detail — (persona gap analysis 2026-02-27; done 2026-02-28)
- [x] [P1] Internal discussion threads on submissions — comment system on Hopper submissions (pre-acceptance), separate from the Slate pipeline comments (post-acceptance) — (persona gap analysis 2026-02-27; done 2026-02-28)
- [x] [P2] Voting / scoring on submissions — readers cast votes (accept/reject/maybe + optional score); configurable per org; summary visible to editors making final decisions — (persona gap analysis 2026-02-27; done 2026-02-28)
- [x] [P2] Blind / anonymous review mode — hide submitter identity from reviewers; admin toggle per submission period — (persona gap analysis 2026-02-27; done 2026-02-28)
- [x] [P2] Batch operations — checkbox selection in submission queue; bulk status transitions (reject, move to review); bulk assignment — (persona gap analysis 2026-02-27; done 2026-02-28)
- [x] [P3] Submission reading mode — distraction-free view for reading the submitted work; "next unread" navigation within the queue — (persona gap analysis 2026-02-27; done 2026-02-28)

### Analytics & Reporting

- [x] [P1] Submission analytics dashboard — acceptance rate, response time distribution, submissions per period, funnel (submitted → reviewed → accepted/rejected), aging submissions — (persona gap analysis 2026-02-27, implemented 2026-02-28)
- [x] [P2] Publication data export — CSV/JSON export of all org submissions, with filters (date range, status, period); admin-only — (persona gap analysis 2026-02-27; done 2026-02-28)
- [x] [P3] Response time tracking and reminders — flag submissions pending over N days (configurable); optional email reminder to editors — (persona gap analysis 2026-02-27; done 2026-02-28)

### UI Polish

- [x] [P1] Mobile navigation — hamburger menu or bottom nav for `< md` breakpoints; sidebar is currently `hidden md:flex` with no mobile alternative — (persona gap analysis 2026-02-27; done 2026-02-28)
- [x] [P2] Column sorting in submission queue — sortable by title, submitter, date, status; currently hardcoded `DESC createdAt` — (persona gap analysis 2026-02-27; done 2026-02-28)
- [x] [P2] Submission period filter in editor queue — the API supports `submissionPeriodId` filter but the UI doesn't expose a period dropdown — (persona gap analysis 2026-02-27; done 2026-02-28)
- [x] [P3] Saved filter presets / views — editors can save named filter+sort combos for their queue — (persona gap analysis 2026-02-27; done 2026-02-28)

---

## Track 8 — Register Data Standard & Writer Tools (Pre-Launch)

> **Status:** Complete. All items shipped.

### Data Standard

- [x] [P0] Define CSR Zod schemas in `packages/types/src/csr.ts` — core CSR type hierarchy (Genre, CSRStatus, JournalRef, Correspondence, ExternalSubmission, WriterProfile, create/update schemas); full CSR v1.0 export envelope deferred to export endpoint work — (register-data-standard.md Section 2; done 2026-02-27 PR pending)
- [x] [P0] Genre enum + schema migration — `genre` JSONB column on manuscripts + PrimaryGenre enum + Zod schema; API surface updates deferred — (register-data-standard.md Section 2.4, 4.2; done 2026-02-27 PR pending)
- [x] [P0] Align MigrationBundle with CSR — refactor `MigrationBundle` and `MigrationSubmissionHistory` in `packages/types/src/migration.ts` to use CSR types; fix gaps: derive `decidedAt` from submission_history, fetch `periodName` via JOIN, populate `genre` from manuscript, include `statusHistory` array — (register-data-standard.md Section 4.1; 2026-02-27; done 2026-02-27)
- [x] [P2] MigrationBundle: use last terminal transition for `decidedAt` — current impl uses first; REJECTED→ACCEPTED would reflect rejection date — (code review 2026-02-27; done 2026-02-28)
- [x] [P2] MigrationBundle: Zod-validate genre JSONB from DB — currently cast `as Genre | null` without validation — (code review 2026-02-27; done 2026-02-28)
- [x] [P2] MigrationBundle: add submission count LIMIT/batching for users with thousands of submissions — (code review 2026-02-27; done 2026-02-28)
- [x] [P1] CSR export endpoint — tRPC + REST endpoint for writers to download their full CSR as JSON; aggregates Colophony-native submissions (cross-org), external submissions, correspondence, writer profiles, and manuscripts — (register-data-standard.md Section 2.1; done 2026-03-01)
- [x] [P1] CSR import endpoint — ingest external submission records from JSON with correspondence linking; CSV import with column mapping deferred to writer workspace UI track — (register-data-standard.md Section 3; done 2026-03-01)
- [x] [P2] CSR format documentation — human-readable spec with field descriptions, examples, status mapping table, and extension points; publishable as part of project docs — (register-data-standard.md; 2026-02-27; done 2026-03-01)

### Correspondence Tracking

- [x] [P0] `correspondence` DB table — new table for editor-writer messages linked to submissions; fields: direction (inbound/outbound), channel (email/portal/in_app), body, senderName, senderEmail, isPersonalized flag; RLS scoped to submission owner + org editors; XOR CHECK on submission_id/external_submission_id — (register-data-standard.md Section 2.8, 4.2; done 2026-02-27 PR pending)
- [x] [P1] Auto-capture Colophony correspondence — auto-insert correspondence records on acceptance/rejection notifications + editor messages; captures status transition comments — (register-data-standard.md Section 2.8; done 2026-02-27 PR pending)
- [x] [P2] Manual correspondence logging — writers can paste/enter notable editor messages (personalized rejections, encouragement letters) for external submissions; lightweight form: paste text, mark as personalized, save — (register-data-standard.md Section 2.8; 2026-02-27; done 2026-03-01)
- [x] [P2] Correspondence in CSR export — include all correspondence records in the writer's CSR download, linked to submission records — (register-data-standard.md Section 2.8; done 2026-03-01)

### Writer as Top-Level Entity

- [x] [P0] `external_submissions` DB table — manually-tracked non-Colophony submissions; mirrors CSR SubmissionRecord fields; scoped by `user_id` (not org); linked to `manuscripts` for piece grouping — (register-data-standard.md Section 4.2, 4.3; done 2026-02-27 PR pending)
- [x] [P0] `journal_directory` DB table — local cache of known journals with name, externalUrl, directoryIds (JSONB), optional colophonyDomain; SELECT-only for app_user, writes via superuser pool — (register-data-standard.md Section 4.2; done 2026-02-27 PR pending)
- [x] [P1] `writer_profiles` DB table — external platform links (Chill Subs ID, Submittable ID, etc.) per user; unique on (user_id, platform) — (register-data-standard.md Section 2.2, 4.2; done 2026-02-27 PR pending)
- [x] [P1] Writer workspace UI — new top-level nav section ("My Writing"); dashboard with stats, correspondence archive, sidebar restructure — (register-data-standard.md Section 4.3; done 2026-03-01 PR pending)
- [x] [P1] External submission tracking UI — CRUD with journal autocomplete, status filter, pagination, card grid — (register-data-standard.md Section 3; done 2026-03-01 PR pending)
- [x] [P2] Cross-org submission portfolio — aggregated view: Colophony-native submissions from all orgs + external tracked submissions, unified by piece grouping — (persona gap analysis 2026-02-27; done 2026-03-01)
- [x] [P2] Writer-facing analytics — personal response time stats, submissions pending, acceptance rate, submissions per month; derived from both native and manually-tracked records — (persona gap analysis 2026-02-27; done 2026-03-01)
- [x] [P2] Import flows — Submittable CSV import, Chill Subs import (via directoryIds mapping), generic CSV with column mapping UI — (register-data-standard.md Section 3; done 2026-03-01)
- [x] [P3] Import duplicate detection — opt-in "Check for duplicates" button compares (journalName + sentAt ± 1 day) against existing subs — (DEVLOG 2026-03-01, deferred from import flows PR; done 2026-03-01)

### Design Decisions

- [x] Personal workspace architecture — **Resolved:** Writers as top-level entities. New user-scoped tables (external_submissions, correspondence, writer_profiles, journal_directory) with RLS matching manuscripts pattern. No pseudo-org needed. — (2026-02-27)
- [x] CSR field set — **Resolved:** Layered format (core/extended/identity/metadata) with correspondence as first-class. Genre as structured enum (primary + sub + hybrid). Piece grouping via manuscriptId. See `docs/research/register-data-standard.md` — (2026-02-27)
- [x] External journal identity — **Resolved:** JournalRef type with freetext name (always present) + optional colophonyDomain + optional directoryIds map (keyed by platform: chillsubs, duotrope, etc.). Degrades gracefully from full federation to freetext. — (2026-02-27)
- [x] Genre model — **Resolved:** Structured enum with primary (10 values), freetext sub for subgenres, and hybrid array for cross-genre work. Lives on manuscripts (the work), not submissions (the act of sending). — (2026-02-27)
- [x] Community stats model — **Resolved:** Carried in CSR, distinguished as "community" (aggregated from tracker users, may over-report acceptances) vs. "editor_reported" (journal's own stats, authoritative). Following Chill Subs model. — (2026-02-27)

---

## Track 9 — Governance & Community Readiness (Pre-Launch)

> **Status:** Complete. All governance and community readiness items done.

- [x] [P0] AGPL license boundary documentation — clearly document what is AGPL (Zitadel), what license Colophony uses, obligations for self-hosters, and how the boundary works — (CLAUDE.md security checklist + persona gap analysis 2026-02-27; done 2026-03-02 `docs/licensing.md`)
- [x] [P0] Choose and document Colophony's own license — AGPL-3.0-or-later for core, MIT for SDKs/plugin tooling — (persona gap analysis 2026-02-27; done 2026-03-02 `LICENSE` + `docs/licensing.md`)
- [x] [P1] CONTRIBUTING.md — how to contribute, development setup, PR process, code of conduct reference — (persona gap analysis 2026-02-27; done 2026-03-02)
- [x] [P1] CODE_OF_CONDUCT.md — (persona gap analysis 2026-02-27; done 2026-03-02 Contributor Covenant v3.0)
- [x] [P1] README.md rewrite — project description in brand voice, architecture overview, quick start, screenshots, link to docs — (persona gap analysis 2026-02-27; done 2026-03-02)
- [x] [P2] Governance model documentation — who makes decisions, how contributions are evaluated, roadmap transparency — (persona gap analysis 2026-02-27; done 2026-03-02)
- [x] [P2] Fix deployment docs NestJS reference — deployment guide references NestJS but the system is Fastify — (persona gap analysis 2026-02-27; done 2026-03-02 docs audit)
- [x] [P3] Public instance identity page — human-readable page showing federation status, trust relationships, and governance commitments (the `.well-known/colophony` endpoint is machine-only) — (persona gap analysis 2026-02-27; done 2026-03-02)

---

## Track 10 — Federation Admin UI (Pre-Launch)

> **Status:** Complete. P1 shipped (PR1: trust dashboard + overview). P2/P3 shipped (PR2: remaining 5 sub-pages).

- [x] [P1] Trust management dashboard — list trusted peers with status, capabilities, last-verified; initiate/accept/reject/revoke trust relationships; preview remote instance metadata before trusting — (persona gap analysis 2026-02-27)
- [x] [P1] Federation status overview — current instance mode (allowlist/open/managed_hub), capabilities enabled, instance public key, DID document link — (persona gap analysis 2026-02-27)
- [x] [P2] Sim-sub admin UI — view sim-sub check history per submission, grant overrides, see conflict details — (persona gap analysis 2026-02-27)
- [x] [P2] Transfer management UI — list inbound/outbound transfers, view status, cancel pending — (persona gap analysis 2026-02-27)
- [x] [P2] Migration management UI — list pending migrations, approve/reject outbound, view history — (persona gap analysis 2026-02-27)
- [x] [P3] Hub admin UI (managed hosting only) — list registered instances, suspend/revoke, view attestation status — (persona gap analysis 2026-02-27)
- [x] [P3] Audit log viewer — browse audit events with filters (actor, action, resource, date range) — (persona gap analysis 2026-02-27)

---

## Track 11 — Chill Subs Integration (Post-Launch)

> **Status:** Conceptual. Depends on Track 8 (CSR format) and the Chill Subs relationship timeline. Sequencing: relationship → data format alignment → technical integration.

- [ ] CSR ↔ Chill Subs tracker data mapping — document field-level mapping between CSR format and Chill Subs submission tracker fields (title, journal, date sent, date responded, status, notes, submission method) — (strategy session 2026-02-27)
- [ ] Chill Subs journal directory integration — if Chill Subs exposes a journal API or data feed, use it to populate the external journal identity field in CSR records; writers who track in Chill Subs and submit via Colophony get auto-linked records — (strategy session 2026-02-27)
- [ ] Bidirectional sync protocol — define how a writer's Chill Subs tracker and Colophony submission history stay in sync; CSR as the interchange format — (strategy session 2026-02-27)
- [ ] Partnership scope definition — technical partnership vs. data integration vs. deeper structural relationship; depends on Slushpile (Chill Subs submissions manager) architecture — (strategy session 2026-02-27)

---

## Track 12 — Slate & Pipeline Polish (Post-Launch)

> **Status:** Not started. Quality-of-life improvements for the post-acceptance pipeline.

- [x] [P2] Contract signer auto-population — populate Documenso signers from submission/author data instead of passing `signers: []` — (codebase audit 2026-02-27; done 2026-03-03)
- [x] [P2] Author name in CMS publish payload — `CmsPiecePayload.author` is always `null`; fetch submitter name from user record — (codebase audit 2026-02-27; done 2026-03-03)
- [x] [P2] CMS external ID tracking — store `externalId`/`externalUrl` returned from CMS publish back on the issue/items — (codebase audit 2026-02-27; done 2026-03-03)
- [ ] [P3] Additional CMS adapters — Substack, Contentful, or other targets based on early adopter needs — (codebase audit 2026-02-27)
- [ ] [P3] In-browser copyediting or diff view between manuscript versions — (persona gap analysis 2026-02-27)
- [x] [P3] READER role enforcement — define what READER can and cannot do distinct from EDITOR; currently decorative — (persona gap analysis 2026-02-27; done 2026-03-03)
- [ ] [P3] Email invitation workflow — invite by email link/token instead of requiring pre-existing Zitadel account — (persona gap analysis 2026-02-27)
- [ ] [P3] Custom org roles beyond ADMIN/EDITOR/READER — named roles with configurable permission scopes — (persona gap analysis 2026-02-27)
- [x] [P1] Documenso webhook: defense-in-depth org filter — mutation phase uses `withRls()` on appPool + explicit `orgId` on `updateStatus`; Codex review caught `set_config` on superuser pool doesn't enforce RLS — (Codex review 2026-03-22; done 2026-03-22)
- [x] [P2] Documenso webhook: Zod schema validation — `documensoWebhookPayloadSchema` validates payload structure before processing — (Codex review 2026-03-22; done 2026-03-22)
- [x] [P2] Documenso webhook: audit logging for contract status changes — `CONTRACT_SIGNED` and `CONTRACT_COMPLETED` audit actions logged via `auditService.log()` inside `withRls` — (Codex review 2026-03-22; done 2026-03-22)

---

## Accessibility (Cross-Cutting, Pre-Launch)

- [x] [P2] Status badges: add icons alongside color to support color-blind users — (persona gap analysis 2026-02-27; done 2026-03-02)
- [x] [P2] File drop zones: add keyboard focus handling, `role="button"`, `tabIndex` — (persona gap analysis 2026-02-27; done 2026-03-02)
- [x] [P2] Scan status: add `aria-live` region for screen reader announcements during file scanning — (persona gap analysis 2026-02-27; done 2026-03-02)
- [x] [P2] Sidebar: add `aria-label` to `<nav>` element — (persona gap analysis 2026-02-27; done 2026-03-02)
- [x] [P3] Sim-sub error message: show human-readable explanation ("This manuscript appears to be under consideration at another publication that prohibits simultaneous submissions") instead of generic tRPC error — (persona gap analysis 2026-02-27; done 2026-03-02 via SimSubConflictDisplay graduated confidence component)

---

## Production Deployment Checklist

### Infrastructure Setup

- [x] Coolify + Hetzner managed hosting setup — done 2026-03-20, staging live at staging.colophony.pub — (architecture doc Track 1)
- [x] [P2] Fix tusd port mismatch — tusd listens on 8080, nginx proxies to 1080; add `-port 1080` to tusd command or update nginx upstream — (DEVLOG 2026-03-20, smoke test; done 2026-03-21 PR #292)
- [x] [P2] Fix pre-existing RLS permission failures — `journal_directory` has INSERT/UPDATE/DELETE (should be SELECT only), `audit_events` has direct INSERT + DELETE (should use audit_writer) — (DEVLOG 2026-03-20, staging verify-rls.sh; done 2026-03-21 PR #292)
- [x] [P3] Configure Zitadel webhook for staging — Actions → Targets → user event group → staging endpoint; signature fix + v2 payload adaptation (PRs #293–#297), then automated in `pnpm zitadel:setup` with all 6 user lifecycle events via group execution (PR #299) — (DEVLOG 2026-03-20; done 2026-03-22)
- [ ] [P3] Connect Inngest Cloud to staging — event key + signing key — (DEVLOG 2026-03-20)
- [x] [P3] Coolify IPv6 network bug — `coolify` Docker network gets malformed IPv6 gateway on Hetzner; manual recreate needed after Coolify install — (DEVLOG 2026-03-20; confirmed fixed 2026-03-22)
- [ ] [P3] Investigate webhook rate limit Redis error — every Zitadel webhook request logs "Webhook rate limit Redis error — allowing request"; non-fatal but indicates Redis connection issue for webhook-specific rate limiter — (DEVLOG 2026-03-22)
- [ ] [P3] Coolify proxy restart after redeploy — intermittent gateway timeouts after Coolify redeploys require manual proxy restart; investigate if Traefik config or Coolify bug — (DEVLOG 2026-03-22)
- [x] [P3] `queue-preset.service.ts:49` — `listByUser()` missing explicit `organizationId` filter and LIMIT — (Codex plan review 2026-03-20; done 2026-03-21 PR #292)
- [x] Monitoring stack: Prometheus + Grafana (Sentry for errors) — done 2026-02-27 PR pending; Loki deferred to production

### Database Hardening

- [x] Change `app_user` password from default — (CLAUDE.md; done 2026-03-17 init script validation)
- [x] PostgreSQL SSL/TLS (`DB_SSL` env var) — (CLAUDE.md; done 2026-03-17)
- [x] Connection pooling (PgBouncer) — (CLAUDE.md, PR pending)
- [x] Backups (WAL-G to S3) — done 2026-03-19
- [x] `pg_stat_statements` for query monitoring — (CLAUDE.md; done 2026-03-17)
- [x] Verify RLS in production — done 2026-03-19

### Schema Bugs

- [x] [P2] `userKeys` table has `pgPolicy` definitions but missing `.enableRLS()` — RLS policies defined but not activated. Add `.enableRLS()` + generate migration — (DEVLOG 2026-03-19, RLS verification; done 2026-03-20)

### Security & Compliance

- [x] Rotate credentials quarterly — done 2026-03-19, `scripts/rotate-secrets.sh` + `docs/credential-rotation.md` — (CLAUDE.md)
- [x] AGPL license boundary documented (Zitadel is AGPL) — done 2026-03-02 `docs/licensing.md` — (CLAUDE.md)
- [x] [P2] Verify SSRF protection in `hub-client.service.ts` — `fetch()` calls at lines 38/104/141/199; `validateOutboundUrl` is imported but may not be called before every fetch — (Codex plan review 2026-03-19; done 2026-03-20)
- [x] [P3] Add LIMIT to unbounded queries — `correspondence.service.ts:70`, `submission.service.ts:730`, `file.service.ts:80` — (Codex plan review 2026-03-19; done 2026-03-20)

### Monitoring

- [~] GitHub GraphQL rate limit passive drain (~60 pts/hr) — diagnosed 2026-02-19, likely GitHub-internal (Dependabot, security scanning). At ~1.2% budget/hr, not actionable unless large exhaustion recurs. If so, convert skills from `gh pr list/create` (GraphQL) to `gh api` (REST) — (DEVLOG 2026-02-19)

---

## Simplification & Maintenance Debt

> Items identified during architecture review (2026-03-16). Focused on reducing operational complexity and config drift.

### Codebase Extraction

- [x] [P2] Extract GraphQL surface to feature branch — `src/graphql/` (builder, schema, resolvers, guards, router), Yoga plugin in `main.ts`, GraphQL-specific API key scopes. Service layer and shared types stay. Re-merge when user demand justifies it — (architecture review 2026-03-16; done 2026-03-16)
- [x] [P2] Extract plugin system to feature branch — `packages/plugin-sdk/`, `packages/create-plugin/`, `src/adapters/extensions-accessor.ts`, `src/adapters/plugins-accessor.ts`, `src/services/plugin-registry.service.ts`, `src/plugins/`, `apps/web/src/components/plugins/`, `apps/web/src/lib/plugin-components.ts`, `PLUGIN_REGISTRY_URL` env var. Keep adapter registry and email/storage/payment/CMS adapters — (architecture review 2026-03-16; done 2026-03-16)

### Dev Tooling

- [ ] [P2] Replace Overmind with hivemind or concurrently — Overmind solves signal handling but tmux dependency, `dev:clean` escape hatch, and WSL quirks are operational drag. hivemind (Go binary, no tmux, proper signal handling) preferred; concurrently as fallback. Test on macOS, Linux, WSL before standardizing. Keep `dev:clean` as escape hatch, not normal workflow. Turbo `--watch` only if shutdown behavior verified in this repo — (architecture review 2026-03-16; code changes done 2026-03-16; pending cross-platform validation)
- [x] [P3] Remove `packages/eslint-config` — unused v1 legacy configs (`base.js`, `nextjs.js`, `nestjs.js`), neither app imports from it. Moved `eslint` and `eslint-config-next` to direct app devDependencies — (architecture review 2026-03-16; done 2026-03-16)

### Testing & CI

- [x] [P2] Testing optimization — Python SDK in CI, test/CI contract clarity, Vitest config consolidation, deterministic web test UUIDs, coverage includes specialized suites, webhook CI job, flaky test fix — (architecture review 2026-03-16; done 2026-03-17)
- [x] [P2] E2E selector brittleness — replaced CSS class selectors, parent traversal, positional disambiguation with `data-testid` and dialog-scoped role locators; removed `waitForTimeout` calls; ~20 acceptable `.first()/.last()` uses left unchanged — (done 2026-03-17)
- [x] [P2] Defense-in-depth org filtering — CMS connection service (`getById`, `update`, `delete`, `testConnection`) and issue service (`getById`, `getItems`, `getSections`) do not pass available `orgId` for defense-in-depth WHERE clause; REST/tRPC callers also omit it — (Codex plan review 2026-03-17; done 2026-03-17)
- [x] [P2] RLS infrastructure test coverage — `rls-infrastructure.test.ts` `RLS_TABLES` array missing 23 of 45 RLS tables — added all, unified org-policy assertion — (Codex plan review 2026-03-17; done 2026-03-17)
- [x] [P3] Clean up redundant per-migration GRANTs — `init-db.sh` `ALTER DEFAULT PRIVILEGES` grants full DML to all tables, making per-migration `GRANT SELECT, INSERT, UPDATE` (without DELETE) on `sim_sub_checks`, `trusted_peers`, `inbound_transfers` effectively no-ops — (DEVLOG 2026-03-17; done 2026-03-17)
- [x] [P3] Vitest everywhere — replace Jest in `apps/web` with Vitest to eliminate test runner split (`vi.*` vs `jest.*`), deduplicate mock APIs, coverage configs, and setup patterns — (architecture review 2026-03-16; done 2026-03-17)

### Architecture Boundaries

- [x] [P3] Clarify BullMQ/Inngest boundary — document explicit ownership rule (e.g., "Inngest may emit domain events and schedule orchestration; BullMQ may only execute side-effecting delivery jobs"). Each job type (email, webhooks, file scans, notification fanout) should have a single obvious home. Decide based on failure modes: which system owns retries, idempotency, dead-letter behavior, concurrency limits, and observability — (architecture review 2026-03-16; done 2026-03-17)
