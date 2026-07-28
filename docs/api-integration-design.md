# Colophony — Integration Surface Design

> **Status:** Design / RFC — no implementation
> **Created:** 2026-07-27
> **Scope:** Two related problems that together determine whether Colophony can be
> integrated against rather than only operated as a standalone product.
>
> 1. **REST surface parity** — the public REST contract covers a subset of what the
>    product does, and there is no mechanism preventing that subset from shrinking further.
> 2. **Cross-org service principal** — an API key binds to exactly one organization and
>    acts as its creator, which fits a single magazine automating its own instance and
>    fits nothing else.
>
> **Prior art:** [`docs/api-layer-v2-research.md`](api-layer-v2-research.md) (2026-02-11)
> chose the surfaces and tooling. It predates the build in two ways that matter here: it
> assumes ts-rest (the build uses oRPC) and it treats API keys as a solved problem —
> "start simple (org-level keys), add scoping later" is listed as a _low_ risk in its
> Appendix C. Scoping was in fact added; tenancy was not.
> [`docs/architecture.md`](architecture.md) §5.5 records the surface decision;
> Open Question 6 defers managed-hosting billing, which is why several capabilities named
> below are absent from _both_ surfaces rather than missing from one.

---

## 0. Corrections to the framing

Everything in the brief was treated as a hypothesis and checked against the code. Six of
the eleven claimed gaps do not hold. Correcting them shrinks Problem 1 substantially and
moves two items out of "API parity" and into "product scope".

| Claimed gap                                               | Verdict                                                    | Evidence                                                                                                                                                                                                                                                                                          |
| --------------------------------------------------------- | ---------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Review pipeline: votes/scores, vote summaries             | **Already in REST**                                        | `POST/GET/DELETE /submissions/{id}/votes`, `GET /submissions/{id}/votes/summary` — `apps/api/src/rest/routers/submissions.ts`                                                                                                                                                                     |
| Reviewer assignments (assign, unassign)                   | **Already in REST**                                        | `GET/POST /submissions/{id}/reviewers`, `DELETE /submissions/{id}/reviewers/{reviewerUserId}`, `POST /submissions/{id}/reviewers/mark-read`, `POST /submissions/batch/assign-reviewers`                                                                                                           |
| Reviewer _rounds_                                         | **Does not exist anywhere**                                | No round concept on submissions. `contests.listGroupRounds` is a contest-bracket concept, unrelated to review rounds.                                                                                                                                                                             |
| Invitations: create, list, revoke, accept                 | **Already in REST**                                        | `GET/POST /organizations/{orgId}/invitations`, `DELETE .../{invitationId}`, `POST .../resend`, `POST /invitations/accept`                                                                                                                                                                         |
| Invitations: look up by token                             | **Does not exist anywhere**                                | `invitationService.acceptWithAudit(ctx, token)` consumes the token; there is no read-by-token procedure on either surface.                                                                                                                                                                        |
| Decisions: accept/reject/hold with a decision letter      | **Partly in REST; letter does not exist**                  | The decision itself is `PATCH /submissions/{id}/status`, already public. The string `decisionLetter` appears nowhere in the repository. The nearest capability is the tRPC-only `correspondence` router.                                                                                          |
| Payment/checkout initiation for submission fees           | **Does not exist on either surface**                       | No `checkout` call sites outside `adapters/payment/` and the inbound Stripe webhook. `submission_periods.fee` exists as a column but nothing charges it. `payment-transactions` / `revenue.service.ts` is an _outbound_ contributor-payments ledger gated on `BUSINESS_OPS`, not submission fees. |
| Billing and subscription state                            | **Does not exist on either surface**                       | No `subscription` references in routers or services. Deferred by architecture.md Open Question 6.                                                                                                                                                                                                 |
| Period lifecycle transitions (open/close), lookup by slug | **Not a state machine; no slug**                           | `submission_periods` has `opensAt`/`closesAt` timestamps and no `status` or `slug` column. "Transitioning" a period means editing timestamps, which `PATCH /periods/{id}` already does.                                                                                                           |
| File upload initiation                                    | **Confirmed gap in `/v1`, but a working precedent exists** | `POST /embed/:token/prepare-upload` and `/embed/:token/upload-status/:manuscriptVersionId` (`apps/api/src/routes/embed.routes.ts`) already do exactly this behind an embed token. Nothing equivalent is exposed under `/v1`.                                                                      |
| Notifications (list, mark read, non-SSE path)             | **Confirmed gap**                                          | tRPC `notifications` router only.                                                                                                                                                                                                                                                                 |
| Webhook endpoint management                               | **Confirmed gap**                                          | tRPC `webhooks` router only.                                                                                                                                                                                                                                                                      |
| Public discovery of open submission periods               | **Confirmed gap**                                          | `/v1/public/` contains only `orgs/:slug/response-time`, `demo-requests`, and `demo/login`.                                                                                                                                                                                                        |

Two consequences worth stating plainly before the rest of the document:

- **Submission-fee payments are a product gap, not a parity gap.** Building a REST
  checkout endpoint means building checkout. It should not be sequenced with the parity
  work.
- **The decision-letter capability does not exist.** If an integrator needs to issue a
  decision _with_ a letter, that is a feature, and `correspondence` is where it belongs.

### 0.1 Findings not in the brief

Five things surfaced during verification that change the recommendations.

**(a) `sdks/openapi.json` is already five months stale.** The committed spec was last
regenerated 2026-02-27 (`d7bf72b0`); the REST routers were last changed 2026-07-25. The
spec describes **103 operations across 67 paths**; the routers define **139 across 93**.
Missing from the published contract entirely: the whole `collections` router (10), the
whole `csr` router (2), all five invitation operations, submission discussions, resubmit,
reviewers, votes, batch operations, and the six submission analytics endpoints. The drift
the brief asks us to prevent has already happened, and the immediate cause is mechanical:
`scripts/export-openapi.ts` fetches `/v1/openapi.json` over HTTP from a **running dev
server**, so it cannot run in CI.

**(b) A drift check exists, has been green throughout, and validates the wrong direction.**
This is the more important half of (a) and it changes what M3 has to be.

`.github/workflows/ci.yml:1610` defines an `sdk-check` job named "SDK Drift Check". It
regenerates the TypeScript SDK **from the committed `sdks/openapi.json`** and fails if the
result differs from what is committed:

```yaml
npx openapi-typescript ../openapi.json -o src/generated/openapi.ts
# …
if ! git diff --quiet sdks/typescript/src/generated/; then
```

That asserts _SDK ↔ spec_ consistency. It never asserts _spec ↔ source_. Since the spec is
an input rather than a derived artefact, the job passes cheerfully while the spec falls 36
operations behind the routers — which is exactly what it did, for five months, on every
pull request.

This is worse than having no check. A job with "drift" in its name, green on every run,
is a positive signal that the contract is current. The backlog records this work as
complete ("generation script + CI drift check", 2026-02-27), and by its own terms it is —
the gap is in what was checked, not whether checking happened.

Consequences for the plan: M3 is not "add a drift check", it is **fix the direction of the
existing one**. And it must run against the routers, which is what makes M2 (offline
in-process generation) a hard prerequisite rather than a convenience. Under D4 the
SDK-regeneration half of this job disappears entirely, since generated SDKs stop being
committed.

**(c) There are no per-key rate limits.** `apps/api/src/hooks/rate-limit-auth.ts:57` keys
the authenticated window on `${prefix}:auth:${userId}`. For API-key auth, `userId` is the
key's _creator_. So today every key created by one admin already shares a single bucket
with every other key that admin created **and** with that admin's interactive browser
session. The brief's premise — "per-key limits assume one org's traffic" — overstates the
current state; there is nothing per-key to change, there is something per-key to add.

**(d) The audit trail cannot distinguish a key from its creator today.** `audit_events`
(`packages/db/src/schema/audit.ts:24`) has a single `actor_id`, and `BaseAuditParams`
(`packages/types/src/audit.ts:389`) carries no `apiKeyId`. The auth hook sets
`authContext.userId = creator.id` for key auth, so an action taken by a key and an action
taken by that human at a keyboard are recorded identically. The only place a key id is
ever written is `resourceId` on an `API_KEY_SCOPE_DENIED` event. Carrying two principals
is a schema change — and so is carrying _one_ principal accurately.

**(e) tRPC is not actually internal.** This is the most consequential finding.

Nothing restricts API-key authentication to the REST surface. The auth hook accepts
`X-Api-Key` on every non-public route, `/trpc/*` included, and scope enforcement in tRPC
is opt-in per procedure via `.use(requireScopes(...))`. Ten tRPC routers call it **zero
times**:

```
federation  gdpr  hub  migration  notification-preferences
notifications  ops  simsub  transfer  webhooks
```

Concretely: a key issued with the single scope `manuscripts:read` can call
`webhooks.create`, `webhooks.rotateSecret`, `federation.updateConfig`, `hub.revokeInstance`,
and `simsub.grantOverride` over tRPC. The only remaining gate is the org role of the key's
creator — and key creation is itself `ADMIN`-only, so in practice the creator very often
holds that role.

By contrast the REST surface is disciplined: **138 of 139 routes** carry `requireScopes`.
The single exception is `invitationsAccept`, which is a user-token flow and correct to
exempt.

Separately, `webhooks:manage` and `payments:read` are declared in `apiKeyScopeSchema` and
enforced nowhere.

This reframes Problem 1's second question. The boundary policy the brief proposes —
"REST is the public contract, tRPC is the frontend's private convenience" — is not a
statement about the current system that needs defending against future drift. It is a
statement that is **currently false**, and making it true is a security fix that should
land ahead of the parity work.

---

## Problem 1 — REST surface parity

### 1.1 Method

REST operations were extracted from `apps/api/src/rest/routers/*.ts` by parsing `.route({})`
blocks (139 operations), not from `sdks/openapi.json`, which is stale. tRPC procedures were
extracted from `apps/api/src/trpc/routers/*.ts` (301 procedures across 44 routers, including
nested `members`/`invitations` sub-routers). Deltas below were reconciled per router; the
arithmetic closes exactly on the two largest (submissions 40 → 29 with 11 named omissions;
organizations 15 tRPC / 15 REST).

### 1.2 Inventory — full parity

These routers are at or near complete parity. No action.

