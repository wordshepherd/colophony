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
- [x] Add `Permissions-Policy` header to restrict browser features — (code review 2026-02-15)
- [x] Endpoint-specific `Cache-Control` for authenticated JSON responses — (code review 2026-02-15)
- [x] Wire rate limiting globally on all API surfaces — hook exists in `apps/api/src/hooks/rate-limit.ts`, needs registration on all routes — (security checklist)
- [x] Zitadel OIDC token validation enforced on all protected routes — (security checklist, PR #72)
- [x] API key authentication with scopes — blocks Track 2 REST API — (security checklist, PR pending 2026-02-15)
- [x] Input validation with Zod on all API surfaces — schema tightening + shared-schema consolidation done 2026-02-18; `.output()` validation deferred to PR 2 — (security checklist)
- [x] Storage: block public access via MinIO bucket policy — (security checklist, PR #90)
- [x] Stripe webhook signature verification + idempotency — (security checklist)
- [x] Dedicated `audit_writer` DB role with INSERT-only on `audit_events` — production hardening — (DEVLOG 2026-02-12, 2026-02-13; done 2026-02-17 PR #89)
- [x] In-memory per-IP throttle for auth failure auditing — DoS protection — (DEVLOG 2026-02-12, 2026-02-13; done 2026-02-17 PR #89)
- [x] Restore two-tier rate limiting (AUTH_MAX for authenticated users) via second-pass hook after auth — (DEVLOG 2026-02-15, code review; done 2026-02-17 PR #89)
- [x] Request correlation columns (`requestId`, `method`, `route`) in `audit_events` — requires schema migration — (DEVLOG 2026-02-12, 2026-02-13; done 2026-02-17 PR #89)
- [x] Zitadel webhook two-step idempotency — current one-step pattern doesn't handle crash recovery (row inserted but `processed=false`); align with Stripe webhook's two-step pattern — (code review 2026-02-17; done 2026-02-17)
- [x] Audit query/list endpoints — wait for API surfaces — (DEVLOG 2026-02-13; done 2026-02-18 PR #101)
- [x] Seed data (`packages/db/src/seed.ts` has TODO) — wait for API layer — (code TODO; done 2026-02-18 PR #104)
- [x] [P2] Sliding window rate limiting — replaced fixed-window Lua script with sliding-window-log algorithm using Redis sorted sets; fixes burst-at-boundary 2x rate vulnerability; kept custom two-tier design (IP pre-auth + user post-auth) — (dev feedback 2026-02-25; done 2026-02-25)
- [x] [P2] RLS app connection fallback to superuser — packages/db/src/client.ts appPool falls back to DATABASE_URL when DATABASE_APP_URL is unset; production could silently use superuser credentials — (code review 2026-03-03; done 2026-03-04)

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
- [ ] [P1] Investigate the intermittent `(dashboard)` route-group 404 — **four occurrences, and the fourth has the dev-server log that identifies the mechanism.** A CI run returns a genuine Next.js 404 (`heading "404"` / "This page could not be found." in the page snapshot) for one or more routes under `(dashboard)`, while sibling routes pass in the same run. Occurrences: `/workspace/*` 2026-07-25 (24 tests), `/federation/*` 2026-07-26 (14 of 16), `/submissions/[id]/edit` 2026-07-27 (3 tests, run 30315127919), `/submissions/[id]/edit` again 2026-07-28 (all 6 uploads tests, run 30326525136). Each passed on rerun with byte-identical content — 2026-07-26 failed on `main@35f9ad15` having passed on the PR head `abb2ba7f`, which is the same tree squash-merged.
      **The log answers the question it was added for: cause 1 of the four below — a 404 with no compile activity.** `next-e2e.log` from run 30326525136 shows the server compiling normally for every route that works and never attempting the one that fails:
      `GET / 200 in 4.7s (next.js: 4.0s)` — first hit, compiles.
      `GET /submissions/<id> 200 in 3.2s (next.js: 2.9s)` — first hit, compiles.
      `GET /submissions/<id>/edit 404 in 491ms (next.js: 451ms)` — first hit, **no `Compiling` line emitted**.
      `GET /submissions/<id>/edit 404 in 61ms (next.js: 4ms)` — retry, negative result now cached.
      `Compiling / ...` is the only compile line in the whole 103-line log. So this is not an entry compile that failed — Turbopack never began compiling the route. Next spent 451ms resolving and concluded the route does not exist, then answered subsequent requests in 4ms. **That eliminates entry-compile failure, worker death, and router/manifest disagreement, and leaves route discovery.** The file is present on disk (`apps/web/src/app/(dashboard)/submissions/[id]/edit/page.tsx`) and its sibling `[id]/page.tsx` compiled and served 200 from the same process seconds earlier.
      This occurrence also rules out the branch under test as a cause a second way: the PR touched only `deploy.yml`, `playwright.config.ts`, `e2e/global-setup.ts` and a package script — nothing reachable from Next's routing.
      **The "every route under one child" generalization is falsified.** 2026-07-27 hit a single leaf route: `/submissions/[id]/edit` 404'd on all 3 tests and both retries, while `/submissions` and `/submissions/[id]` passed in the same run against the same server. So the failing unit is an individual route, not the route group or the section — which argues against the `(dashboard)` layout/manifest theory and toward per-route compilation or a route-manifest write race. The earlier two occurrences are consistent with this: a whole section failing is just every leaf in it failing.
      **Correction — "un-compiled-route timing is ruled out" was wrong, and it sent the first two investigations the wrong way.** That claim rested on a 2026-07-25 trace showing the 404 eleven minutes after server start. But E2E runs `next dev --turbo` (`apps/web/package.json`, `playwright.config.ts` webServer[1]), which compiles a route on its **first request**, not on a timer — so time since boot was never the relevant measure. Lazy compilation is now the leading hypothesis, not an excluded one.
      **The 2026-07-27 test order is the evidence.** Tests run sequentially in one server process (`fullyParallel: false`, `workers: 1`). Tests 1–2 hit `/submissions/[id]` and passed; test 3 is the **first request to `/submissions/[id]/edit` in that process's lifetime** and 404'd, as did tests 4–5 on the same route; tests 6–8 went back to the already-compiled detail route and passed. So the route died at its first-compile boundary and stayed dead, while its compiled sibling kept serving in the same process. Leading hypothesis: Turbopack's dev route-discovery/manifest state is poisoned during a route's first compile.
      Ruled out: dependency bumps, missing/gitignored source, `notFound()` calls (none anywhere in `apps/web/src/app/`), a stale `.next` cache (CI caches the pnpm store only), and `reuseExistingServer` (false for web in CI regardless). No shared trait across the three failing routes — an async server component, a `"use client"` page, and a plain server component. The 404 response carries `X-Powered-By: Next.js` with RSC `Vary` headers and no error indicator, i.e. the router matching nothing rather than a 500. Also ruled out for 2026-07-27: the branch's own changes — all 8 tests in that spec pass locally on the same commit.
      **Answered 2026-07-28 — the four causes below are now down to one.** Kept for the reasoning: Next logs one line per request with a compile-time breakdown — the first request to a route is slow (`next.js: 925ms`), later ones are not (`next.js: 24ms`). That separates four causes: a 404 with no compile activity (route discovery/manifest), a compile diagnostic (entry compile failure), an absent or mid-compile-truncated log (worker or process death), and a successful compile followed by a 404 (router and manifest disagreeing). The observed signature is the first.
      **Next step is therefore Turbopack route discovery specifically**, not general instrumentation. Two things worth trying, in order: (1) reproduce outside CI by starting `next dev --turbo` and requesting a never-yet-compiled deep route under a route group as the very first request to that subtree, in a loop — if it reproduces at all locally, the rest is tractable; (2) check whether the failing route is always the first request to a **nested segment below an already-compiled parent** (both 2026-07-27 and 2026-07-28 hit `[id]/edit` after `[id]` had compiled), which would make it a parent-child discovery ordering bug rather than a random one. If it proves a Turbopack defect, the durable fix remains running E2E against `next build` + `next start`.
      Do **not** add a route pre-warming probe as instrumentation — requesting the target routes before a suite compiles them ahead of the tests and masks the failure. If the log points at resource pressure, add `free -h`/`df -h` around the Playwright step. If it proves a Turbopack defect, the durable fix is running E2E against `next build` + `next start`, ideally building once and sharing `.next` across the nine suites via artifact rather than paying nine builds.
      `error-context.md` in the same artifact stays the quick discriminator: a 404 shows the two headings above and fails identically on Playwright's in-process retry, because the route stays 404 for the life of the server. A genuine timeout re-passes. Note the artifact zip needs `python3 -c "import zipfile; ..."` on this box — `unzip` is not installed. — (DEVLOG 2026-07-25, recurred 2026-07-26 and 2026-07-27)
- [x] [P3] Capture the Next dev server's output in the Playwright CI jobs — root cause of the missing output: Playwright's `webServer.stdout` defaults to `"ignore"` and only `stderr` defaults to `"pipe"`, so the six `[WebServer]` lines seen on 2026-07-25 were stderr warnings and everything diagnostic was discarded. Now teed to `apps/web/next-e2e.log` and uploaded with the report artifact in all ten Playwright jobs. — (DEVLOG 2026-07-25; done 2026-07-27 PR #512)

### Housekeeping

- [x] Clean up v1 components (`_v1/` directory) — (DEVLOG 2026-02-15; done 2026-02-17)
- [x] Consider Playwright tsconfig extending web for E2E type-checking — nice-to-have — (DEVLOG 2026-02-15; done 2026-02-26)
- [x] Rewrite `docs/testing.md` for v2 — still references v1 patterns (Prisma, NestJS, old test counts/tiers); Playwright section updated but rest is stale — (DEVLOG 2026-02-18; done 2026-02-18)
- [x] Migrate `forwardRef` → ref-as-prop in 19 shadcn/ui components — React 19 deprecation — (DEVLOG 2026-02-16; done 2026-02-17)
- [x] Migrate `Context.Provider` → `Context` — React 19 deprecation — (DEVLOG 2026-02-16; done 2026-02-17)
- [x] Refactor OIDC guard `setState` in effects to satisfy `react-hooks/set-state-in-effect` — `callback/page.tsx` — (DEVLOG 2026-02-16; done 2026-02-17)
- [ ] Drive `pnpm audit --audit-level=high` to zero so the CI step can become blocking — currently 151 findings (79 high, 2 critical; `--prod` 126/68/2), dominated by transitive advisories via dev tooling such as `brace-expansion` GHSA-mh99-v99m-4gvg through `eslint` (235 paths). The CI step is deliberately `continue-on-error` until then; see the comment in `.github/workflows/ci.yml`. Approach: bump the direct deps that pull the vulnerable transitives, extend `pnpm.overrides` where no upstream fix exists, then add explicit `pnpm.auditConfig.ignoreCves` entries for anything genuinely accepted — (DEVLOG 2026-07-25)
- [ ] Reduce the `apps/api` ESLint rule suppressions — `recommendedTypeChecked` is enabled but `no-explicit-any` and five `no-unsafe-*` rules are switched off, which neutralises most of its value. At minimum promote `no-floating-promises` from `warn` to `error`, since unhandled rejections in Fastify handlers are a production failure mode — (DEVLOG 2026-07-25)
- [ ] Enable `noUncheckedIndexedAccess` in `packages/typescript-config/base.json` — package by package (`types` and `api-contracts` first, then `db`, `api`, `web`) — (DEVLOG 2026-07-25)
- [ ] Add `tseslint.configs.recommendedTypeChecked` to `apps/web/eslint.config.mjs` — the web app is currently unlinted for `no-floating-promises`, `no-misused-promises`, `await-thenable`, and the `no-unsafe-*` family, unlike `apps/api`. Expect a large first-run count; start the noisiest rules at `warn` — (DEVLOG 2026-07-25)
- [ ] [P2] Stop passing `SENTRY_AUTH_TOKEN` as a Docker build ARG — `apps/web/Dockerfile` lines 34–35 take it as `ARG` then promote it to `ENV`. Build ARGs are recorded in image history, so the token is recoverable from any built image; `docker build` warns about this (`SecretsUsedInArgOrEnv`). Use a BuildKit secret mount (`RUN --mount=type=secret,id=sentry_auth_token`) and pass it via `--secret` from the deploy workflow instead — (DEVLOG 2026-07-26)
- [ ] [P3] Spot-check rendered email output after the mjml 5 upgrade — 5.0.0 replaced `html-minifier`/`js-beautify` with `htmlnano` + `cssnano`, so the emitted HTML differs in whitespace and minification from 4.x. Unit tests and the staging smoke suite both pass, which covers the render path but not client rendering; send one templated email and one custom template through the email queue and compare against a 4.x capture — (DEVLOG 2026-07-26b)
- [ ] [P1] No disk alerting, and the monitoring stack cannot report its own host failing.
      Staging filled its 150G disk on 2026-07-27 and nothing warned: all six rules in
      `docker/prometheus/alert-rules.yml` are application-level (error rate, queue depth, DB
      pool, health endpoint, latency, job failures), there is no node-exporter, and no
      filesystem metric is scraped. `HealthEndpointDown` would have been the closest match,
      but Prometheus, Loki and Grafana were themselves in a restart loop from the same full
      disk — the stack is co-located with what it monitors, so it fails exactly when needed.
      Wants node-exporter plus a `DiskSpaceLow` rule, and an external check that does not run
      on the box it watches. — (found 2026-07-27 during the staging outage)
- [ ] [P2] Reconsider `--no-cache` on every deploy build (`deploy.yml` staging and
      production). It guarantees maximum layer churn — each deploy writes a fresh set and
      strands the previous one — which is what filled the staging disk. Pruning now runs
      either side of the build, so this is no longer urgent, but the flag buys little on a
      tree that already changes every deploy and costs a full rebuild each time. Removing it
      changes build semantics, so it wants its own PR. — (found 2026-07-27)
- [ ] [P3] Confirm whether staging is meant to have database backups.
      `walg-entrypoint: WALG_S3_PREFIX not set — backups disabled` appears on every staging
      postgres start. If that is deliberate for staging, note it in `docs/deployment.md`; if
      not, it is a gap that has been silent for months. — (found 2026-07-27)
- [ ] [P3] Seed data ages out of a long-lived dev database, and `db:seed` will not repair it. Submission periods are seeded at fixed offsets from the seed date, so `quarterly-review` eventually has no open period — which fails 11 of 13 `embed` tests with `No open period found`. `pnpm db:seed` is idempotent-by-skip, so it is a no-op once data exists; only the destructive `db:reset` refreshes the dates. CI is unaffected (it seeds fresh each run), so this only ever bites locally, and it looks like a code regression rather than stale data. Either make the seed refresh period dates when they have closed, or have `global-setup.ts` fail with a "run `pnpm db:reset`" message when no open period exists for the seed org — (found 2026-07-27 while verifying the E2E auth rework)

---

## Track 2 — Colophony API

### Code

- [x] Service layer extraction from tRPC routers — PR 1 (foundation) done 2026-02-17 #94; PR 2 (router refactor) done 2026-02-17 — (architecture doc Track 2)
- [x] oRPC REST API surface — PR 1: contracts + organizations (replaces ts-rest; done 2026-02-18) — (architecture doc Track 2)
- [x] oRPC REST API surface — PR 2: submissions, files, users, API keys contracts + OpenAPI spec endpoint — (DEVLOG 2026-02-18; done 2026-02-18)
- [x] oRPC REST API surface — PR 3: typed client package — (DEVLOG 2026-02-18; done 2026-02-18)
- [x] API key scope enforcement on REST + tRPC endpoints — (DEVLOG 2026-02-18, done 2026-02-18)
- [x] API key scope enforcement on GraphQL surface — `requireScopes` guard wired on all 10 query resolvers — (DEVLOG 2026-02-18; done 2026-02-19)
- [x] Stripe webhook: audit raw payload storage for PCI compliance — `stripe.webhook.ts` stores raw event payload in `stripe_webhook_events`; verified: Checkout Session events contain amounts/currency/payment_intent ID/metadata only, never card numbers/CVV/cardholder data. Added PCI note comment. — (code review 2026-02-18; done 2026-02-19)
- [x] Stripe webhook: `resourceId` passed to `insert_audit_event()` is Stripe session ID (`cs_...`), not UUID — fails `::uuid` cast in production. Fixed: removed `resourceId` from audit calls (session ID already in `newValue.stripeSessionId`); updated tests to use realistic `cs_test_` IDs. — (DEVLOG 2026-02-19; done 2026-02-19)
- [x] tRPC `.output()` runtime response validation — all 30 procedures wired with Zod output schemas; 9 new response schemas added — (input validation audit 2026-02-18; done 2026-02-18)
- [x] Pothos + GraphQL Yoga surface — PR 1: foundation (types, queries, DataLoaders, scope enforcement, Fastify integration) done 2026-02-19; PR 2: mutations done 2026-02-19 — (architecture doc Track 2, Section 6.6)
- [x] GraphQL mutations (PR 2) — 16 mutations + API key list query, unit tests (36 new tests) — done 2026-02-19
- [x] SDK generation (TypeScript, Python) — openapi-typescript + openapi-fetch TS SDK, openapi-python-client Python SDK, generation script + CI drift check — (architecture doc Track 2; done 2026-02-27) — **note:** the drift check validates SDK ↔ spec only; see the P0 item below
- [x] API documentation — Zod descriptions, oRPC metadata, GraphQL Pothos descriptions, Scalar UI, export scripts — (architecture doc Track 2; done 2026-02-19)

### Integration surface — findings 2026-07-27

Full analysis and sequencing: [`docs/api-integration-design.md`](api-integration-design.md).
Ordered as the design doc's Phase 0/D.

- [ ] **[P0] tRPC is reachable by API keys, and 10 routers enforce no scopes.** Nothing
      restricts `X-Api-Key` to the REST surface, and `requireScopes` is opt-in per procedure.
      `federation`, `gdpr`, `hub`, `migration`, `notification-preferences`, `notifications`,
      `ops`, `simsub`, `transfer`, `webhooks` called it zero times — so a key scoped
      `manuscripts:read` could call `webhooks.rotateSecret`, `federation.updateConfig`,
      `hub.revokeInstance`, `simsub.grantOverride`. Fix has **two halves, both P0**:
      (1) `internalOnly` middleware as an **allowlist** of interactive auth methods
      (`oidc`/`demo`/`test`), never a denylist of `apikey`, applied to the seven
      deliberately-internal routers — ship log-only first, then enforce; (2) add
      `requireScopes` to every remaining unscoped procedure, since `notifications`,
      `notification-preferences`, and `webhooks` are unscoped but _not_ internal-only.
      Shipping only (1) narrows the bypass rather than closing it. —
      (design doc §0.1(e), §1.6 M1, P0.1/P0.1b/P0.5)
  - [x] **P0.1** — `internalOnly` allowlist + `internalAdminProcedure` /
        `internalAuthedProcedure` applied to all 29 procedures across the seven internal
        routers. Log-only behind `TRPC_INTERNAL_ONLY_ENFORCE` (default `false`), emitting
        `API_KEY_INTERNAL_ROUTE` audit events. — done 2026-07-27
  - [x] **P0.1b** — `requireScopes` on all 16 procedures in `notifications`,
        `notification-preferences`, `webhooks`. New scopes `notifications:read`,
        `notifications:write`, `webhooks:read`; `webhooks:manage` now consumed. Enforcing
        immediately (denials audit as `API_KEY_SCOPE_DENIED`). — done 2026-07-27
  - [x] **P0.4** — guard coverage gate. `apps/api/src/trpc/guard-coverage.spec.ts` reads
        every procedure's middleware chain out of the built `appRouter` and fails on one
        declaring neither `requireScopes(...)` nor an `internal*Procedure` builder.
        Also pins the seven internal routers against a silent downgrade to a plain scope
        guard, rejects vacuous `requireScopes()` (an empty list allows everything), and
        rejects scope strings absent from `apiKeyScopeSchema`. Found and closed three live
        gaps: `embedTokens.create`, `embedTokens.revoke` (`periods:write`) and
        `organizations.invitations.accept` (`organizations:write`). — done 2026-07-27
        **Narrower than design doc §1.6 M4**, which specifies a three-list manifest
        (REST-equivalent / internal-only / deferred) across all 301 procedures. Only the
        mechanical half shipped: M4's argument for a manifest over a heuristic is about
        REST-parity name-matching, which this does not attempt, and seeding a
        "has REST equivalent" list from a spec 36 operations stale would bake in wrong
        data. Per-procedure parity classification moves to P1.1–P1.4.
        **The gate asserted declaration, not denial** — which mattered while the two
        guards differed: `requireScopes` declares and enforces in one step, whereas
        `internalOnly` only declared while `TRPC_INTERNAL_ONLY_ENFORCE` was `false`,
        leaving those 29 procedures reachable by any key. P0.5 closed that on
        2026-07-27; the suite's last test pins the enforced behaviour across all 29, so
        a revert to log-only cannot pass silently.
  - [x] **P0.5** — `TRPC_INTERNAL_ONLY_ENFORCE` now defaults to `true`; an API key
        calling any of the 29 internal procedures gets a 403. The variable is also
        threaded into `docker-compose.prod.yml` for both `api` and `api-demo`, which
        previously enumerated every other var and omitted this one — so before this
        change there was no way to set it in a deployed container at all.
        **The month-long observation window was closed early, deliberately.** It was
        prescribed to find real API-key usage of these routes, but nothing could
        generate any: the design doc already conceded it would "very probably return
        nothing" (§4), and the evidence below is stronger than a calendar. Note what it
        does and does not show — it is a _compatibility_ inventory, not a reachability
        proof. The auth hook accepts `X-Api-Key` on any non-public route
        (`apps/api/src/hooks/auth.ts:264`), so a hand-rolled request reaches
        `federation.getConfig` today. That is precisely the hole this closes. - **Staging, the only deployed environment** — `api_keys` holds **zero rows**,
        so no key has ever existed there, across an `audit_events` history running
        2026-04-08 → 2026-07-27. No `API_KEY_*` event of any kind was ever recorded.
        This is the decisive evidence: not "nothing was logged", but "no credential
        capable of it ever existed". - **No shipped client sends a key to `/trpc/*`** — `packages/api-client`
        (`src/client.ts:89`) and `sdks/typescript` (`src/client.ts:76`) set
        `X-Api-Key` but are REST-only with no tRPC transport; `sdks/python` is
        generated from the same REST spec; `scripts/simsub-qa.ts` uses a key against
        `/federation/sim-sub/*` REST paths; the web tRPC client sends only
        `Authorization` / `X-Demo-User-Id` / `x-organization-id`
        (`apps/web/src/lib/trpc.ts:83-105`), both allowlisted. - **Playwright** authenticates interactively since #515, and `NODE_ENV=test`
        makes key auth unreachable. The federation suite passes 16/16 under
        enforcement, against 4/16 on the pre-rework tree. - **Dev DB** held 71 `API_KEY_INTERNAL_ROUTE` events, 67 of them stamped
        `enforced: true` — i.e. emitted by the tests that pin enforced behaviour. The
        window was observing the test suite observing itself.
        `apps/api/src/__tests__/security/scope-enforcement.test.ts` now pins the
        default with the variable unset, so a silent revert to log-only fails the
        build. — done 2026-07-27
  - [ ] **P0.5b** — remove the dead `payments:read` scope. **Decision taken
        2026-07-27: remove it.** It is enforced nowhere, and every payment-adjacent
        guard uses the distinct `payment-transactions:*` scope
        (`apps/api/src/trpc/routers/payment-transactions.ts`). Split out of P0.5
        because it is materially larger than the flag flip: `packages/types/src/api-key.ts:24`,
        the seeded read-only key at `packages/db/src/seed.ts:444`, and three CI-gated
        generated artefacts (`sdks/openapi.json`, `sdks/typescript/src/generated/`,
        `sdks/python/colophony/models/`) that `sdk-check` diffs in all three directions.
        Note the latent break: `apiKeyResponseSchema` validates `scopes` on the
        `apiKeys.list` output, so any pre-existing DB row still holding the scope throws
        after removal — the seed row must go in the same change.
  - [x] **[P1] Playwright suites authenticated as API keys, which blocked P0.5.**
        Every suite minted a `col_test_` key and set it as a browser header, so E2E ran
        as `authMethod: 'apikey'`. The fixtures now use the interactive test path
        (`x-test-user-id` → `authMethod: 'test'`), so scopes are a no-op, all ten scope
        arrays are gone, and `internalOnly` routers admit the suites. Privilege is
        expressed through `organization_members` roles instead. — done 2026-07-27
        **Three things the original entry got wrong, worth keeping:**
        (1) The count was **ten** grant sites, not nine — the nine counted raw `scopes:`
        hits inside `helpers/` (two of which were plumbing in `db.ts`) and missed
        `analytics/fixtures.ts`, `federation/fixtures.ts`, and a spec-local copy in
        `organization/org-delete.spec.ts` entirely.
        (2) `x-test-user-id` was "already supported" but **not reachable** — it needs
        `NODE_ENV=test` AND no JWKS verifier, and `apps/api/.env` supplies a
        `ZITADEL_AUTHORITY` that reached the E2E server. Opening it also required
        adding the header to CORS `allowedHeaders` and to tusd's forwarded-header list.
        (3) `inviteeOrg` was **not** an API-key artefact and could not be deleted — the
        `organization_members` check in org-context applies identically to interactive
        auth.
        **The two auth modes are mutually exclusive.** `NODE_ENV=test` makes the auth
        hook return before the `X-Api-Key` branch, so a test-mode app cannot
        authenticate keys at all. Key admission moved to
        `apps/api/src/__tests__/security/scope-enforcement.test.ts`, plus a tusd
        API-key case in `tusd-webhook.test.ts`.
- [x] **[P0] The CI "SDK Drift Check" validated the wrong direction.** It regenerated the TS
      SDK _from_ the committed spec and diffed that — never checking the spec against
      `apps/api/src/rest/routers/`. Green on every run for five months while the spec fell 36
      operations behind. `sdk-check` now gates three directions: source → spec
      (`pnpm sdk:check-spec`), spec → TS SDK, spec → Python SDK. — (design doc §0.1(b),
      §1.6 M3, P0.3; done 2026-07-27)
      **The job now needs a workspace build** (`@colophony/db`, `types`, `api-contracts`)
      because the export imports the routers, which resolve those through `exports` → `dist/`.
      **`openapi-python-client` is pinned at 0.29.0** — generated Python output is
      version-sensitive, so a bump requires regenerating `sdks/python/colophony/` in the same
      change. The Python check uses `git status --porcelain`, not `git diff`: a new operation
      adds new untracked files that `git diff` does not see.
- [x] **[P1] `sdks/openapi.json` was stale.** 67 paths / 103 operations committed vs 93 / 139
      in source. Regenerated: `collections` (10), `csr` (2), all invitations, submission
      discussions/resubmit/reviewers/votes/batch, and six analytics endpoints are now in the
      published contract, along with the `notifications:read`, `notifications:write`, and
      `webhooks:read` scopes added in P0.1b. Verified against the running server — the served
      and exported specs are identical. — (design doc §0.1(a); done 2026-07-27)
- [x] **[P1] `scripts/export-openapi.ts` required a running dev server.** Now builds the
      document in-process via `@orpc/openapi`'s `OpenAPIGenerator`. `restRouter` and the
      document metadata moved to `apps/api/src/rest/openapi-spec.ts` so the spec can be
      generated without the Fastify adapter; `router.ts` passes the same options object to
      `OpenAPIReferencePlugin`, which runs the same generator underneath, so the served and
      exported specs cannot drift. — (design doc §1.6 M2, P0.2; done 2026-07-27)
      **Three latent faults surfaced during the first regeneration in five months**, all
      fixed here: `generate-sdks.ts` overwrote `sdks/python/pyproject.toml` and `README.md`
      with generator output (discarding the hand-added pytest dev group and `testpaths`, and
      desynchronising the Dependabot-maintained `poetry.lock`) — it now replaces only
      `colophony/`; `generate-sdks.ts` omitted the prettier pass `sdk-check` performs on the
      TS SDK, so local regeneration produced output CI would reformat and call drift; and
      `sdks/openapi.json` is not in `.prettierignore`, so the pre-commit hook formats it —
      the export now writes prettier-formatted output to keep `--check`'s byte comparison
      valid.
- [ ] **[P1] No per-key rate limits.** `hooks/rate-limit-auth.ts:57` keys the authenticated
      window on `userId`, which for key auth is the key's _creator_ — so all of an admin's
      keys share one bucket with each other and with that admin's browser session. Key on
      the credential instead. — (design doc §0.1(c), P2.4)
- [ ] **[P1] Audit cannot distinguish an API key from its creator.** `audit_events` has a
      single `actor_id` and `BaseAuditParams` carries no `apiKeyId`, so a key's actions and
      the human's own actions are recorded identically. Add `principal_id` / `principal_type`
      (also the prerequisite for acting-as). Requires updating `insert_audit_event()`. —
      (design doc §0.1(d), P2.2)
- [ ] **[P1] Webhook deliveries are not revalidated before send.** The Inngest fan-out
      serialises endpoint URL and secret into the BullMQ job (`webhook-delivery.ts:44,63`)
      and the worker sends what the job carries without re-reading the endpoint
      (`webhook.worker.ts:23`). With 8 retries backing off to 1h, a deleted or disabled
      endpoint — or a rotated secret — keeps receiving events for up to an hour. The worker
      already re-runs `validateOutboundUrl()` per attempt for this same reason;
      authorisation belongs in the same place. Blast radius is one org today; it becomes
      cross-tenant if instance subscriptions land first. — (design doc §1.9, P2.-1)
- [ ] **[P2] No dedup constraint on `webhook_deliveries`.** `createDelivery`
      (`webhook.service.ts:222`) has no unique constraint per endpoint/event, so Inngest
      retries or replayed events can duplicate deliveries. — (design review 2026-07-27)
- [ ] **[P2] One dead scope left.** `payments:read` is declared in `apiKeyScopeSchema` and
      enforced nowhere. **Decision taken 2026-07-27: remove it** — tracked as P0.5b above,
      where the removal's real cost is scoped. `webhooks:manage` was consumed by the
      tRPC webhooks router in P0.1b rather than waiting for REST P1.1. —
      (design doc §0.1(e); updated 2026-07-27)
- [ ] **[P2] REST spec coverage.** Only 7 of 17 REST routers have a `.spec.ts`. —
      (design doc §1.8)
- [ ] **[P2] The served spec reports `3.1.1`; the committed one says `3.1.0`.**
      `generateOpenApiDocument()` pins the exported `sdks/openapi.json` to `3.1.0` for
      broader tool compatibility, but `/v1/openapi.json` is generated independently by
      `OpenAPIReferencePlugin` and cannot be pinned through it —
      `OpenAPIGeneratorGenerateOptions` is `Partial<Omit<OpenAPI.Document, 'openapi'>>`, so
      the version is explicitly un-settable. Any tool that motivated the pin still gets
      `3.1.1` from the live endpoint. Pre-existing — the old fetch-based export normalized
      the response the same way — and not introduced by P0.2, but the guarantee is only
      half-true today. Fix by serving `generateOpenApiDocument()` from a dedicated route and
      pointing the reference plugin's `specPath` at it, so one function feeds both. —
      (code review 2026-07-27)
- [ ] **[P3] Three OpenAPI tags are used but never declared.** Operations carry
      `Collections`, `Submission Analytics`, and `Submission Votes`, but
      `openApiDocumentConfig.tags` in `apps/api/src/rest/openapi-spec.ts` declares only 17
      tags and omits all three — so they render in `/v1/docs` with no description while the
      other 17 have one. Add the three descriptions and regenerate the spec. Cosmetic, but
      it is the kind of gap the spec-vs-source gate cannot catch, since both sides agree. —
      (found 2026-07-27 during P0.2)
- [ ] **[P3] Two RLS idioms in the schema.** `notifications`, `notifications-inbox`,
      `webhook-endpoints`, `transfers` use raw `current_setting('app.current_org')::uuid`
      (raises when unset); the other 24 use `current_org_id()` (returns NULL). Both
      fail closed, so not a vulnerability — but a request with no org context gets a 500
      rather than an empty result on those four. Normalise deliberately. —
      (design doc §2.3 F6)

### Blocking REST gaps (integrator workflow)

Gated on the design doc's Phase D decisions. Note that votes, reviewer assignment, and
invitations were assumed missing and are in fact already exposed — see §0 of the design doc.

- [ ] **[P1] Webhook endpoint management over REST** (9 tRPC procs, `webhooks:manage`
      already exists). **Requires the subscription-model decision (D2) first** — per-org vs
      instance-level is a resource-model question, not a route question. — (design doc §1.9, P1.1)
- [ ] **[P1] Notifications over REST** (list, unread-count, mark-read, mark-all-read + 3
      preference procs). Only path today is SSE, unusable for consumers that cannot hold a
      connection. — (design doc §1.7, P1.2)
- [ ] **[P1] File upload initiation under `/v1`.** Intake is incomplete: an integrator can
      create a submission but cannot attach a manuscript. `POST /embed/:token/prepare-upload`
      is a working template. — (design doc §1.7, P1.3)
- [ ] **[P1] Public discovery of open submission periods.** `/v1/public/` has only
      `orgs/:slug/response-time` and the demo routes. — (design doc §1.7, P1.4)
- [ ] **[P2] Idempotency keys for integrator writes.** No `Idempotency-Key` on any `/v1`
      `POST`, including submission creation and the two batch operations. Contract surface,
      so it cannot be added cheaply later. — (design doc §1.10, D3)

### Design Decisions

- [ ] **Cross-org service principal** — instance-scoped principal + acting-as. Approach and
      migration path in [`docs/api-integration-design.md`](api-integration-design.md);
      recommendation is a separate `service_principals` table, flat capability strings with
      tenancy in a grant table, and org-visible/org-revocable grants. Four decisions gate the
      work (D1–D4, §5 Phase D). Not started.
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
- [x] [P2] GraphQL resolvers: add `idParamSchema` validation on all raw string ID args passed to services — forms (query + field mutations), submissions (query + history), audit (query) — (plan review 2026-02-20; done 2026-02-21)
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
- [x] [P2] Redact CMS credentials from audit logs — `updateWithAudit` writes raw `config` (including passwords) to audit table; needs field-level redaction before `newValue` storage — (code review 2026-02-24; done 2026-02-24)
- [x] [P2] Add audit logging for `testConnection` — sensitive operation using stored credentials, currently not audit-logged — (code review 2026-02-24; done 2026-02-24)
- [x] Slate E2E tests — Playwright tests for pipeline flows (30 tests, 5 spec files) — (architecture doc Track 4; done 2026-02-24)

### Research / Design

- [x] Workflow orchestration evaluation: Inngest (preferred) vs Temporal — **Resolved:** Inngest chosen — step functions, waitForEvent, single Docker container — (decision 2026-02-15; resolved 2026-02-23)
- [x] CMS "starter home" scope: static pages vs blog-like vs magazine-format with issue structure — **Resolved:** Integration-only for v2.0 (WordPress/Ghost adapters), defer built-in pages — (architecture doc Open Question #4; resolved 2026-02-23)

---

## Track 5 — Register (Identity & Federation)

### Code

- [x] Discovery: WebFinger + `.well-known` endpoints — (architecture doc Track 5; done 2026-02-24)
- [x] Identity: `did:web` DID document resolution — per-user Ed25519 keypairs, native crypto (no jose needed) — (architecture doc Track 5; done 2026-02-24)
- [x] [P2] Split `getOrInitConfig()` to separate public-key-only read from private-key read — reduces private key exposure surface — (code review 2026-02-24, deferred to Phase 3; done 2026-02-25)
- [x] [P3] Key rotation mechanism for user keypairs — (architecture doc Track 5, deferred to Phase 7; done 2026-02-25)
- [x] [P2] Inbound metadata fetch hardening — SSRF protection, domain mismatch, size limits, shared `fetchAndValidateMetadata()` helper — (code review 2026-02-24, deferred to Phase 3; done 2026-02-25)
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
- [x] [P3] Per-capability rate limiting — rate limit per federation capability (simsub, transfer, etc.) rather than global per-peer — (code review 2026-02-25, deferred to production hardening; done 2026-02-26)
- [x] [P3] Migration rollback testing — enum casts can fail on dirty data; add rollback scenario tests before production deployment — (code review 2026-02-25, deferred pre-launch; done 2026-02-26)
- [x] [P4] Consider splitting schema migrations (enum changes vs new tables) for safer production rollback — documented as pattern + pre-flight validator instead of splitting 0031 (already applied) — (code review 2026-02-25, deferred pre-launch; done 2026-02-26)
- [x] [P3] Federation rate limit fail mode: configurable fail-open/fail-closed + in-process fallback when Redis unavailable — (audit finding #4, 2026-03-01; done 2026-03-01 PR #225)
- [x] [P3] Federation test gaps: integration tests for trust handshake flow and hub-first discovery path — (audit finding #5, 2026-03-01; done 2026-03-01 PR #225)
- [x] [P3] Unbounded peer query in migration broadcast — migration.service.ts:870 fetches all trusted peers with no LIMIT; small dataset in practice but violates pagination rule — (code review 2026-03-03; done 2026-03-04)
- [x] [P3] Trust metadata SSRF uses custom resolveAndCheckPrivateIp instead of validateOutboundUrl — trust.service.ts:88; functionally equivalent but inconsistent with the standard pattern — (code review 2026-03-03; done 2026-03-04)

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
- [x] [P2] Defense-in-depth org filtering missing in webhook.service.ts — getEndpoint, listEndpoints, rotateSecret query by ID only (RLS-only, no explicit organizationId filter) — (code review 2026-03-03; done 2026-03-04)

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
- [x] tRPC 10 → 11 — combined tRPC 11 + TQ5 + TS 5.7.2 migration; TS2742 quirk resolved — (version pin; done 2026-02-17)
- [x] Inngest 3 → 4 — hard breaking change (v4.0.3 errors on v3-style function config); 15 function definitions across 11 files + 6 test files; TS2742 fix via `InngestFunction.Any` annotation — (dependabot #315; done 2026-03-22)

### [P2] Medium — Dev tooling, lower risk

- [x] Vitest 3 → 4 — shipped Oct 2025; dev-only, but 261+ tests need validation — (dependabot #76; done 2026-02-17)
- [x] @testing-library/react 14 → 16 — dev-only; skipped v15; bundled with Next 16 + React 19 upgrade — (dependabot #78; done 2026-02-16)

### [P3] Low — Unused or minimal impact

- [x] nodemailer 7 → 8 — already at v8.0.1; bumped @types/nodemailer 7.0.9 → 7.0.11 — (dependabot #77; done 2026-02-26)
- [x] nodemailer 8 → 9 — security update; clean against the existing `@types/nodemailer` 7.0.11, no adapter changes needed — (dependabot #490; done 2026-07-25)
- [x] mjml 4 → 5 — `mjml2html` returns a Promise in v5; render layer made async and normalized with `Promise.resolve()` so it works under both majors — (dependabot #475 / #488; done 2026-07-25)
- [x] zod 4.3 → 4.4 — surfaced a latent `env.ts` bug where an optional `.pipe()` target sat behind a non-optional outer `z.string()` — (dependabot #489; done 2026-07-25)

### Upgrade order notes

- **Node 22** can be done independently — update `.nvmrc`, engines fields, CI matrix, test
- **Next 16 + React 19** must move together; eslint-config-next follows
- **Zod 4** should happen before or alongside **tRPC 11** since tRPC's Zod error behavior is the pin reason
- **TanStack Query 5** is independent but touches the same web app files as React 19

---

## Code Quality

### File Size & Complexity

- [x] Add soft 500-line guideline — flag files over 500 lines for review during `code review`; not a hard gate, just a review trigger — (dev workflow session 2026-02-20; done 2026-02-20)
- [x] Extract `validateFormData` and per-type validators from `form.service.ts` (912 lines) into `form-validation.service.ts` — natural seam between CRUD operations and validation logic — (dev workflow session 2026-02-20; done 2026-02-20)
- [x] [P3] Consolidate API test file locations — 49 spec files are co-located (`services/*.spec.ts`), 4 are in `services/__tests__/`. Move the 4 `__tests__/` files to co-located pattern for consistency. `queue-preset` has complementary tests in both locations that should be merged into one file. — (2026-03-26; done 2026-03-27)

### Defense-in-Depth (Code Review Findings 2026-03-03)

- [x] [Critical] `submission_discussions` missing `FORCE ROW LEVEL SECURITY` — `packages/db/migrations/0041_submission_discussions.sql` enables RLS but does not force it — (code review 2026-03-03; done 2026-03-03 migration 0050)
- [x] [P2] Defense-in-depth: transfer service org-scoped methods missing explicit `organizationId` predicate — `apps/api/src/services/transfer.service.ts:347,361,382,423` — (code review 2026-03-03; done 2026-03-03)
- [x] [P2] Unbounded query: transfer listing by submission has no pagination/limit — `apps/api/src/services/transfer.service.ts:339` — (code review 2026-03-03; done 2026-03-03)
- [x] [P2] Migration token verification unused `_submissionId` parameter (missing binding check) — `apps/api/src/services/migration.service.ts:958` — (code review 2026-03-03; done 2026-03-03)
- [x] [P2] Unbounded query: migration pending approvals — `apps/api/src/services/migration.service.ts:1119` — (code review 2026-03-03; done 2026-03-03)
- [x] [P2] Defense-in-depth: sim-sub peer query lacks explicit `organizationId` filter — `apps/api/src/services/simsub.service.ts:403` — (code review 2026-03-03; done 2026-03-03)
- [x] [P3] Notification preferences list has no `LIMIT` — `apps/api/src/services/notification-preference.service.ts:71` — (code review 2026-03-03; done 2026-03-03)
- [x] [P3] Defense-in-depth: pipeline service query methods missing explicit `organizationId` filter — `apps/api/src/services/pipeline.service.ts:113,196,500,512` — (plan review 2026-03-03, deferred from READER role PR)

### Dev Workflow

- [x] Structured session handoff doc (`session-handoff.md`, gitignored) — `/end-session` writes machine-readable state (branch, status, files touched, decisions made, open questions, next action) alongside DEVLOG narrative; `/start-session` reads handoff first for instant context restoration, falls back to DEVLOG if missing. DEVLOG becomes purely archival/human-readable — (dev workflow session 2026-02-20; done 2026-02-20)
- [x] Add decision-surfacing step to plan mode — after exploring code but before writing the plan, explicitly enumerate architectural gray areas and present them with a recommended path and rationale; get user preferences before committing to an approach. Still recommend, just surface the choice — (dev workflow session 2026-02-20; done 2026-02-20)
- [x] Integrate plan review into plan mode — run `code review plan` automatically after writing the plan but before ExitPlanMode; adjust plan based on findings, note changes and dismissals with rationale; user sees a reviewed plan at approval time instead of manually triggering review — (dev workflow session 2026-02-20; done 2026-02-20)
- [x] Increase plan specificity standard — plans should include exact file paths, concrete type/prop names, and named test cases with setup and assertions where feasible; specific enough to mechanically verify post-implementation. Update plan mode instructions — (dev workflow session 2026-02-20; done 2026-02-20)
- [x] Plan drift detection — after implementation, verify that the delivered code matches the approved plan. Check that specified files exist, export expected symbols, and follow specified patterns. Run as part of `code review branch` or as a standalone `/plan-drift` skill — (dev workflow session 2026-02-20; done 2026-02-20)
- [x] Plan override log for drift detection — during implementation, when discoveries require deliberate divergence from the plan, log overrides with rationale (file, what changed, why) in a structured format (e.g., task list metadata or a plan-overrides section in the PR). Drift detection reads the override log and excludes acknowledged divergences, only flagging unlogged drift — (dev workflow session 2026-02-20; done 2026-02-20)
- [x] Automatic branch review before PR — run `code review branch` automatically after implementation is complete (all tasks done, tests passing) but before creating the PR; incorporate findings before presenting the PR for user review. Mirrors the plan review integration: user sees a reviewed PR, not a raw first draft — (dev workflow session 2026-02-20; done 2026-02-20)

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

- [x] [P1] Console error/warn as test failures — add `vi.spyOn(console, 'error')` / `jest.spyOn(console, 'error')` in global setup files with `afterEach` assertions; allowlist intentional warnings; fix `act(...)` warnings in web tests and Vitest mock warnings — (code review 2026-03-03; done 2026-03-03)
- [x] [P2] Add `test:cov` scripts to all packages — add `--coverage` with lcov.info + JSON output to api, web, api-client, auth-client, create-plugin, plugin-sdk, types; collect coverage artifacts in CI — (code review 2026-03-03; done 2026-03-03)
- [x] [P2] Per-package coverage gates — add `coverageThreshold` in `apps/web/jest.config.ts` and Vitest thresholds in `apps/api/vitest.config.ts`; measure current coverage first, set floors at current minus 5% buffer, ratchet up monthly — (code review 2026-03-03; done 2026-03-03)
- [x] [P2] Changed-code coverage guardrails — enforce minimum coverage on changed files/lines in PRs (e.g., `diff-cover` or Codecov PR checks); prevents new low-coverage hotspots while legacy gaps burn down gradually — (code review 2026-03-03; done 2026-03-03 diff-cover 80% threshold)
- [x] [P3] Flakiness and determinism CI checks — run unit tests with retries disabled and `--sequence.shuffle` on at least one CI lane; add quarantine convention (`.flaky.test.ts` suffix or skip marker) and fail PRs that introduce new flaky markers — (code review 2026-03-03; done 2026-03-04)
- [x] [P3] Risk-based test matrix — audit coverage per domain (pipeline, federation, workspace, forms) and document minimum test layers per domain (unit + service integration + API route + E2E happy path) in `docs/testing.md`; identify high-risk low-coverage hotspots — (code review 2026-03-03; done 2026-03-04)
- [ ] [P3] ESLint 9 → 10 upgrade — blocked by `eslint-plugin-react`, `eslint-plugin-react-hooks`, `eslint-plugin-jsx-a11y` (transitive via `eslint-config-next`); Dependabot canary will signal when unblocked; tracking issue #273 — (2026-03-16); canary verified 2026-03-22 (Dependabot PR #269 failed CI as expected, still blocked by eslint-plugin-react)
- [x] [P2] Diagnostic: plan review step dropped from workflow — root cause: plan mode system reminder's rigid Phase 5 overrides instruction; no mechanical enforcement existed. Fix: `PreToolUse` hook on `ExitPlanMode` blocks unless `code review plan` marker exists or plan is trivial — (2026-03-28, user-reported; done 2026-03-28)
- [x] [P3] Skill update: code review should auto-add actionable out-of-scope findings to backlog — during both plan review and branch/diff review, any Important+ findings outside the current task scope should be appended to docs/backlog.md automatically — (workflow improvement 2026-03-03; done 2026-03-22 — enhanced /end-session Step 4b with systematic review finding extraction)
- [x] [P4] Ephemeral DB/queue per test worker — standardize `TestContext` factory for isolated schemas per worker; replace ad-hoc Redis db 1 patching in `vitest-setup.ts`; add explicit contract tests around external boundaries (webhooks, auth, adapters) with fixture replay — (code review 2026-03-03; closed 2026-03-22 — current isolation via truncateAllTables, Redis db 1, singleFork is adequate)
- [x] [P4] Manual QA tracking — establish lightweight QA log (structured markdown or checklist) for pre-release smoke tests, exploratory testing sessions, and regression checks; track what was tested, time spent, and issues found — (code review 2026-03-03; done 2026-03-03)

### CI

- [x] [P2] CI path filtering for Playwright suites — skip irrelevant E2E suites on PRs based on changed files; `.github/scripts/detect-changes.sh` with fail-open strategy — (DEVLOG 2026-02-24; done 2026-02-24)
- [ ] [P1] Stop the Deploy workflow reporting `success` on no-op runs — when `prepare` sets `skip`, Build and both deploy jobs are skipped and the run still concludes `success`. On 2026-07-25/26 four such runs interleaved with real failures, so a total deployment outage read as intermittent flakiness and went unnoticed for about seven hours. Either fail the run when `skip` is set for a `workflow_run` trigger on `main`, or surface "deployed / not deployed" somewhere that does not depend on reading each run's job list. Clean example to work from: run 30205582585 concluded `success` with a `prepare` log reading verbatim `CI did not succeed (conclusion: failure), skipping deploy` — (DEVLOG 2026-07-26)
- [ ] [P2] Make Coverage Report a required status check — #494 reached `mergeStateStatus: CLEAN` with Coverage Report unresolved, so the job can fail without blocking a merge. That is how an infrastructure flake (or a real coverage regression) becomes invisible — (DEVLOG 2026-07-26)
- [ ] [P3] Consider a registry pull-through cache or retry for service containers — Coverage Report failed on 2026-07-26 when Docker Hub timed out three times pulling `postgres:16-alpine`, killing `Initialize containers` before any test ran. Passed on retry — (DEVLOG 2026-07-26)

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
- [x] [P3] Status token rotation on R&R resubmission — full embed resubmit flow (backend endpoints + frontend page + token rotation + tusd auth) — (audit remediation P2/P3, 2026-03-01; done 2026-03-22)

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

- [x] [P0] AGPL license boundary documentation — clearly document what is AGPL (Zitadel), what license Colophony uses, obligations for self-hosters, and how the boundary works — (security checklist + persona gap analysis 2026-02-27; done 2026-03-02 `docs/licensing.md`)
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
- [x] [P3] In-browser copyediting or diff view between manuscript versions — (persona gap analysis 2026-02-27; done 2026-03-26 PR pending)
- [x] [P2] Copyedit stage manual round-trip — .docx export from ProseMirror JSON, editor shares externally, upload final version back, track stage status + elapsed time. Protocol defined in DESIGN_SYSTEM.md Section 9 — (design system session 2026-03-28; done 2026-03-28)
- [x] [P3] READER role enforcement — define what READER can and cannot do distinct from EDITOR; currently decorative — (persona gap analysis 2026-02-27; done 2026-03-03)
- [x] [P3] Email invitation workflow — invite by email link/token instead of requiring pre-existing Zitadel account — (persona gap analysis 2026-02-27; done 2026-03-27 PR pending)
- [x] [P3] Custom org roles — expanded enum to 5 roles (ADMIN/EDITOR/READER/PRODUCTION/BUSINESS_OPS) with multi-role array, productionProcedure/editorProcedure middleware, role display names in org settings — (persona gap analysis 2026-02-27; done 2026-03-27 PR #369)
- [x] [P1] Documenso webhook: defense-in-depth org filter — mutation phase uses `withRls()` on appPool + explicit `orgId` on `updateStatus`; code review caught `set_config` on superuser pool doesn't enforce RLS — (code review 2026-03-22; done 2026-03-22)
- [x] [P2] Documenso webhook: Zod schema validation — `documensoWebhookPayloadSchema` validates payload structure before processing — (code review 2026-03-22; done 2026-03-22)
- [x] [P2] Documenso webhook: audit logging for contract status changes — `CONTRACT_SIGNED` and `CONTRACT_COMPLETED` audit actions logged via `auditService.log()` inside `withRls` — (code review 2026-03-22; done 2026-03-22)
- [x] [P3] Test `mySubmissions` projected response shape — assert `writerStatus`/`writerStatusLabel` fields in tRPC router test — (branch review 2026-03-26; done 2026-03-27)
- [x] [P3] Test `mySubmissionDetail` procedure + writer-context routing in `submission-detail.tsx` — (branch review 2026-03-26; done 2026-03-27)
- [x] [P3] Service test for `getByIdAsOwner` ownership check and error types — (branch review 2026-03-26; done 2026-03-27)
- [x] [P2] Collection service unit tests — 24 tests (CRUD, visibility filtering, cross-tenant validation, audit logging, reorder) in `collection.service.spec.ts` — (branch review 2026-03-26; done 2026-03-27)
- [x] [P2] Reading anchor wiring — ManuscriptRenderer IntersectionObserver tracking, collection detail reading mode, updateCollectionItemSchema + service whitelist, defense-in-depth fix for getItems() submissions join — (design system session 2026-03-28; done 2026-03-28)
- [x] [P3] Reading anchor test coverage — unit tests for: readingAnchor persistence in updateItem, org-scoped join predicate in getItems, ManuscriptRenderer anchor restore/callback, collection reading mode UI, scope guard (queue context = no anchor) — (branch review drift 2026-03-28; done 2026-03-31)

---

## Track 13 — Business Operations (Post-Launch)

> **Status:** All items complete. Track 13 closed.

### Code

- [x] [P1] `contributors` + `contributor_publications` schema — org-scoped contributor entity linking submissions, publications, payments, rights. Columns: display_name, bio, pronouns, website, mailing_address (plain text, app-level encryption deferred), notes — (design system session 2026-03-28; done 2026-03-28)
- [x] [P1] `rights_agreements` schema — per-published-piece IP ownership lifecycle (first_north_american_serial, electronic, anthology, audio, translation, custom). Status: draft → sent → signed → active → reverted. Reversion date tracking. Separate from Documenso `contracts` table — (design system session 2026-03-28; done 2026-03-28)
- [x] [P1] `payment_transactions` schema — unified payment table with type discriminator (submission_fee, contest_fee, contributor_payment). New table, not extending existing `payments` — (design system session 2026-03-28; done 2026-03-28)
- [x] [P1] `businessOpsProcedure` middleware — BUSINESS_OPS or ADMIN role check, following existing procedure pattern in `apps/api/src/trpc/init.ts` — (design system session 2026-03-28; done 2026-03-28)
- [x] [P1] Business Ops nav group + sidebar rendering — new "Business" activity group visible to BUSINESS_OPS/ADMIN, command palette updated — (design system session 2026-03-28; done 2026-03-28)
- [x] [P1] Contributor service + tRPC router — CRUD, link to submissions/users, publication add/remove, 8 procedures with audit + scope enforcement. Detail view deferred to next PR — (design system session 2026-03-28; done 2026-03-28)
- [x] [P1] Rights service — lifecycle management, reversion alerts ("3 rights agreements reverting in 30 days"), integration with production pipeline — (design system session 2026-03-28; done 2026-03-28)
- [x] [P1] Revenue service — submission fees (existing Stripe), contributor payments, contest prizes, revenue reporting — (design system session 2026-03-28; done 2026-03-29)
- [x] [P2] Business Ops dashboard — health card grid pattern with contributor count, outstanding payments, upcoming reversions, revenue summary — (design system session 2026-03-28; done 2026-03-29)
- [x] [P2] Editorial analytics dashboard — acceptance rate (overall + by genre/period), response time (avg/median/p90 + trend), pipeline health, genre distribution, contributor diversity, reader alignment — (design system session 2026-03-28; done 2026-03-29)
- [x] [P2] Contest management — contest-type submission periods with rounds (`contestGroupId` + `contestRound`), judge assignments, anonymous judging, prize disbursement. Period-scoped guest editor roles deferred — (design system session 2026-03-28; done 2026-03-29)

---

## Track 14 — Writer Platform Enhancements (Post-Launch)

> **Status:** In progress. Schema foundation (P1) complete. Service layer and frontend pending.

### Code

- [x] [P1] `simultaneous_submission_groups` schema — user-scoped sim-sub groupings linking native + external submissions of same work. Auto-withdraw prompt on acceptance — (design system session 2026-03-28; done 2026-03-29)
- [x] [P1] `portfolio_entries` schema — three types: `colophony_verified` (from contributor_publications), `federation_verified` (future federation sync), `external` (manual). Forward-declares `federation_source_instance` + `federation_entry_id` columns — (design system session 2026-03-28; done 2026-03-29)
- [x] [P1] `reader_feedback` schema — org-configurable tags (JSONB), short comment (280 chars), forwardable boolean. Opt-in per org. Anonymous reader identity on forwarded feedback — (design system session 2026-03-28; done 2026-03-29)
- [x] [P2] Sim-sub management UI — group creation, linked submission view, status management. Auto-withdraw on acceptance deferred (separate backend feature) — (design system session 2026-03-28; done 2026-03-30)
- [x] [P2] Response time transparency — aggregation query over local submission records, displayed on magazine public profile + submission form. `source` field (local vs federated) for future federation data. Org opt-out available — (design system session 2026-03-28; done 2026-03-30)
- [x] [P2] Feedback on rejection flow — reader tags/comments during scoring, editor inclusion of anonymized feedback in rejection notice, org-level feature toggle (default off) — (design system session 2026-03-28; done 2026-03-31)
- [x] [P3] Writer sidebar updates — Sim-Sub Groups nav item (already done), Portfolio badges (verified/federated/external), Analytics personal response time stats (already done) — (design system session 2026-03-28; done 2026-03-31)
- [x] [P1] Reader feedback service: defense-in-depth org match on submission_id — service must verify `submission.organizationId === orgId` before insert to prevent cross-org feedback — (branch review 2026-03-29)
- [x] [P2] Sim-sub junction service: ownership validation on referenced records — service must verify `simsubGroup.userId`, `submission.submitterId`, and `externalSubmission.userId` match the caller before insert — (branch review 2026-03-29)
- [x] [P2] Custom rejection templates: reader feedback array support — `renderCustomTemplate()` only interpolates scalar merge fields; `readerFeedback` array is silently ignored for orgs with custom rejection email overrides. Need array/loop support in custom template renderer — (branch review 2026-03-31; done 2026-03-31)
- [x] [P2] Defense-in-depth: `emailTemplateService.delete()` missing `organizationId` filter — deletes by `templateName` only (relies on RLS alone); should also filter on `organizationId` per defense-in-depth rule. Pre-existing issue in `apps/api/src/services/email-template.service.ts:209` — (plan review 2026-03-31; done 2026-03-31)
- [x] [P3] Custom template editor: surface `{{#each}}` syntax to editors — `TEMPLATE_ARRAY_FIELDS` metadata exported from `@colophony/types` but editor UI only consumes `mergeFields: string[]`; need data-path change to show array field documentation and `{{#each}}` syntax help — (plan review 2026-03-31; done 2026-03-31)

---

## Accessibility (Cross-Cutting, Pre-Launch)

- [x] [P2] Status badges: add icons alongside color to support color-blind users — (persona gap analysis 2026-02-27; done 2026-03-02)
- [x] [P2] File drop zones: add keyboard focus handling, `role="button"`, `tabIndex` — (persona gap analysis 2026-02-27; done 2026-03-02)
- [x] [P2] Scan status: add `aria-live` region for screen reader announcements during file scanning — (persona gap analysis 2026-02-27; done 2026-03-02)
- [x] [P2] Sidebar: add `aria-label` to `<nav>` element — (persona gap analysis 2026-02-27; done 2026-03-02)
- [x] [P3] Sim-sub error message: show human-readable explanation ("This manuscript appears to be under consideration at another publication that prohibits simultaneous submissions") instead of generic tRPC error — (persona gap analysis 2026-02-27; done 2026-03-02 via SimSubConflictDisplay graduated confidence component)
- [x] [P3] Skip navigation link — add "Skip to main content" sr-only link at top of layout for keyboard users — (manual a11y audit 2026-04-01; done 2026-04-01)
- [x] [P3] Command palette focus restoration — cmdk dialog returns focus to `body` on close instead of the trigger button; investigate shadcn/cmdk fix — (manual a11y audit 2026-04-01; done 2026-04-01)

---

## Production Deployment Checklist

### Infrastructure Setup

- [x] Coolify + Hetzner managed hosting setup — done 2026-03-20, staging live at staging.colophony.pub — (architecture doc Track 1)
- [x] [P2] Fix tusd port mismatch — tusd listens on 8080, nginx proxies to 1080; add `-port 1080` to tusd command or update nginx upstream — (DEVLOG 2026-03-20, smoke test; done 2026-03-21 PR #292)
- [x] [P2] Fix pre-existing RLS permission failures — `journal_directory` has INSERT/UPDATE/DELETE (should be SELECT only), `audit_events` has direct INSERT + DELETE (should use audit_writer) — (DEVLOG 2026-03-20, staging verify-rls.sh; done 2026-03-21 PR #292)
- [x] [P3] Configure Zitadel webhook for staging — Actions → Targets → user event group → staging endpoint; signature fix + v2 payload adaptation (PRs #293–#297), then automated in `pnpm zitadel:setup` with all 6 user lifecycle events via group execution (PR #299) — (DEVLOG 2026-03-20; done 2026-03-22)
- [x] [P3] Connect Inngest Cloud to staging — event key + signing key — (DEVLOG 2026-03-20; done 2026-03-22)
- [x] [P3] Coolify IPv6 network bug — `coolify` Docker network gets malformed IPv6 gateway on Hetzner; manual recreate needed after Coolify install — (DEVLOG 2026-03-20; confirmed fixed 2026-03-22)
- [x] [P3] Investigate webhook rate limit Redis error — every Zitadel webhook request logs "Webhook rate limit Redis error — allowing request"; non-fatal but indicates Redis connection issue for webhook-specific rate limiter — (DEVLOG 2026-03-22; done 2026-03-22)
- [x] [P3] Coolify proxy restart after redeploy — original fix: Docker DNS resolver + variable-based proxy_pass in nginx for dynamic re-resolution (DEVLOG 2026-03-22; done 2026-03-22). Root cause updated 2026-03-24: the real issue is Traefik's Docker provider losing container references during all-at-once teardown, not nginx DNS caching. nginx fix is still valuable but doesn't prevent the Traefik stale routing. Auto-recovery added to deploy workflow (PR #336). Permanent fix: split into individual Coolify services (see P1 item below)
- [x] [P3] `queue-preset.service.ts:49` — `listByUser()` missing explicit `organizationId` filter and LIMIT — (plan review 2026-03-20; done 2026-03-21 PR #292)
- [x] Monitoring stack: Prometheus + Grafana (Sentry for errors) — done 2026-02-27 PR pending; Loki deferred to production
- [x] [P1] Split Coolify deployment into individual services — split monolithic docker-compose.coolify.yml into 5 Coolify resources (data, app, gateway, uploads, monitoring) on shared `colophony-net` network. Smart deploy detection via LAST_DEPLOYED_SHA. Eliminates Traefik stale routing and proxy restart workaround — (2026-03-24, deploy debugging session; done 2026-03-24)
- [x] [P2] Drop Coolify in favor of direct SSH + Docker Compose deploy — replaced nginx with Caddy (automatic HTTPS), unified staging/production on single `docker-compose.prod.yml` + SSH deploy, removed 5 Coolify compose files + Coolify quirks + LAST_DEPLOYED_SHA smart detection — (2026-03-24; done 2026-03-25)
- [x] [P3] Gateway-level rate limiting via Caddy `rate_limit` module — API already has sliding-window rate limiting at Fastify level; gateway-level rate limiting deferred as defense-in-depth — (2026-03-25, Coolify removal)

### Database Hardening

- [x] Change `app_user` password from default — (checklist; done 2026-03-17 init script validation)
- [x] PostgreSQL SSL/TLS (`DB_SSL` env var) — (checklist; done 2026-03-17)
- [x] Connection pooling (PgBouncer) — (checklist, PR pending)
- [x] Backups (WAL-G to S3) — done 2026-03-19
- [x] `pg_stat_statements` for query monitoring — (checklist; done 2026-03-17)
- [x] Verify RLS in production — done 2026-03-19

### Schema Bugs

- [x] [P2] `userKeys` table has `pgPolicy` definitions but missing `.enableRLS()` — RLS policies defined but not activated. Add `.enableRLS()` + generate migration — (DEVLOG 2026-03-19, RLS verification; done 2026-03-20)

### Security & Compliance

- [x] Rotate credentials quarterly — done 2026-03-19, `scripts/rotate-secrets.sh` + `docs/credential-rotation.md` — (checklist)
- [x] AGPL license boundary documented (Zitadel is AGPL) — done 2026-03-02 `docs/licensing.md` — (checklist)
- [x] [P2] Verify SSRF protection in `hub-client.service.ts` — `fetch()` calls at lines 38/104/141/199; `validateOutboundUrl` is imported but may not be called before every fetch — (plan review 2026-03-19; done 2026-03-20)
- [x] [P3] Add LIMIT to unbounded queries — `correspondence.service.ts:70`, `submission.service.ts:730`, `file.service.ts:80` — (plan review 2026-03-19; done 2026-03-20)

### Staging Provisioning

- [x] [P2] Provision Garage S3 on staging — add GARAGE_RPC_SECRET, GARAGE_ADMIN_TOKEN, GARAGE_S3_ACCESS_KEY, GARAGE_S3_SECRET_KEY to .env.staging; run start-garage.sh layout assign — (DEVLOG 2026-04-07, deploy diagnostics; done 2026-04-08)
- [x] [P2] Provision tusd on staging — smoke test shows `OPTIONS /upload — Tus-Resumable header missing`; tusd container likely needs S3 config — (DEVLOG 2026-04-07, smoke test; done 2026-04-08 — tusd connected to Garage, Tus-Resumable header present)
- [x] [P2] Demo one-time server setup — DNS for demo.staging.colophony.pub, init-demo-db.sh, Garage demo buckets, 4-hour cron reset. See docs/demo/deploy-checklist.md — (DEVLOG 2026-04-02, handoff; done 2026-04-08)
- [x] [P3] Remove Coolify cleanup from deploy workflow — `systemctl stop/disable coolify.service` and coolify container removal can be removed once confirmed Coolify is gone permanently; currently runs every deploy as safety net — (DEVLOG 2026-04-07; done 2026-04-08 — Coolify confirmed gone, systemd unit not-found, leftover coolify-redis/coolify-db removed)
- [x] [P3] Clean up deploy diagnostics — remove verbose ss/echo diagnostics from deploy.yml once deploy is stable for a few sessions — (DEVLOG 2026-04-07; done 2026-04-08)

### Monitoring

- [~] GitHub GraphQL rate limit passive drain (~60 pts/hr) — diagnosed 2026-02-19, likely GitHub-internal (Dependabot, security scanning). At ~1.2% budget/hr, not actionable unless large exhaustion recurs. If so, convert skills from `gh pr list/create` (GraphQL) to `gh api` (REST) — (DEVLOG 2026-02-19)
- [x] [P2] Enhanced post-deploy smoke tests — verify `NEXT_PUBLIC_API_URL` in built frontend bundle (no double `/trpc`), Grafana `/grafana/api/health`, OIDC discovery endpoint reachable, webhook provider freshness from `/webhooks/health`. Existing `scripts/smoke-test.sh` already checks `/health`, `/ready`, security headers, TLS, tus, tRPC 401, frontend HTML, CORS — extend it with these 4 checks. Triggered by duplicate `/trpc` bug (PR #328) that passed all tests because auth E2E tests don't make tRPC calls — (2026-03-24; done 2026-03-24)

---

## Simplification & Maintenance Debt

> Items identified during architecture review (2026-03-16). Focused on reducing operational complexity and config drift.

### Codebase Extraction

- [x] [P2] Extract GraphQL surface to feature branch — `src/graphql/` (builder, schema, resolvers, guards, router), Yoga plugin in `main.ts`, GraphQL-specific API key scopes. Service layer and shared types stay. Re-merge when user demand justifies it — (architecture review 2026-03-16; done 2026-03-16)
- [x] [P2] Extract plugin system to feature branch — `packages/plugin-sdk/`, `packages/create-plugin/`, `src/adapters/extensions-accessor.ts`, `src/adapters/plugins-accessor.ts`, `src/services/plugin-registry.service.ts`, `src/plugins/`, `apps/web/src/components/plugins/`, `apps/web/src/lib/plugin-components.ts`, `PLUGIN_REGISTRY_URL` env var. Keep adapter registry and email/storage/payment/CMS adapters — (architecture review 2026-03-16; done 2026-03-16)

### Dev Tooling

- [x] [P2] `db:reset` destroys Zitadel eventstore — rewrote `scripts/db-reset.sh` to use `DROP SCHEMA public CASCADE` + `drizzle-kit push --force` + grant restoration instead of `docker compose down -v`. Preserves Zitadel database and postgres volume. Requires running postgres container — (QA session 2026-04-01; done 2026-04-01)
- [x] [P3] Upgrade @faker-js/faker 8.4.1 → 10.x — single type error: `faker.internet.userName()` renamed to `faker.internet.username()` in test factories. Dev dependency only. May have other runtime behavior changes across two major versions — audit factory usage after fix — (Dependabot PR #389, CI failure 2026-03-29; done 2026-03-31)
- [x] [P2] Evaluate MinIO replacement — MinIO repo archived Feb 2026; no future security patches. Evaluate alternatives (LocalStack, SeaweedFS, direct S3/R2) for dev/CI/self-hosted object storage. Not urgent while no CVEs exist, but blocked from upstream fixes if one surfaces — (2026-03-25, CI image pin session; done 2026-03-25 — migrated to Garage v2.2.0)
- [x] [P2] Replace Overmind with hivemind or concurrently — Overmind solves signal handling but tmux dependency, `dev:clean` escape hatch, and WSL quirks are operational drag. hivemind (Go binary, no tmux, proper signal handling) preferred; concurrently as fallback. Test on macOS, Linux, WSL before standardizing. Keep `dev:clean` as escape hatch, not normal workflow. Turbo `--watch` only if shutdown behavior verified in this repo — (architecture review 2026-03-16; code changes done 2026-03-16; validated on WSL/Linux 2026-03-22, macOS deferred — not in team environment)
- [x] [P3] Remove `packages/eslint-config` — unused v1 legacy configs (`base.js`, `nextjs.js`, `nestjs.js`), neither app imports from it. Moved `eslint` and `eslint-config-next` to direct app devDependencies — (architecture review 2026-03-16; done 2026-03-16)
- [x] [P1] Migrate project hooks configuration — hooks config used wrong schema (`event`+`script` keys) and wrong file location; migrated to correct `matcher`+`hooks[{type,command}]` format. All 12 project hooks affected — (diagnosed 2026-03-29; done 2026-03-29)

### Testing & CI

- [x] [P2] Testing optimization — Python SDK in CI, test/CI contract clarity, Vitest config consolidation, deterministic web test UUIDs, coverage includes specialized suites, webhook CI job, flaky test fix — (architecture review 2026-03-16; done 2026-03-17)
- [x] [P2] E2E selector brittleness — replaced CSS class selectors, parent traversal, positional disambiguation with `data-testid` and dialog-scoped role locators; removed `waitForTimeout` calls; ~20 acceptable `.first()/.last()` uses left unchanged — (done 2026-03-17)
- [x] [P2] Defense-in-depth org filtering — CMS connection service (`getById`, `update`, `delete`, `testConnection`) and issue service (`getById`, `getItems`, `getSections`) do not pass available `orgId` for defense-in-depth WHERE clause; REST/tRPC callers also omit it — (plan review 2026-03-17; done 2026-03-17)
- [x] [P2] RLS infrastructure test coverage — `rls-infrastructure.test.ts` `RLS_TABLES` array missing 23 of 45 RLS tables — added all, unified org-policy assertion — (plan review 2026-03-17; done 2026-03-17)
- [x] [P3] Clean up redundant per-migration GRANTs — `init-db.sh` `ALTER DEFAULT PRIVILEGES` grants full DML to all tables, making per-migration `GRANT SELECT, INSERT, UPDATE` (without DELETE) on `sim_sub_checks`, `trusted_peers`, `inbound_transfers` effectively no-ops — (DEVLOG 2026-03-17; done 2026-03-17)
- [x] [P3] Vitest everywhere — replace Jest in `apps/web` with Vitest to eliminate test runner split (`vi.*` vs `jest.*`), deduplicate mock APIs, coverage configs, and setup patterns — (architecture review 2026-03-16; done 2026-03-17)

### Architecture Boundaries

- [x] [P3] Clarify BullMQ/Inngest boundary — document explicit ownership rule (e.g., "Inngest may emit domain events and schedule orchestration; BullMQ may only execute side-effecting delivery jobs"). Each job type (email, webhooks, file scans, notification fanout) should have a single obvious home. Decide based on failure modes: which system owns retries, idempotency, dead-letter behavior, concurrency limits, and observability — (architecture review 2026-03-16; done 2026-03-17)