| Domain             | tRPC | REST | Notes                                                                          |
| ------------------ | ---: | ---: | ------------------------------------------------------------------------------ |
| api-keys           |    4 |    4 |                                                                                |
| audit              |    2 |    2 |                                                                                |
| cms-connections    |    6 |    6 |                                                                                |
| collections        |   10 |   10 | absent from published spec                                                     |
| contract-templates |    5 |    5 |                                                                                |
| contracts          |    6 |    6 |                                                                                |
| csr                |    2 |    2 | absent from published spec                                                     |
| forms              |   16 |   16 |                                                                                |
| organizations      |   15 |   15 | includes members + invitations                                                 |
| periods            |    5 |    5 |                                                                                |
| publications       |    5 |    5 |                                                                                |
| users              |    1 |    1 |                                                                                |
| files              |    4 |    3 | REST collapses `getDownloadUrl`/`getDownloadUrlOrg` into one route. Not a gap. |

### 1.3 Inventory — partial parity

| Domain      | tRPC | REST | Missing from REST                                                                                                                                                                                   |
| ----------- | ---: | ---: | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| submissions |   40 |   29 | `mySubmissionDetail`, `export`, `initiateTransfer`, `getTransfers`, `cancelTransfer`, `requestMigration`, `approveMigration`, `rejectMigration`, `getMigrations`, `findSiblings`, `withdrawCascade` |
| pipeline    |   14 |    9 | `getCopyeditContent`, `saveCopyedit`, `exportCopyeditDocx`, `importCopyeditDocx`, `dashboard`                                                                                                       |
| issues      |   14 |   13 | `activeIssues`                                                                                                                                                                                      |
| manuscripts |    9 |    8 | `getDetail`                                                                                                                                                                                         |

### 1.4 Inventory — no REST surface at all

| Domain                   | tRPC procs | Scoped?     | Assessment                                                                                                                |
| ------------------------ | ---------: | ----------- | ------------------------------------------------------------------------------------------------------------------------- |
| **webhooks**             |          9 | ✗ none      | **Blocking.** Integrators cannot register or rotate endpoints. `webhooks:manage` already exists and is unused.            |
| **notifications**        |          4 | ✗ none      | **Blocking.** Only path today is SSE (`/api/notifications/stream`), unusable for consumers that cannot hold a connection. |
| notification-preferences |          3 | ✗ none      | Supports the above.                                                                                                       |
| correspondence           |          4 | ✓           | Nearest thing to a decision letter.                                                                                       |
| email-templates          |          5 | ✓           | Needed to customise what a decision sends.                                                                                |
| editorial-analytics      |          7 | ✓           | Reporting.                                                                                                                |
| queue-presets            |          4 | ✓           | Editorial config.                                                                                                         |
| reader-feedback          |          6 | ✓           | Editorial.                                                                                                                |
| external-submissions     |          6 | ✓           | Writer-side.                                                                                                              |
| simsub-groups            |          9 | ✓           | Writer-side.                                                                                                              |
| portfolio-entries        |          4 | ✓           | Writer-side.                                                                                                              |
| writer-profiles          |          4 | ✓           | Writer-side.                                                                                                              |
| workspace                |          6 | ✓ (partial) | Writer-side aggregate.                                                                                                    |
| journal-directory        |          2 | ✓           | Writer-side discovery.                                                                                                    |
| contributors             |          8 | ✓           | Business ops.                                                                                                             |
| rights-agreements        |          7 | ✓           | Business ops.                                                                                                             |
| payment-transactions     |          7 | ✓           | Business ops (outbound ledger).                                                                                           |
| contests                 |         17 | ✓           | Large, self-contained.                                                                                                    |
| embed-tokens             |          3 | ✓           | Issues credentials for the embed surface.                                                                                 |
| gdpr                     |          1 | ✗ none      | `deleteAccount`. See §1.5.                                                                                                |
| federation               |          9 | ✗ none      | Instance administration. See §1.5.                                                                                        |
| hub                      |          4 | ✗ none      | Instance administration. See §1.5.                                                                                        |
| migration                |          7 | ✗ none      | Cross-instance identity moves. See §1.5.                                                                                  |
| simsub                   |          2 | ✗ none      | Admin override of sim-sub checks. See §1.5.                                                                               |
| transfer                 |          3 | ✗ none      | Cross-instance piece transfer. See §1.5.                                                                                  |
| ops                      |          3 | ✗ none      | Queue/webhook health. See §1.5.                                                                                           |

### 1.5 Deliberately internal-only

These should be marked internal and _excluded_ from the parity target, with the exclusion
enforced rather than assumed.

| Domain                                                 | Why internal                                                                                                                                                                                                                                                                                                                                                                                   |
| ------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `ops`                                                  | Queue depth, webhook provider staleness, submission trend. Operator telemetry for the dashboard. The supported external path is `/metrics` (Prometheus), already public and already scraped. Exposing it as REST creates a second contract for the same data.                                                                                                                                  |
| `federation`, `hub`, `transfer`, `migration`, `simsub` | Instance-level administration and server-to-server protocol. The federation S2S surface is already public and _separately_ authenticated via HTTP Message Signatures (RFC 9421) under `/federation/v1/`. The tRPC routers here are the _operator console_ for that surface, not an integration point. Exposing them to org-scoped API keys would let a tenant reconfigure instance-wide trust. |
| `gdpr.deleteAccount`                                   | Irreversible account erasure. Should require an interactive, re-authenticated human. Not something an integrator's credential should be able to do on a whim.                                                                                                                                                                                                                                  |
| `embed-tokens`                                         | Mints credentials for the public embed surface. Not internal in principle, but it is a credential-issuing endpoint and should follow whatever the principal model concludes in Problem 2, not precede it.                                                                                                                                                                                      |

Everything in this table is currently reachable by any valid API key (finding (e)).
Marking them internal is therefore not documentation — it is a change in behaviour.

### 1.6 The boundary policy

**Policy.** REST under `/v1` is the public contract. tRPC is the web frontend's private
transport. Both call the same service layer. Neither is allowed to be the only way to do
something that an external consumer legitimately needs.

The brief is right that this rots without a mechanism, and right that a shared service
layer, a contract test, or a lint rule are the candidates. They are not alternatives —
they address different failure modes, and two of the three are cheap.

**The shared service layer already exists and is already doing its job.** Both surfaces
import from `apps/api/src/services/`, both use `toServiceContext(ctx)`, both use
`mapServiceError`. That is why the 139 REST routes were mostly mechanical to write. It
prevents _behavioural_ divergence. It does nothing about _coverage_ divergence, which is
the actual problem.

Proposed mechanism, in the order it should land:

**M1 — Close the tRPC bypass (security, not hygiene). Default-deny.**

Add an `internalOnly` middleware to `apps/api/src/trpc/init.ts` that admits **only
interactive human sessions** and rejects everything else with `FORBIDDEN`:

```ts
const INTERACTIVE_AUTH_METHODS = ["oidc", "demo", "test"] as const;
// deny: 'apikey', any future credential class, and a null authContext
```

Apply it to the seven routers in §1.5. Then make scope enforcement non-optional everywhere
else: every tRPC procedure either declares `requireScopes(...)` or declares `internalOnly`.

**Both halves are P0, and the second is easy to lose.** The seven internal-only routers are
not the same set as the ten that enforce no scopes. Three routers —
`notifications`, `notification-preferences`, and `webhooks` — are in the unscoped set but
_not_ internal-only, because they are meant to get REST equivalents (P1.1, P1.2) and real
scopes. Shipping only the `internalOnly` half would leave those three reachable by any API
key with any scope, which is where they are today: `notifications.ts:13` uses a plain
`orgProcedure` with no scope guard.

So P0 must close **both**, and the coverage manifest (M4) is what keeps it closed: assert
that every tRPC procedure declares one or the other, and fail the build on a procedure that
declares neither. Until then the bypass is narrowed, not closed, and the document should not
claim otherwise.

**This must be an allowlist, not a denylist**, and the distinction is not stylistic. A
middleware written as `reject authMethod === 'apikey'` is correct only until the next
credential class exists — and this document's own P2.3 introduces one. The moment a
`col_svc_` principal carries a different `authMethod`, a denylist silently readmits it to
`federation.updateConfig`, `hub.revokeInstance`, and `simsub.grantOverride`, with _broader_
tenancy than the credential the rule was written to exclude. P0.1 and P2.3 are six PRs and
two reviews apart; nothing would connect them.

This is the same rule F3 (§2.3) states for org resolution — branch on what a principal
_is_, never on how it authenticated — applied to the surface it matters most on. Written as
an allowlist, every future credential class is excluded by construction and has to be
explicitly and visibly admitted.

This is the single highest-value change in this document.

**M2 — Make spec export deterministic and offline.**
`@orpc/openapi@1.14.10` exports `OpenAPIGenerator` (verified in
`dist/index.d.mts`). Rewrite `scripts/export-openapi.ts` to build the spec in-process from
the `restRouter` object with the same `ZodToJsonSchemaConverter` the server uses, removing
the running-server dependency. This is a prerequisite for everything below.

**M3 — Fix the direction of the existing drift check.**
Not a new job — `.github/workflows/ci.yml:1610` already has one, and it has been green
throughout (finding (b)). It regenerates the TypeScript SDK _from_ `sdks/openapi.json` and
asserts they match, which treats the spec as an input and can never detect the spec falling
behind the routers.

Invert it: regenerate `sdks/openapi.json` from the router objects (M2) and
`git diff --exit-code` **that**. This is what would have caught the 36-operation gap the day
it opened. Under D4 the SDK-regeneration half of the job is deleted rather than fixed, since
generated SDKs stop being committed — so the net change is a smaller job that checks the one
thing that matters.

**M4 — Fail CI on coverage drift.**
A test that asserts an explicit mapping. Every tRPC procedure must appear in exactly one
of three lists: _has a REST equivalent_, _internal-only (with a one-line reason)_, or
_deferred (with an issue reference)_. A new tRPC procedure that appears in none of them
fails the build. This is the lint rule the brief asked for, expressed as a test because
the data it needs — the router shapes — is only available at runtime.

M4 is deliberately a manifest rather than a heuristic. Automatic name-matching would be
defeated by the legitimate cases already in the codebase: REST collapsing
`getDownloadUrl`/`getDownloadUrlOrg` into one route, and REST expressing `castVote` /
`deleteVote` as `POST` / `DELETE` on one path. A manifest makes those explicit and forces
a decision on each new procedure at the moment it is written.

### 1.7 Sequencing

**Blocks a complete integrator workflow (intake → review → decision → notify):**

1. **Webhook endpoint management** (9 procs). Without it there is no push channel at all,
   so every integrator degrades to polling. `webhooks:manage` already exists as a scope.
   **The subscription model must be decided first — see §1.9.** This is the one place where
   Problems 1 and 2 are genuinely coupled.
2. **Notifications list / mark-read** (4 procs, + 3 preferences). The "notify" leg of the
   workflow has no pull path today.
3. **File upload initiation** (1–2 new routes). The intake leg is incomplete: an integrator
   can create a submission but cannot attach a manuscript without reverse-engineering the
   tus/tusd arrangement. `POST /embed/:token/prepare-upload` is a working template.
4. **Public discovery of open periods** (1–2 new routes). Without it an integrator cannot
   answer "what can I submit to right now" without credentials for every org.

Items 1–4 are the whole blocking set. The review and decision legs are already covered —
that is the main practical consequence of §0.

**Materially useful, not blocking:** submissions `export`, `mySubmissionDetail`,
`findSiblings`; manuscripts `getDetail`; issues `activeIssues`; pipeline copyedit
content operations; `correspondence`; `email-templates`; `editorial-analytics`.

**Deliberately deferred:** contests (17 procs, self-contained, no external demand
evidenced); business-ops (contributors, rights, payment-transactions — internal finance
workflows); writer-side routers (workspace, portfolio, writer-profiles, simsub-groups,
external-submissions) which serve the writer web app rather than an org integrator.

**Not parity work:** submission-fee checkout and billing state. Both are unbuilt features.

### 1.8 Downstream cost per endpoint

Measured against the current committed artefacts.

| Artefact            | Cost                                                   | Notes                                                                                                                                                |
| ------------------- | ------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
| oRPC procedure      | ~25–40 lines in `rest/routers/<domain>.ts`             | Handler is a thin adapter; the service method already exists for every gap in §1.3–1.4.                                                              |
| Response schema     | 0–20 lines in `@colophony/types`                       | Often already present — tRPC procedures declare `.output(...)`.                                                                                      |
| Scope constant      | 1 line, or 0                                           | `webhooks:manage` and `payments:read` already exist unused.                                                                                          |
| `sdks/openapi.json` | ~170 lines/operation                                   | 17,281 lines for 103 operations.                                                                                                                     |
| TypeScript SDK      | ~90 lines/operation, fully generated                   | 9,184 lines in `src/generated/openapi.ts`. No hand-written code.                                                                                     |
| Python SDK          | **~4.3 model files + ~1.15 api modules per operation** | 447 model files and 119 api modules for 103 operations, 6.1 MB committed. This is the dominant cost and it is committed wholesale to the repository. |
| Tests               | 1 spec file per router                                 | Only 7 of 17 REST routers have one today.                                                                                                            |

So the marginal cost of one endpoint is roughly **~65 lines hand-written, ~260 lines of
generated spec and TS, and ~5 new Python files**. Bringing the published spec up to the
139 operations that already exist would add roughly 6,000 lines of spec, 3,000 of TS, and
~155 Python files — before any new endpoint is written.

**The spec stays committed; the SDKs stop being committed.** These are two decisions, and
collapsing them is what makes the cost look unavoidable.

`sdks/openapi.json` **must** stay committed — it is the published contract and it is the
artefact M3 diffs. That is 17k lines and it is worth it.

The generated SDKs must **not**. They are derived, deterministic, and reviewed by nobody.
Keeping 6.1 MB and 447 Python files in the tree actively undermines M3: it turns every
regeneration into a several-thousand-file review event, and that friction is precisely why
the spec was allowed to sit five months stale. A drift check that is painful to satisfy
gets bypassed. Build and publish the SDKs from the committed spec in CI on release, and the
marginal cost of an endpoint drops to **~65 hand-written lines and ~170 lines of reviewable
spec diff** — with the TS and Python output falling out of the pipeline unreviewed, which is
the correct treatment for generated code.

This resolves the open question rather than deferring it, and it should land inside P0.2
where the generation path is already being rewritten.

### 1.9 Decision required before P1.1 — the cross-org webhook subscription model

Webhooks are simultaneously the highest-priority parity gap and the least-solved cross-org
problem, and shipping the first without deciding the second publishes the wrong contract.

**What exists.** `webhook_endpoints` is org-scoped with `organization_id NOT NULL` and RLS
(`packages/db/src/schema/webhook-endpoints.ts:20,36`). Fan-out is org-pinned end to end:
`inngest/functions/webhook-delivery.ts:27` reads `orgId` off the event, wraps the endpoint
lookup in `withRls({ orgId })`, and `getActiveEndpointsForEvent` filters
`WHERE organization_id = orgId AND status = 'ACTIVE'` with a JSONB containment test on
`event_types`.

**Why per-org registration is wrong for the consumer this document exists to serve.** An
integrator operating N organizations gets no instance-level subscription and no fan-in. It
registers N endpoints one `X-Organization-Id` request at a time, stores and rotates N
secrets, and demultiplexes by org itself. Every org onboarded is another registration call
and another secret in its vault. That is a per-org product feature — correct for a magazine
automating itself, and the wrong shape for a host platform.

This is also why §3's parallelism claim does not hold universally. Elsewhere, tenancy lives
in a header the route never sees, so route signatures are unaffected. Here tenancy is in the
_resource model_, and the resource model is the contract.

**Recommendation: a separate `principal_subscriptions` table, not a nullable
`organization_id`.**

This is the same argument that chose Approach B over Approach A in §2.4, and it applies
with more force here. Making `webhook_endpoints.organization_id` nullable would produce
rows invisible to that table's own RLS policy — and this policy is stricter than most:
it uses raw `current_setting('app.current_org')::uuid`, which **raises** when the setting is
absent rather than returning NULL (see §2.3, F6). A NULL-org row would be unreachable
through every existing management path.

The split has one property worth stating, because it is what makes it cheap:
**`webhook_deliveries` does not change.** A delivery always concerns exactly one org, so
`webhook_deliveries.organization_id NOT NULL` stays correct and its RLS stays intact for
both subscription kinds. One delivery log, one signature scheme, one retry policy, one
auto-disable rule — two subscription scopes. Integrators get the same semantics they would
have got per-org, which is the thing that actually matters for a published contract.

|                | Per-org endpoint                | Instance subscription                       |
| -------------- | ------------------------------- | ------------------------------------------- |
| Table          | `webhook_endpoints` (unchanged) | `principal_subscriptions` (new, no RLS)     |
| Owner          | organization                    | service principal                           |
| Registered via | `POST /v1/webhooks` (P1.1)      | principal management surface (P2.5)         |
| Secrets        | one per org                     | one per subscription                        |
| Event filter   | `event_types` JSONB             | `event_types` JSONB + grant set             |
| Deliveries     | `webhook_deliveries`            | `webhook_deliveries` (same table, same RLS) |

**The security-critical part is fan-out, not registration.** An instance subscription must
receive events only for orgs the principal currently holds a grant on. That check runs in
`webhook-delivery.ts`, a background Inngest function with no request context and no
`authContext` — so grant enforcement cannot reuse any of the request-path middleware. It
becomes a second lookup in the `get-endpoints` step, joining subscriptions to
`service_principal_grants` on the event's `orgId`, outside `withRls({ orgId })` because
neither table is org-scoped. Consequences:

- A revoked or expired grant must stop deliveries **at fan-out**, not at registration.
  Grant revocation is otherwise silently ineffective for the one channel that keeps
  flowing without anyone making a request.
- An org-side revocation (§2.5) must have the same effect, on the same path.
- This is worth its own RLS/integration test: event for org A, principal granted only on
  org B, assert zero deliveries created.

**Fan-out filtering alone is still not enough, and this is the sharpest hole in the
design.** Checking grants at fan-out only prevents _new_ deliveries being created. The
existing pipeline serialises the endpoint URL and secret into the BullMQ job payload
(`webhook-delivery.ts:44,63`) and the worker sends what the job carries without
re-reading anything (`webhook.worker.ts:23`). The webhook queue retries **8 times with
backoff out to 1 hour** (`webhook.queue.ts`). So a revoked principal —
or an org that has just withdrawn a grant — keeps receiving events from already-queued jobs
for up to an hour after revocation, and nothing in the design as first written would stop
it.

That directly undercuts §2.5's central claim. Revocability is the reason Approach B was
chosen; a control that leaves an hour of live delivery to a revoked party is not the
property that argument promised. The requirement:

- Persist `principal_id` / `subscription_id` on the delivery row, not only in the job
  payload.
- **Revalidate immediately before every send** — subscription active, principal not
  revoked, grant present and unexpired, org revocation not set — and mark the delivery
  `CANCELLED` rather than sending if any check fails. The worker already re-runs
  `validateOutboundUrl()` per attempt for exactly this class of reason (a value captured
  at enqueue time may no longer be trustworthy at send time); authorisation belongs in the
  same place.
- Look the URL and secret up at send time rather than trusting the job payload, so a
  rotated secret or edited URL cannot be replayed from an old job.
- On revocation, proactively drain pending jobs for that principal.

Note this is a **pre-existing weakness generalised**, not one the principal model invents:
the same gap means today's org-scoped endpoint keeps receiving queued deliveries after it
is deleted or disabled. It is worth fixing on the existing path first, where the blast
radius is one org.

**SSRF applies to the new subscription type too.** The existing path validates at
registration (`webhook.service.ts:63`) _and_ again per delivery attempt
(`webhook.worker.ts:37`, with failures treated as permanent so retries cannot amplify DNS
rebinding). `principal_subscriptions` introduces another user-controlled outbound URL and
must meet the same bar: `validateOutboundUrl()` on create, on update, and immediately
before every send. This is an acceptance criterion for P2.7, not an implementation detail.

**What this means for sequencing.** P1.1 can ship its per-org routes unchanged _provided_
this decision is taken first, because the recommendation leaves `webhook_endpoints` and its
REST shape exactly as they are. If instead the nullable-org route were chosen, P1.1 would be
publishing a contract that has to change. The decision is cheap; taking it late is not.

### 1.10 Decision required before Phase 1 — idempotency for integrator writes

The design as originally written gave integrator writes no idempotency key. That is an
omission, not a deferral: retries are the normal condition for machine clients — timeouts,
proxy resets, queue redelivery — and the blocking set in §1.7 includes submission creation,
plus `POST /submissions/batch/status` and `POST /submissions/batch/assign-reviewers`, which
are already public. A client that cannot safely retry a batch status transition will either
not retry (losing writes) or retry blind (duplicating them).

It belongs with the other pre-Phase-1 decisions for the same reason webhooks do: an
`Idempotency-Key` header is part of the published contract and of both generated SDKs, so
adding it later is a contract change rather than an addition.

**The codebase already has the pattern.** Stripe webhook handling uses two-step
idempotency — INSERT the event row, check the `processed` flag, skip if already true
(`apps/api/src/webhooks/stripe.webhook.ts`, `stripe_webhook_events`). The Zitadel and tusd
handlers do the same with their own keys. The shape generalises:

- `Idempotency-Key` request header on `POST` routes under `/v1` — optional for interactive
  callers, effectively mandatory for integrators.
- A table keyed on `(credential_id, idempotency_key)` storing response status and a body
  hash, with a TTL (24h is the common convention).
- Replay returns the original response rather than re-executing. A key reused with a
  _different_ body is a `409`, not a silent replay — that distinction catches client bugs
  instead of hiding them.
- Scoped to the credential, never global, so one integrator cannot probe or collide with
  another's keys.

Two things make this cheaper here than it looks. `dbContext` already wraps each request in
one transaction that commits on `onResponse` and rolls back on `onError`, so the
idempotency record and the effect it guards commit or fail together — there is no
distributed-commit problem to solve. And the header is available at `onRequest`, alongside
org selection (F5), so it needs no new plumbing.

**A unique key plus the request transaction is not by itself a protocol, though.** Two
requests carrying the same key can both begin before either commits, and a plain
"check-then-insert" lets both execute. The transaction boundary makes each atomic; it does
not serialise them against each other. So the mechanism has to be:

1. `INSERT … ON CONFLICT DO NOTHING` on `(credential_id, idempotency_key)` as the **first**
   statement in the request transaction, storing a `request_hash` and status `IN_PROGRESS`.
2. Zero rows inserted means a concurrent or prior request owns the key. Re-read it:
   - `IN_PROGRESS` → `409` with `Retry-After` (the honest answer; pretending to succeed
     would be worse than making the client wait).
   - `COMPLETED` with a matching `request_hash` → replay the stored status and body.
   - `COMPLETED` with a differing hash → `422`, key reused for a different request.
3. On response, update the row to `COMPLETED` with the status and body inside the same
   transaction that commits the effect.

The row's insert competing for the unique index is what serialises the two callers, which
is why step 1 has to come first rather than after the handler has done its work.

I am not confident about the scope. Applying it to every `POST` is the clean rule but
touches routes no integrator will use; applying it only to the blocking set is cheaper and
leaves the contract inconsistent. My inclination is the clean rule, enforced by the same
manifest test as M4 — but that is a decision to take, not an assumption to inherit.

---

## Problem 2 — Cross-org service principal

### 2.1 Verified current state

| Fact                                                                                                                                      | Location                                                                                |
| ----------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------- |
| `api_keys.organization_id` is `NOT NULL`, FK to `organizations`                                                                           | `packages/db/src/schema/api-keys.ts:18`                                                 |
| `api_keys` RLS is `organization_id = current_org_id()` for both select and modify                                                         | ibid. `:38–46`                                                                          |
| Key lookup bypasses RLS via `verify_api_key()` SECURITY DEFINER                                                                           | `packages/db/migrations/0008_api_keys_rls.sql:9`                                        |
| Auth sets `userId` to the key's **creator** and pre-sets `orgId` from the key                                                             | `apps/api/src/hooks/auth.ts:313–321`                                                    |
| Org-context **early-returns** for `authMethod === 'apikey'`, ignoring `X-Organization-Id`, and 403s if the creator has since left the org | `apps/api/src/hooks/org-context.ts:20–61`                                               |
| Scopes are flat strings on a JSONB column, 54 values                                                                                      | `packages/types/src/api-key.ts:7–65`                                                    |
| Hook order, all `onRequest`                                                                                                               | `rateLimit → auth → rateLimitAuth → orgContext → dbContext → audit` (`main.ts:193–198`) |
| `current_org_id()` returns `NULL` when unset                                                                                              | `migrations/0000_extensions_and_functions.sql:10`                                       |
| 29 schema files carry RLS across 60 tables; **`users` and `organizations` do not**                                                        | see §2.3                                                                                |

### 2.2 The two capabilities are genuinely separate

The brief is right to insist on this, and the code makes the reason concrete.

**(a) Instance-scoped principal.** Selects an org per request instead of inheriting one,
and can provision new orgs. This is a change to _tenancy resolution_ — it lives in the
org-context hook and a grant table.

**(b) Acting-as a specific end user.** Changes whose identity the request carries for
authorship, permission evaluation, and audit. This is a change to _identity resolution_ —
it lives in the auth hook, the audit schema, and the permission middleware.

They compose but neither implies the other. An instance principal with no acting-as is a
useful thing (provisioning, back-office reporting). Acting-as _without_ cross-org scope is
also useful — an org-bound key that files a submission as a real writer rather than as the
admin who created the key. Designing them together would produce a single tangled
middleware; designing them separately produces two comprehensible ones.

### 2.3 RLS interaction and failure modes

`current_org_id()` returning `NULL` means `organization_id = current_org_id()` evaluates to
`NULL`, which PostgreSQL treats as not-true. So on the 24 RLS-covered schema files, a
request that reaches the database with no org set **reads nothing and writes nothing**.
That is fail-closed and it is the right default.

Five failure modes need explicit handling.

**F1 — The un-RLS'd tables.** `users` and `organizations` have no RLS at all (alongside
`federationConfig`, `hubRegisteredInstances`, `outboxEvents`, and the webhook-event
dedup tables). Cross-org isolation on those two is enforced _only_ by explicit
`WHERE` clauses in the service layer. Today that is adequate because every principal is
already pinned to one org and the surface that reads them is small. An instance principal
removes the pin. Any service method touching `users` or `organizations` that does not
filter explicitly becomes a cross-tenant enumeration path the moment such a principal
exists. **This must be audited method-by-method before (a) ships**, and it is the single
largest correctness risk in this design.

**F2 — Wrong org selected.** Today the guard is the membership check in
`org-context.ts:112–133`: the caller must have a row in `organization_members`. An
instance principal has no such row by construction, so that check must be _replaced_, not
skipped, by a grant lookup with identical properties — fail closed, 403, and resolved
before `dbContext` opens the transaction.

**F3 — The `authMethod` branch is load-bearing and fragile.** `org-context.ts:21` branches
on `authMethod === 'apikey'` and returns early, which is what stops today's org-bound key
from being redirected by an `X-Organization-Id` header. If a cross-org key reuses that
branch, the early return has to become conditional — and if anyone later simplifies it
away, header-driven org selection silently becomes available to _every_ key, including
org-bound ones. The branch must therefore be on **principal type** (a property of the
credential record) and never on auth method.

**F4 — `dbContext` requires a user id to open a transaction at all.**
`db-context.ts:44` returns early unless `authContext.userId` is set, leaving `dbTx` null;
`requireOrgContext` then throws `INTERNAL_SERVER_ERROR`. An instance principal acting as
nobody has no natural `app.user_id`. Two bad options and one good one:

- Synthesising a placeholder UUID is unsafe: `current_user_id()` drives the manuscript
  ownership policies, and a synthetic value that ever collides with a real user id fails
  _open_ on user-scoped data.
- Reusing the human who created the principal reintroduces exactly the attribution problem
  this design is meant to solve.
- **Leave `app.user_id` unset** and let user-scoped RLS fail closed. This means an instance
  principal cannot touch manuscript-owned data without acting-as — which is the correct
  constraint, stated as a mechanism rather than a rule.

`dbContext` must therefore be changed to open the transaction when _either_ a user id or an
org id is resolved, not only on user id.

**F5 — Org selection must be resolvable at `onRequest` time.** Every hook in the chain is
`onRequest`; the transaction is open and the org is bound before the body is parsed and
before oRPC routing has happened. So the target org **cannot** come from the request body.
It must come from a header or the URL path. Reusing the existing `X-Organization-Id` header
is the right answer — it is already the org-selection mechanism for OIDC sessions, it is
already validated as a UUID, and it keeps one concept instead of two.

**F6 — Three RLS idioms are in use, and they fail differently.** 29 schema files call
`enableRLS()`, covering 60 tables. The policies split as:

| Idiom                                        | Unset behaviour                        | Files                                                                    |
| -------------------------------------------- | -------------------------------------- | ------------------------------------------------------------------------ |
| `current_org_id()`                           | NULL → policy not-true, reads nothing  | 24 (**preferred**)                                                       |
| `current_setting('app.current_org')::uuid`   | **raises** → query 500s                | `notifications`, `notifications-inbox`, `webhook-endpoints`, `transfers` |
| `current_setting('app.user_id', true)::uuid` | NULL → not-true (user-scoped, not org) | `identity-migrations`, `user-keys`                                       |

`transfers.ts` uses two of them — `current_org_id()` at `:79` and the raw form at `:115` —
so the sets overlap and do not sum to 29.

All three are fail-closed, so this is not a vulnerability. It matters for two reasons.
First, a principal-only request (F4, no org context) touching those four tables gets a 500
rather than a clean empty result — a worse operator experience that will be mistaken for a
bug. Second, the raw idiom makes a nullable `organization_id` strictly unworkable on those
tables, which is what §1.9 turns on. Note the user-scoped policies already use the
`missing_ok` form, so F4's "leave `app.user_id` unset" resolution reads cleanly against
them. Worth normalising the four org-scoped outliers on `current_org_id()` as a standalone
cleanup; not urgent, but it should be a deliberate choice rather than an accident of who
wrote which file.

### 2.4 Approaches

#### Approach A — Widen `api_keys`

Make `organization_id` nullable; a NULL means instance-scoped. Add an
`api_key_org_grants` table for the tenancy axis.

_For:_ smallest diff; reuses `verify_api_key()`, the existing key format, the existing
management UI and REST router.

_Against:_ the RLS policy on `api_keys` is `organization_id = current_org_id()`. A row with
`organization_id IS NULL` is invisible to **every** org context, so an instance key could
be created but never listed or revoked through the normal org-scoped API — the management
surface would need its own RLS-bypassing path, which is most of the work Approach B does
openly. It also puts two credentials with radically different blast radii in one table, one
list view, and one revoke button. `col_live_` keys would no longer mean one thing.

#### Approach B — Separate `service_principals` table and credential type

A new instance-level table, a distinct credential prefix (`col_svc_`), and a
`service_principal_grants` table carrying `(principal_id, organization_id, capabilities,
expires_at)`.

**"No RLS" is not the whole precedent, and stating it that way would be unsafe.** An earlier
draft of this section said the new table follows `hubRegisteredInstances` /
`federationConfig` in simply omitting RLS. That reading is wrong: those tables are safe
because migration `0029_hub_tables.sql:67` explicitly removes them from the application
role —

```sql
REVOKE ALL ON "hub_registered_instances" FROM "app_user";
REVOKE ALL ON "hub_fingerprint_index"    FROM "app_user";
```

Without that revoke, "no RLS" on a table holding every credential in the instance means any
application-path mistake becomes instance-wide credential enumeration or mass revocation —
strictly worse than the nullable-org row Approach A was rejected for. The requirement is
therefore:

- `service_principals`: no RLS **and** `REVOKE ALL … FROM app_user`. Reads go through a
  narrowly scoped `SECURITY DEFINER` function (the `verify_api_key()` pattern), writes
  through the privileged management path only.
- `service_principal_grants`: **RLS enabled with `FORCE`**, plus an explicit
  `organization_id` filter in every service method (defence in depth, per the project rule).
  This table is org-scoped precisely so the org-facing views in §2.5 can read it safely.
- Same three-place `REVOKE` discipline the codebase already uses for append-only tables:
  migration, `scripts/init-db.sh`, `scripts/init-prod.sh` — `GRANT` is additive, so a
  per-migration grant that merely omits a privilege is a no-op.

_For:_ the two credential classes are never confusable — in code, in logs, in the UI, or in
a leaked-secret scanner. Management routes can be registered only when the feature is
enabled, so a self-hoster's surface is unchanged. Acting-as and grants attach to a record
that exists for exactly that purpose.

_Against:_ a second authentication branch in `auth.ts`; a second management surface; a
second set of tests. Roughly 3–4 new tables/columns versus 2.

#### Approach C — Zitadel OAuth2 client credentials

Model integrators as Zitadel service users, get client-credentials and token lifetime for
free, and project Colophony orgs into Zitadel orgs for the tenancy axis.

_For:_ no new credential format; short-lived tokens by default; Zitadel already has native
multi-tenancy, which architecture.md §5.3 cites as a selection reason.

_Against:_ Colophony orgs are **not** Zitadel orgs today. Users sync one-way via webhook
into a local `users` table; there is no per-Colophony-org Zitadel projection and building
one is a large piece of work with its own consistency failure modes. It also moves the
authorisation model into an external AGPL service for a decision the database should own,
and every non-Zitadel path (`DEMO_MODE`, `DEV_AUTH_BYPASS`, the test-header path) would
need a parallel implementation. The grant model — which is the actual hard part — is not
something Zitadel gives us.

### 2.5 Recommendation

**Approach B.**

The deciding argument is not elegance, it is revocability — and that argument only holds if
the lookup path actually honours it, so state the requirement rather than assuming it:

- **No caching of principal, grant, or revocation state**, or a bounded cache with explicit
  invalidation on revoke. Today `apiKeyService.verifyKey()` hits the database on every
  request with no cache; that property is what makes "revoked" mean revoked, and it must be
  preserved deliberately rather than optimised away later.
- Every request re-reads `revoked_at` on the principal, `expires_at` on the grant, and
  `revoked_by_org_at` — not just principal existence.
- Revocation must also reach already-queued webhook deliveries (§1.9), which is the one
  path that keeps running without a request.

"A row in a table an operator can delete" is a necessary condition, not a sufficient one.
With those three points it is sufficient; without them Approach B's advantage over the
alternatives is smaller than it looks.

The one property an instance principal must have above all others is that it can be
enumerated and killed instantly and unambiguously. Approach A's NULL-org row is invisible to the RLS policy that governs its
own management table, so the fastest path to "revoke everything" runs through a bypass
that has to be built specially anyway. Approach C makes revocation depend on an external
service being reachable. Approach B makes it a row in a table the instance owns, with no
RLS between an operator and that row.

The secondary argument is blast-radius legibility. `col_live_` and `col_svc_` are different
things and should look different everywhere — in `git-secrets` patterns, in log redaction,
in the audit trail, and in the mind of whoever is reading an incident timeline.

#### Scope model

Keep capability strings **flat and unchanged**. Add tenancy as a _separate axis_ carried by
the grant, not by the scope string.

```
capability   := existing flat strings ("submissions:read", "webhooks:manage", …)
tenancy      := a row in service_principal_grants (principal, org, capabilities, expiry)
effective    := capabilities(principal) ∩ capabilities(grant for selected org)
```

**Both sides of that intersection need somewhere to live, and the first draft only defined
one.** `capabilities(principal)` is a column on `service_principals` — the ceiling the
principal can ever exercise, set at creation. `capabilities(grant)` is a column on
`service_principal_grants` — what one organization has consented to, which can never widen
the ceiling. An empty or absent grant yields the empty set, so a principal with no grant on
the selected org can do nothing. That is F2's 403, expressed as set arithmetic.

**One authorisation function, not two code paths.** Today's middleware chain evaluates org
_roles_ (`rest/context.ts:77` — `requireOrgContext`, `requireEditor`, `requireAdmin`), and
principals have no role. The temptation is to synthesise one — grant the principal `ADMIN`
so the existing guards pass. **That fails open** and must be ruled out explicitly: a
synthetic `ADMIN` would sail through every role guard in the codebase regardless of what the
grant said.

Instead, one resolver produces an effective capability set for any principal type, and the
role guards consult it:

| Caller                  | Effective set                                                |
| ----------------------- | ------------------------------------------------------------ |
| Human (OIDC)            | derived from org role, as today — unchanged                  |
| Org API key             | key scopes ∩ creator's org role, as today — unchanged        |
| Principal, no acting-as | `capabilities(principal) ∩ capabilities(grant)`; **no role** |
| Principal + acting-as   | the above ∩ target user's org role                           |

A principal-only request carries no role, so any procedure requiring one (`requireEditor`,
`requireAdmin`) must **fail closed** unless it has been explicitly re-expressed in terms of
capabilities. That is more work than bolting a role on, and it is the only version that
cannot silently escalate.

Rejected: blanket instance access (no bound on damage), and encoding the org into the scope
string (`org:<uuid>:submissions:read` — unbounded enum, breaks the Zod enum, breaks the
generated SDKs, and makes revoking one org's access a string-surgery operation).

**Per-org grants, always.** An instance principal with no grant for the selected org gets
403 — the same shape of answer the membership check gives today. Provisioning is a separate
capability (`orgs:provision`) that does _not_ imply a grant on the org it creates; creating
an org and then operating it are two authorisations. That is slightly more friction and it
is the right trade: it means a leaked provisioning credential creates junk orgs rather than
reading existing ones.

#### Grants must be visible and revocable by the organization, not only the operator

A grant as described so far is created and revoked by the instance operator. In a
single-magazine self-host that is unobjectionable — operator and org are the same party. In
the hosted case this entire document exists to serve, it means an organization cannot see
that a third party holds standing access to its submissions, and cannot withdraw it.

That is a values gap before it is a design gap. Colophony's stated positioning is control
over your own infrastructure and data without lock-in; a tenant who cannot enumerate who
holds keys to their data does not have that, whatever the deployment topology says. It is
also the difference between a grant and a fait accompli.

The fix is small and should be in the model from the start rather than retrofitted:

- **`service_principal_grants` carries `organization_id`, so it can carry RLS** for the
  org-facing read while instance-facing management uses the non-RLS path. One table, two
  audiences, no duplication. This is the one place the design benefits from a grant row
  being org-scoped.
- **Org-side read:** `GET /v1/organizations/{orgId}/grants` — which principals hold what
  capabilities, granted when, expiring when, last used when. `organizations:read`.
- **Org-side revoke:** `DELETE /v1/organizations/{orgId}/grants/{grantId}`, `ADMIN` only.
- **Org revocation is sticky.** A separate `revoked_by_org_at` column that the operator
  path cannot clear. If an operator can silently re-grant what an org just revoked, the
  control is theatre — restoring access has to require fresh consent from the org, not a
  second operator action. This is the only part of the mechanism with any subtlety, and it
  is one column plus one check.
- Revocation takes effect on the **fan-out path** as well as the request path (§1.9), or
  webhook deliveries continue after an org has withdrawn access.

Cost: one list view, one `revoked_by_org_at` check, two REST routes. Worth adding before
the model is built rather than after someone asks why they cannot see it.

#### Acting-as

- **Identification:** `X-Act-As-User` header carrying a Colophony user UUID. Header, not
  body, for the F5 reason. A UUID, not an email, so it cannot be spoofed by an
  address the integrator controls.
- **Authorisation:** the target user must be a member of the _selected_ org. This is what
  stops an integrator naming a user in an org it has no grant for: the grant check
  (§F2) runs first and 403s before the acting-as lookup happens at all. The two checks
  are ordered, not combined.
- **Effective permissions:** **the intersection** of the principal's granted capabilities
  and the target user's org role. Not the user's role alone. An integrator granted
  read-only on an org must not be able to escalate by acting as that org's admin —
  impersonation is a way to _attribute_ an action, never a way to acquire an authority the
  principal was not granted.
- **Attribution:** `app.user_id` is set to the target user, so user-scoped RLS and
  `submitterId` behave exactly as if the person had acted. That is the entire point.

For v1, restrict acting-as to users who are members of the selected org. Acting as a
_submitter_ — who by design has no org membership (architecture.md Open Question 1) — is a
genuinely useful case for a host platform filing submissions on a writer's behalf, but it
needs a consent model that does not exist yet. Defer it explicitly rather than letting it
arrive by omission.

#### Audit

This is a schema change, and it is one that fixes an existing defect (finding (d)).

Add to `audit_events`:

| Column                   | Meaning                                                          |
| ------------------------ | ---------------------------------------------------------------- |
| `principal_id uuid`      | the acting credential — `service_principals.id` or `api_keys.id` |
| `principal_type varchar` | `service_principal` \| `api_key` \| `null` for a direct human    |

Keep `actor_id` as the **effective** user. Then:

- direct human → `principal_id` NULL, `actor_id` = the human
- org API key → `principal_id` = key id, `actor_id` = creator _(this alone fixes today's
  ambiguity)_
- instance principal, no acting-as → `principal_id` set, `actor_id` NULL
- instance principal acting-as → `principal_id` set, `actor_id` = the impersonated user

Note the constraint that `audit_events` is written through the `insert_audit_event()`
SECURITY DEFINER function and the table is `SELECT`-only for `app_user`
(migration `0054_revoke_journal_audit_permissions.sql`). Adding columns means changing that
function in the same migration, and `CREATE OR REPLACE FUNCTION` cannot change a return
type — a `DROP` + `CREATE` may be required.

Backfill is a no-op: NULL `principal_id` correctly means "we do not know", which is the
truth for every historical row.

#### Rate limiting

Three changes to `hooks/rate-limit-auth.ts`:

1. **Key on the credential, not the creator.** When `apiKeyId` (or `principalId`) is
   present, use it in the Redis key instead of `userId`. This introduces per-key limits,
   which do not exist today (finding (c)), and stops a key from consuming its creator's
   interactive budget.
2. **Key instance principals on the `(principal, org)` pair.** Otherwise one busy tenant
   exhausts the shared window and the failure presents as an outage for every other org the
   integrator serves.
3. **Give the principal its own ceiling.** `RATE_LIMIT_AUTH_MAX` is sized for one human. An
   instance principal legitimately aggregates many orgs' traffic and needs a separate,
   higher, configurable limit — with the per-org sub-limit from (2) preventing that higher
   ceiling from being spent entirely on one tenant.

**(2) cannot be implemented where the other two are, and the first draft of this section was
wrong to imply it could.** `rateLimitAuthPlugin` is registered at `main.ts:195`,
`orgContextPlugin` at `:196` — so the authenticated limiter runs **before** org resolution.
At that point `X-Organization-Id` is an unvalidated client-supplied header and no grant has
been checked. Keying a limit on it would let a caller mint a fresh bucket per header value
and bypass the limit entirely.

This works today only by accident: for org-bound API keys the auth hook has already set
`orgId` from the key record itself (`auth.ts:320`), so it is trustworthy at that point. An
instance principal's org comes from the header, and it is not.

Split it into two tiers:

| Tier              | Where                                               | Key                        | Trustworthy because                |
| ----------------- | --------------------------------------------------- | -------------------------- | ---------------------------------- |
| Credential-level  | `rate-limit-auth.ts` (unchanged position)           | `principalId` / `apiKeyId` | comes from the verified credential |
| Per-org sub-limit | **new check after `orgContext` resolves the grant** | `(principal, org)`         | org validated, grant confirmed     |

Note that the pre-auth IP limiter (`hooks/rate-limit.ts`) is the only thing standing
between an instance principal and a burst during the auth lookup itself, and it is
graceful-degrade-on-Redis-failure (`rate-limit-auth.ts:77–83`). Fail-open on Redis outage is
defensible for a per-user limit; it is worth a second look for a credential of this size.

#### Revocation and blast radius

Ordered by value per unit of effort:

| Control                                               | Effort                         | Why                                                                                                                                                                                                                                                                                                           |
| ----------------------------------------------------- | ------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Mandatory per-org grants**                          | in the design                  | The primary bound. No blanket access means a compromise is limited to orgs someone explicitly consented to.                                                                                                                                                                                                   |
| **Per-grant `expires_at`**                            | 1 column                       | Grants decay unless renewed. Turns "we forgot to revoke" into a bounded window.                                                                                                                                                                                                                               |
| **Instant principal-level kill**                      | 1 column                       | `revoked_at` on `service_principals`, checked in the same lookup as expiry. No RLS between an operator and this row (Approach B).                                                                                                                                                                             |
| **`orgs:provision` separated from data capabilities** | in the design                  | A leaked provisioning credential cannot read.                                                                                                                                                                                                                                                                 |
| **IP allowlist**                                      | 1 column (CIDR array), 1 check | Integrators run from stable infrastructure, unlike humans. Cheap and disproportionately effective.                                                                                                                                                                                                            |
| **Mandatory audit retention for principal actions**   | policy + retention exclusion   | An instance principal's trail must outlive normal retention or a compromise becomes unreconstructable.                                                                                                                                                                                                        |
| **Credential hygiene parity with `api_keys`**         | reuse the existing pattern     | SHA-256 hash stored, plaintext shown once, rotation, `expires_at`. `col_svc_` must not be weaker than `col_live_` given it is the higher-value secret. Note `api_keys.keyPrefix` stores the literal constant `'col_live_'` rather than a per-key prefix, so it cannot identify a key — do not copy that part. |
| **Audit the control plane, not just the data plane**  | audit action constants         | Principal creation, grant issue/revoke (operator and org side), impersonation attempts including denials, IP-allowlist rejections, and subscription changes. A compromise of the management surface is otherwise invisible.                                                                                   |
| **Short-lived exchanged tokens**                      | new endpoint + token store     | Best control, highest cost. Recommend deferring to a second iteration; the long-lived secret plus IP allowlist plus grant expiry is a defensible interim.                                                                                                                                                     |

#### Inertness for self-hosters

`SERVICE_PRINCIPALS_ENABLED`, defaulting `false`, following the `FEDERATION_ENABLED`
pattern in `apps/api/src/config/env.ts:118`. When false:

- `auth.ts` never inspects the `col_svc_` prefix — the branch is not merely skipped, it is
  not registered
- management routes are not registered (`main.ts` conditional `app.register`, matching how
  federation routes are already gated)
- no navigation entry, no UI
- the migration still runs, creating empty tables — the correct trade, since a
  conditionally-applied migration is worse than three unused tables

A single magazine running its own instance sees exactly what it sees today.

### 2.6 Things I am not confident about

Called out per the brief's instruction to flag rather than paper over.

1. **The `users` / `organizations` no-RLS exposure (F1) is the biggest unknown.** I verified
   the tables lack RLS and that isolation depends on service-layer filtering. I did **not**
   audit all 66 service modules for unfiltered reads. That audit is a prerequisite for (a),
   not a follow-up, and it may change the effort estimate materially.
2. **Whether `PgBouncer` transaction pooling interacts with leaving `app.user_id` unset.**
   The `SET LOCAL` contract is sound in transaction mode, but I have not tested the
   specific case of setting `app.current_org` without `app.user_id` on a pooled connection.
   Worth an explicit RLS integration test before relying on F4's resolution.
3. **Grant-filtered webhook fan-out (§1.9) has no request context to lean on.** Every other
   authorisation check in this design runs in the middleware chain. This one runs inside an
   Inngest step, so it reuses none of that machinery and none of its tests. I am confident
   it is the right place for the check and less confident it will be got right first time.
   It is the reason P2.7 carries the highest risk rating in Phase 2.
4. **Whether the sticky `revoked_by_org_at` semantics survive contact with support
   workflows.** An org revoking a grant by mistake, then wanting it back, becomes a
   consent round-trip rather than an operator fix. That is the correct default and it will
   generate support load; whether the friction is tuned or removed is worth revisiting once
   there are real tenants.

_Resolved since first draft:_ acting-as on decisions (now §7 Q1, deny by default) and the
generated-SDK question (now D4, stop committing them).

---

## 3. Sequencing: which problem first

The brief proposes deciding Problem 2 before building out Problem 1, on the grounds that
tenancy and scope shape affect every new endpoint's signature. **That is half right, and
the half that is wrong makes the dependency much cheaper than it looks.**

**Endpoint signatures do not change.** Org selection is already a header
(`X-Organization-Id`), resolved by a hook, before any route handler runs. A route written
today as `orgProcedure.use(requireScopes('webhooks:manage'))` has _identical_ source after
instance principals land — the only difference is which hook branch resolved the org. There
is no signature coupling because the tenancy axis was never in the signature.

**The scope vocabulary is the real coupling, and it is one decision, not a project.** If new
endpoints mint scope strings now and the scope _shape_ changes later — say to
`org:<uuid>:submissions:read` — every string minted in between becomes legacy in the
published contract and in both generated SDKs. That is expensive to undo.

So the gate is not "build Problem 2 first." The gate is a short list of decisions, each
resolvable in review, after which the two proceed in parallel.

**Where the parallelism holds.** For everything whose tenancy lives in a header the route
never sees — submissions, notifications, uploads, public discovery, and the whole of §1.7's
"materially useful" list — the argument above is sound. Those endpoints are unaffected by
the principal model and can be written against today's middleware.

**Where it does not: webhooks.** §1.9 is a genuine counterexample and the brief's instinct
was right there. Webhook subscription is not a route signature, it is a _resource model_,
and the resource model is the contract. An integrator serving N orgs needs an instance-level
subscription; a magazine needs a per-org endpoint; deciding which one `POST /v1/webhooks`
means is a Problem 2 question that has to be answered before the Problem 1 endpoint ships.
The recommendation in §1.9 — a separate `principal_subscriptions` table, leaving
`webhook_endpoints` untouched — is what _restores_ the parallelism, and only because it was
chosen deliberately. The nullable-`organization_id` alternative would have coupled them
hard.

The generalisable version: Problems 1 and 2 are parallel wherever tenancy is carried by the
request, and coupled wherever tenancy is carried by a resource. Webhook subscriptions are
the only case in the current gap list where it is a resource. Worth re-asking the question
for any future endpoint that registers something long-lived on the caller's behalf.

**A dependency running the _other_ way, which the brief did not anticipate.**
**M1 — closing the tRPC bypass — should land before either.** As long as any valid API key
can call `federation.updateConfig` and `hub.revokeInstance` over tRPC, adding a principal
with _broader_ tenancy makes an existing hole wider. And because M1 is now specified as an
allowlist (§1.6), landing it first is what makes the P2.3 credential excluded by
construction rather than by anyone remembering the connection across six PRs.

**Recommended order:**

1. **M1 (close the bypass, default-deny)** — independent, security, blocks nothing
2. **Four decisions, no code:** flat capability strings (§2.5); the webhook subscription
   model (§1.9); idempotency scope (§1.10); spec committed / SDKs built in CI (§1.8)
3. Problem 1 blocking gaps + M2/M3/M4 — proceeds in parallel with 4
4. Problem 2 (a) then (b)

Steps 3 and 4 are genuinely parallel once step 2 lands — which is the point of insisting
those four decisions are taken together and up front rather than discovered one at a time.

---

## 4. Migration path for existing org-scoped keys

The good news: there is nothing to migrate. Approach B adds tables and leaves `api_keys`
untouched — `organization_id` stays `NOT NULL`, the RLS policies stay as they are, the
`col_live_` format stays, and `verify_api_key()` stays. Existing keys keep working with
byte-identical behaviour.

Three changes do touch existing keys, and each is independently safe:

| Change                                             | Effect on existing keys                                                                                                               | Compatibility                                                                                      |
| -------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------- |
| `audit_events.principal_id` / `principal_type`     | Their actions become _correctly_ attributed to the key rather than ambiguously to the creator                                         | Additive. Historical rows keep NULL, which is accurate. No behaviour change.                       |
| Rate-limit key changes from `userId` to `apiKeyId` | Each key gets its own bucket instead of sharing the creator's                                                                         | Strictly loosening for the key holder. A creator with several keys sees _more_ headroom, not less. |
| M1 (`internalOnly` on 7 tRPC routers)              | A key calling `webhooks.*`, `federation.*`, `hub.*`, `transfer.*`, `migration.*`, `simsub.*`, or `ops.*` over tRPC starts getting 403 | **This is the one breaking change.** It is also the point.                                         |

M1 needs handling, not just announcing:

1. Ship `internalOnly` in **log-only mode** first — record `API_KEY_INTERNAL_ROUTE` audit
   events, allow the request through.
2. Query `audit_events` after a representative window (a month, given editorial cadence) to
   find real usage.
3. For anything found, ship the REST equivalent before enforcing — `webhooks:manage` already
   exists as a scope, so webhook management is the likely and easily-satisfied case.
4. Flip to enforcing.

Since Colophony has no external users yet (architecture.md §6.1), step 2 will very probably
return nothing, and the sequence collapses to a formality. Run it anyway — it costs one
flag and it is the difference between knowing and assuming.

**Resolved 2026-07-27 — steps 2–4 done, on evidence rather than elapsed time.** The
prediction above was right, and the month was not what made it verifiable. Staging, the only
deployed environment, has **never held an API key** (`api_keys` is empty across an
`audit_events` history from 2026-04-08), so no call of this shape was possible there
regardless of how long anyone waited. Every shipped client that sends `X-Api-Key` is
REST-only, and the web tRPC client sends interactive credentials exclusively. The 71
`API_KEY_INTERNAL_ROUTE` rows in the dev database were 67 parts test-suite self-observation.

What the window could never have delivered is worth stating, because it is the reason the
calendar was the wrong instrument: elapsed time with no traffic is not evidence about future
traffic. `X-Api-Key` is accepted on every non-public route, so a hand-rolled request reaches
`federation.getConfig` whether or not anyone has tried it yet — which is an argument for
enforcing sooner, not later. The durable guarantee is the test that now pins the default
(`apps/api/src/__tests__/security/scope-enforcement.test.ts`), not the observation period.

---

## 5. Implementation sequence (reviewable PRs)

Sized so each is independently reviewable and independently revertible.

### Phase D — Decisions, no code

Four commitments, taken together before Phase 1 opens. Each is a review conversation; none
is more than an hour. Taking them as a block is the thing that keeps Phases 1 and 2
parallel.

| #      | Decision                   | Recommendation                                                           | Why it cannot wait                                                           |
| ------ | -------------------------- | ------------------------------------------------------------------------ | ---------------------------------------------------------------------------- |
| **D1** | Capability string shape    | Flat, tenancy in the grant (§2.5)                                        | Scope strings minted before this become legacy in the contract and both SDKs |
| **D2** | Webhook subscription model | Separate `principal_subscriptions`; `webhook_endpoints` untouched (§1.9) | P1.1 publishes the endpoint resource model                                   |
| **D3** | Idempotency scope          | `Idempotency-Key` on `/v1` `POST` routes (§1.10)                         | Header is part of the contract and both SDKs                                 |
| **D4** | Generated-artefact policy  | Spec committed; SDKs built in CI (§1.8)                                  | P0.2 rewrites the generation path; doing it twice is waste                   |

### Phase 0 — Make the current surface honest

| PR        | Content                                                                                                                                                                                                                                  | Risk                                              |
| --------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------- |
| **P0.1**  | `internalOnly` middleware in `trpc/init.ts` as an **allowlist** of interactive auth methods (§1.6), applied in log-only mode to the seven §1.5 routers. New audit action.                                                                | Low — logs only                                   |
| **P0.1b** | **Scope the rest.** Add `requireScopes` to every tRPC procedure not covered by P0.1 — `notifications`, `notification-preferences`, and `webhooks` are unscoped and _not_ internal-only. Without this the bypass is narrowed, not closed. | Low — but P0, not deferrable                      |
| **P0.2**  | Rewrite `scripts/export-openapi.ts` to use `OpenAPIGenerator` in-process. Regenerate `sdks/openapi.json` (+36 operations). **Per D4: stop committing generated SDKs, move generation to CI release.**                                    | Low — large deletion, mechanical                  |
| **P0.3**  | CI: **invert** the existing `sdk-check` job (`ci.yml:1610`) — diff the regenerated _spec_ against source, not the SDK against the spec. Per D4, delete the SDK-regeneration half.                                                        | Low — a correction, not an addition (finding (b)) |
| **P0.4**  | CI: coverage manifest test (M4). Seed the manifest from §1.2–1.5.                                                                                                                                                                        | Low                                               |
| **P0.5**  | Flip `internalOnly` to enforcing. **Done 2026-07-27**; the observation window was closed early on the evidence in §4. `webhooks:manage` was consumed by P0.1b; `payments:read` removal is split out as P0.5b.                            | Medium — behaviour change                         |

_P0.1 is one middleware and it is the single highest-value change here; review it for the
allowlist, not the router list. P0.2 is the largest diff and contains no logic — with D4 it
becomes mostly a deletion (6.1 MB, 447 Python files) rather than a regeneration._

### Phase 1 — Blocking REST gaps

| PR       | Content                                                                                                                                                                        | Risk                                                                                                              |
| -------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------- |
| **P1.1** | `rest/routers/webhooks.ts` — 9 routes, `webhooks:manage`. Per-org endpoints only; **requires D2 taken first** (§1.9). Consumes `webhooks:manage`, closing the dead-scope item. | Low _given D2_; publishes a resource model otherwise                                                              |
| **P1.2** | `rest/routers/notifications.ts` — list, unread-count, mark-read, mark-all-read + 3 preference routes. New `notifications:read` / `notifications:write` scopes.                 | Low                                                                                                               |
| **P1.3** | Upload initiation under `/v1` — port the `prepare-upload` / `upload-status` pattern from `embed.routes.ts`. Document the tus flow in the OpenAPI description.                  | Medium — touches the tusd contract                                                                                |
| **P1.4** | `/v1/public/periods` — open periods by org slug, unauthenticated, cacheable. Extends the existing `/v1/public/` prefix.                                                        | Medium — new unauthenticated surface; needs its own rate-limit treatment, following the `demo-requests` precedent |

### Phase 2 — Instance principal (capability (a))

| PR        | Content                                                                                                                                                                                                                                                                                                                                                         | Risk                                                                                                                                                                           |
| --------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **P2.-1** | **Fix queued-delivery revalidation on the existing org-scoped webhook path** (§1.9). Look URL and secret up at send time; cancel rather than send when the endpoint is deleted or disabled. Pre-existing gap, blast radius of one org today — fix it here, before P2.7 generalises it across tenants.                                                           | Medium — touches the delivery worker                                                                                                                                           |
| **P2.0**  | **Audit every service method touching `users` / `organizations` for unfiltered reads (F1).** Add explicit `WHERE` clauses and RLS integration tests. **No new capability — this is a prerequisite.**                                                                                                                                                            | **High value, medium risk**                                                                                                                                                    |
| **P2.1**  | Migration: `service_principals` (**no RLS + `REVOKE ALL … FROM app_user`**, three-place discipline; reads via `SECURITY DEFINER`) and `service_principal_grants` (**RLS + `FORCE`**, org-scoped). Hashed secret, one-time display, `expires_at`, `revoked_at`, IP-allowlist column. `SERVICE_PRINCIPALS_ENABLED` env, default false. No routes, no auth wiring. | Low — inert, but the `REVOKE` is load-bearing (§2.4)                                                                                                                           |
| **P2.2**  | Migration: `audit_events.principal_id` / `principal_type` + updated `insert_audit_event()`. Wire `api_keys` into it (fixes finding (d) independently of anything else).                                                                                                                                                                                         | Medium — SECURITY DEFINER change                                                                                                                                               |
| **P2.3**  | `auth.ts`: `col_svc_` branch behind the flag. `org-context.ts`: branch on **principal type**, resolve org from `X-Organization-Id` via grant lookup (F2, F3). `db-context.ts`: open the transaction on org id _or_ user id, leave `app.user_id` unset for principal-only requests (F4).                                                                         | **Highest risk in the plan.** Needs RLS integration tests for: no-org, granted-org, ungranted-org, expired-grant, revoked-principal.                                           |
| **P2.4**  | Rate limiting, **two tiers**: credential-level in `rate-limit-auth.ts` (position unchanged); `(principal, org)` sub-limit in a **new check after `orgContext`**, since the org header is unvalidated at the current hook position (§2.5). Separate principal ceiling. Principal path fails closed on Redis outage (Q4).                                         | Medium                                                                                                                                                                         |
| **P2.5**  | Management surface: create/list/revoke principals, grant/revoke per-org. Routes registered only when enabled. IP allowlist column + check. **Plus the org-facing side: `GET`/`DELETE /v1/organizations/{orgId}/grants`, RLS on `service_principal_grants`, and the sticky `revoked_by_org_at` column (§2.5).**                                                  | Medium                                                                                                                                                                         |
| **P2.6**  | `orgs:provision` capability + provisioning route. Explicitly does not confer a grant on the created org.                                                                                                                                                                                                                                                        | Medium                                                                                                                                                                         |
| **P2.7**  | Instance webhook subscriptions per D2: `principal_subscriptions` table, registration on the principal surface, grant-filtered fan-out in `inngest/functions/webhook-delivery.ts`, **per-send revalidation in `webhook.worker.ts`**, and `validateOutboundUrl()` on create/update/send. `webhook_deliveries` gains `principal_id`/`subscription_id`.             | **High.** Grant enforcement runs outside the request path. Tests: zero deliveries for an ungranted org; org-side revocation cancels _queued_ deliveries, not just future ones. |

### Phase 3 — Acting-as (capability (b))

| PR       | Content                                                                                                                                             | Risk                                                                                                                    |
| -------- | --------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| **P3.1** | `X-Act-As-User` resolution in `auth.ts`, gated on principal capability. Membership check against the _selected_ org, ordered after the grant check. | **High.** Needs tests for the escalation case: read-only grant + acting as an org admin must not yield admin authority. |
| **P3.2** | Intersection permission evaluation in the middleware chain. Audit records both identities.                                                          | High                                                                                                                    |
| **P3.3** | Documentation: the acting-as contract, what it does and does not confer, and the deferred submitter case.                                           | Low                                                                                                                     |

### Test matrix (Phases 2–3)

Listed because several of these cross layers that no existing test touches, and because the
failure modes are silent.

| Case                                                                        | Asserts                          |
| --------------------------------------------------------------------------- | -------------------------------- |
| Direct query against **every** tenant table with wrong org / no org set     | F1, F6 fail-closed               |
| No `SET LOCAL` leakage between pooled requests (PgBouncer transaction mode) | §2.6(2)                          |
| Principal-only request (no acting-as) hitting a user-scoped table           | F4 — fails closed, no 500 loop   |
| Ungranted org, expired grant, revoked principal, org-revoked grant          | F2 — each 403, not 200           |
| `X-Act-As-User` × every combination of grant capability and target role     | intersection never widens        |
| Read-only grant acting as an org `ADMIN`                                    | no escalation                    |
| Procedure requiring a role, called by a principal with no role              | fails closed, no synthetic ADMIN |
| Webhook event for org A, principal granted only on org B                    | zero deliveries created          |
| Revocation while a delivery is **already queued**                           | delivery cancelled, not sent     |
| Two concurrent requests with the same `Idempotency-Key`                     | one executes, one 409s           |
| Same key, different body                                                    | 422                              |

### Phase 4 — Remaining parity

Individual PRs per §1.7's "materially useful" list, each one router, each adding its
manifest entry. No ordering constraint between them.

---

## 6. Decision log

| Decision                                  | Choice                                                                                         | Alternatives                                              | Rationale                                                                                                                                                                |
| ----------------------------------------- | ---------------------------------------------------------------------------------------------- | --------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Principal model                           | Separate `service_principals` table + `col_svc_` prefix                                        | Widen `api_keys`; Zitadel client credentials              | Revocability. A NULL-org row is invisible to `api_keys`' own RLS policy; an external service should not own the grant model.                                             |
| Scope shape                               | Flat capability strings, tenancy in a separate grant table                                     | Org-encoded scope strings; blanket instance access        | Keeps the Zod enum finite and the SDKs stable; per-org grants bound the blast radius.                                                                                    |
| Org selection for instance principals     | Existing `X-Organization-Id` header                                                            | Body field; URL path segment                              | Every hook is `onRequest`; the body is not parsed yet (F5). Reuses one concept.                                                                                          |
| Acting-as permissions                     | Intersection of grant and user role                                                            | User role alone                                           | Impersonation attributes an action; it must never acquire authority.                                                                                                     |
| `app.user_id` for principal-only requests | Leave unset                                                                                    | Synthetic UUID; creator's id                              | Synthetic values can fail open on user-scoped RLS; the creator's id reintroduces the attribution problem.                                                                |
| Boundary enforcement                      | `internalOnly` middleware + coverage manifest test + CI spec diff                              | Documentation; naming convention                          | tRPC is currently reachable by every API key — the policy needs a mechanism, not a note.                                                                                 |
| `internalOnly` shape                      | **Allowlist of interactive auth methods**                                                      | Denylist of `apikey`                                      | A denylist silently readmits the next credential class — and P2.3 adds one. Same rule as F3: branch on what a principal is, not how it authenticated.                    |
| Webhook subscription model                | Separate `principal_subscriptions`; `webhook_endpoints` untouched; shared `webhook_deliveries` | Nullable `organization_id`; two parallel delivery systems | A NULL-org row is unreachable through that table's own RLS, which uses the raising idiom (F6). Keeps one delivery log, one signature scheme, and P1.1's contract stable. |
| Grant visibility                          | Org-visible and org-revocable, with sticky `revoked_by_org_at`                                 | Operator-only grants                                      | A tenant that cannot see who holds keys to its data does not have control of it. Non-sticky revocation is theatre.                                                       |
| Idempotency                               | `Idempotency-Key` header, credential-scoped, replay-or-409                                     | None; server-side dedup heuristics                        | Retries are the normal condition for machine clients; the header is contract surface, so it cannot be added later cheaply.                                               |
| Generated artefacts                       | Spec committed, SDKs built in CI                                                               | Commit both; commit neither                               | The spec is the contract M3 diffs. SDK bulk is the friction that let the spec go five months stale.                                                                      |
| Acting-as on decisions                    | Denied by default, per-capability denylist                                                     | Allowed; hardcoded exception                              | A decision attributed to someone who did not make it destroys the audit trail's value — same trust property as blind review.                                             |
| Sequencing                                | Close the bypass → four decisions → parity ∥ principal                                         | Problem 2 fully before Problem 1                          | Parallel where tenancy rides the request; coupled where tenancy is a resource. Webhooks are the only current case of the latter.                                         |
| `service_principals` privileges           | No RLS **plus** `REVOKE ALL … FROM app_user`, reads via `SECURITY DEFINER`                     | "No RLS" alone, per the hub precedent                     | The hub precedent is safe _because_ of a revoke (`0029_hub_tables.sql:67`). Without it, one application-path mistake is instance-wide credential enumeration.            |
| Grant table privileges                    | RLS + `FORCE` + explicit `organization_id` filters                                             | No RLS, like the principal table                          | It is genuinely org-scoped, which is what lets the org-facing views read it safely.                                                                                      |
| Webhook revocation                        | Revalidate per send, not only at fan-out                                                       | Fan-out filtering alone                                   | Queued jobs carry URL and secret and retry for up to an hour; fan-out filtering leaves a revoked party receiving events.                                                 |
| Principal capability storage              | Column on `service_principals`, intersected with the grant                                     | Grant-only; synthetic `ADMIN` role                        | A synthetic role passes every existing role guard regardless of the grant — fails open.                                                                                  |
| Idempotency concurrency                   | `INSERT … ON CONFLICT DO NOTHING` first, then 409 / replay / 422                               | Unique key + request transaction                          | The transaction makes each request atomic but does not serialise two requests against each other.                                                                        |
| Self-hoster default                       | `SERVICE_PRINCIPALS_ENABLED=false`, routes unregistered                                        | Always on with empty tables                               | Matches `FEDERATION_ENABLED`. Unregistered routes cannot be probed.                                                                                                      |

---

## 7. Questions resolved in review

**Q1 — Acting-as on editorially-attributable operations: deny by default.**
An editorial decision attributed to a human who did not make it is the one thing that
destroys the audit trail's value, and it is the same trust property as blind review — the
reader believes something about who acted, and it is false. Implement as an explicit
**per-capability denylist**, visible and adjustable, not a hardcoded special case in the
middleware. Initial entries: submission status transitions (`PATCH /submissions/{id}/status`
and both batch variants) and `gdpr.deleteAccount`. Ships with P3.1.

**Q2 — Generated SDKs: stop committing them.** Resolved as D4 (§1.8). The spec is the
contract and stays committed because M3 diffs it; the SDKs are derived, reviewed by nobody,
and their bulk is what made the drift check feel expensive enough to skip. Build and publish
from the committed spec in CI on release.

**Q4 — Redis fail-open: change it for the principal path only.** Fail-open is defensible
for a human's per-user window and indefensible for a credential aggregating many tenants.
Two branches in `hooks/rate-limit.ts` and `rate-limit-auth.ts`, not a policy reversal:
interactive sessions keep degrading gracefully, principal-authenticated requests fail closed
with `503` when Redis is unreachable. Ships with P2.4.

**Q5 — Decision letters belong in `correspondence`.** It exists, it is already scoped, and
a first-class decision-with-letter operation would couple two things magazines want
separately — issue the decision now, send the letter on a schedule, or send a different
letter to a shortlist. §0's "decisions" row therefore stays a non-gap: the decision is
already public via `PATCH /submissions/{id}/status`, and the letter is a `correspondence`
REST surface in Phase 4.

## 8. Still open

1. **Idempotency scope** (§1.10) — every `/v1` `POST`, or only the integrator-facing set?
   Clean rule versus cheaper rule; this is D3 and wants deciding, not inheriting.
2. **Submitter acting-as.** A host platform filing on a writer's behalf is a real use case,
   but submitters have no org membership by design, so the v1 membership check excludes
   them. Needs a consent model that does not exist. Possibly a Register concern given
   federated identity already models cross-instance user agency.
3. **The `users` / `organizations` no-RLS audit** (§2.6(1)) — scoped as P2.0, but its size
   is unknown until someone reads the 66 service modules. May change Phase 2's estimate.
4. **Normalising the two RLS idioms** (F6) — four schema files raise where twenty-four
   return NULL. Not urgent, not a vulnerability, but it should be a decision rather than an
   accident.
