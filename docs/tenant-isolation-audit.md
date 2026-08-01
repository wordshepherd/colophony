# Tenant Isolation Audit — `users` and `organizations`

**Scope:** every read and write of the two tables that have no row-level security.
**Date:** 2026-07-28. **Tree:** `fd9c905f`.
**Motivating item:** P2.0 in [`api-integration-design.md`](api-integration-design.md) §5 Phase 2,
opened by §2.3 F1 and left unresolved in §2.6(1) and §8 item 3.

---

## 1. Why this exists

Sixty tables carry RLS. `users` and `organizations` do not, and neither has a compensating
`REVOKE`. On those two, cross-tenant isolation is whatever the service layer's `WHERE` clause
says it is — the database will not catch a mistake.

That is tolerable today because every principal is pinned to exactly one organization: an API
key belongs to one org, and an interactive session resolves one org through
`organization_members`. The instance principal planned in Phase 2 removes the pin. From that
point, any query that relies on the pin rather than on a predicate becomes a cross-tenant read.

§2.6(1) of the design doc flagged the audit as unperformed and as a prerequisite rather than a
follow-up, and noted it "may change the effort estimate materially". This is that audit.

## 2. Where the predicate goes

`users` has **no `organizationId` column** (`packages/db/src/schema/users.ts:15-33`). It is a
global identity table by design — one person, one row, many orgs.

That does not make a `users` read unscopeable. It means the predicate lands on an org-bearing
**join partner** instead of on the table itself:

| Table           | Explicit predicate                                                                   |
| --------------- | ------------------------------------------------------------------------------------ |
| `organizations` | On the table: `eq(organizations.id, orgId)`                                          |
| `users`         | On the join partner: `eq(organizationMembers.organizationId, orgId)`, or an `EXISTS` |

Both wrong conclusions are worth naming, because each licenses a different mistake:

- _"Thread `orgId` into every query"_ — does not compile against `users`, and would produce
  meaningless code if forced.
- _"`users` reads can only ever be RLS-only"_ — false, and it excuses exactly the gap this audit
  exists to close. `organizationService.listMembers` is the proof: it already joins
  `organization_members`, so scoping it is one condition on a join it performs anyway.

## 3. Method

Four search angles, because no single one is complete:

1. Builder calls — `from(users)`, `.update(organizations)`, `.insert(users)`, `.delete(...)`.
2. Join calls — `.leftJoin(users, ...)`, `.innerJoin(organizations, ...)`. **Six files reach
   `users` only this way** and are invisible to angle 1.
3. `alias()` — `pipeline.service.ts` aliases `users` six times (`:129`, `:130`, `:188`, `:189`,
   `:997`, `:998`) as `copyeditors` / `proofreaders`. A bare-name grep for `from(users)` misses
   every one.
4. Relational API and raw SQL — `db.query.users.findFirst`, and `FROM users` / `JOIN
organizations` inside `sql` blocks.

Confirmed no import aliasing (`import { users as … }`) anywhere in `apps/api/src` or
`packages/db/src`, so bare-name matching is sound once all four angles are combined.

Counts, page queries and write halves are treated as separate sites. #521 is the precedent: the
paginated query was scoped and the `count(*)` was not, so `items` was correct while `total`
reported every org's rows.

## 4. Verdicts

73 sites across 36 files.

| Verdict         | Count | Meaning                                                                    |
| --------------- | ----- | -------------------------------------------------------------------------- |
| **SCOPED**      | 18    | Explicit org predicate, on the table or on an org-bearing join partner     |
| **USER-SCOPED** | 3     | Explicit predicate, but on `user_id` / `submitter_id`, not org             |
| **TRANSITIVE**  | 12    | No explicit predicate; an RLS policy on a joined table is the only defense |
| **BY-ID-ONLY**  | 34    | Primary- or natural-key lookup; no org concept applies                     |
| **UNFILTERED**  | 6     | No meaningful predicate                                                    |

**None of these is a live vulnerability.** Every TRANSITIVE path is isolated by RLS today, which
`apps/api/src/__tests__/security/tenant-isolation-transitive.test.ts` verifies per method rather
than asserting. The finding is that 12 paths have one layer where the house rule for tenant
queries — never rely solely on RLS, always include an explicit `WHERE organization_id = orgId`
as defense-in-depth — requires two, and that the missing layer is the one the instance principal
removes.

### 4.1 TRANSITIVE — the fix list

RLS-only. Ordered by exposure.

| Site                                            | Method                      | Predicate present                   | Disposition |
| ----------------------------------------------- | --------------------------- | ----------------------------------- | ----------- |
| `services/submission.service.ts:290`            | `listAll`                   | `status` / `period` / `search` only | fix — P2    |
| `services/submission.service.ts:392`            | `exportAll` (10 000 rows)   | same                                | fix — P2    |
| `services/submission.service.ts:1526`           | `listAgingByOrg`            | date + status only                  | fix — P2    |
| `services/submission.service.ts:571`            | `getById` submitter email   | id from scoped row                  | ok          |
| `services/submission-discussion.service.ts:151` | `listBySubmission`          | `submissionId`                      | ok          |
| `services/submission-discussion.service.ts:312` | `createWithAudit` re-read   | `id`                                | ok          |
| `services/submission-vote.service.ts:217`       | `listBySubmission`          | `submissionId`                      | ok          |
| `services/submission-vote.service.ts:360`       | `castVoteWithAudit` re-read | `id`                                | ok          |
| `services/submission-reviewer.service.ts:121`   | `listBySubmission`          | `submissionId` + members join       | ok          |
| `services/simsub-group.service.ts:134`          | `getDetail` journal names   | group id                            | ok          |
| `inngest/functions/cms-publish.ts:64`           | issue pieces                | inside `withRls({ orgId })`         | ok          |
| `inngest/functions/contract-workflow.ts:67`     | signer lookup               | inside `withRls({ orgId })`         | ok          |
| `services/status-token.service.ts:89`           | `verifyToken` org settings  | org id from verified token          | ok          |
| `services/csr.service.ts:99`                    | export org names            | ids from a `submitter_id` read      | ok          |
| `services/migration-bundle.service.ts:99`       | bundle org names            | same                                | ok          |

`organization.service.ts` `listMembers` **was** the only site in the codebase reading `users` with
no `WHERE` clause on any table in the query. Fixed 2026-07-28 — it now carries one hoisted
`eq(organizationMembers.organizationId, orgId)` reused by both the page and count queries, so the
two cannot drift apart, and it has moved to §4.5. No site in the fix list below reads `users`
entirely unfiltered any longer.

`listAgingByOrg` is named for a scoping it does not perform. Its caller supplies the org through
`withRls({ orgId })` (`inngest/functions/submission-response-reminder.ts:64`), so it is correct in
practice and misleading to read.

### 4.2 USER-SCOPED

| Site                               | Method                               | Predicate                         | Disposition                                       |
| ---------------------------------- | ------------------------------------ | --------------------------------- | ------------------------------------------------- |
| `services/portfolio.service.ts:95` | `list` — `LEFT JOIN organizations o` | `s.submitter_id = userId` (`:52`) | ok — journal name is also a search target (`:65`) |

Despite its name, `portfolioService.list` never reads `portfolio_entries`; it queries
`submissions` and `external_submissions` and joins `organizations` only to surface journal
names. `portfolio_entries` (user-scoped, `user_id = current_user_id()`) has no service method in
this audit's scope, so nothing here covers its policy.

| `services/user.service.ts:17` | `getProfile` | `users.id = $1`, caller's own id | ok |
| `services/gdpr.service.ts:46` | `deleteUser` existence check | `users.id = $1` | ok |

### 4.3 UNFILTERED

All six are deliberate. Recorded so the next audit does not re-open them.

| Site                                                   | What                            | Why it is not a finding                                                              |
| ------------------------------------------------------ | ------------------------------- | ------------------------------------------------------------------------------------ |
| `inngest/functions/submission-response-reminder.ts:34` | reads every `organizations` row | Cron fan-out; filters `responseReminderEnabled` in JS, then enters `withRls` per org |
| `services/trust.service.ts:399`                        | every non-opted-out org         | Inbound S2S trust request must create a peer row in each; loops `withRls` per org    |
| `services/trust.service.ts:857`                        | same, hub-attested path         | As above                                                                             |
| `services/organization.service.ts:77`                  | `INSERT INTO organizations`     | Bootstrap — the org does not exist yet                                               |
| `services/embed-submission.service.ts:104`             | `INSERT INTO users` (guest)     | Unauthenticated embed intake                                                         |
| `hooks/auth.ts:415`                                    | JIT user provisioning           | Runs before any org context exists                                                   |

### 4.4 BY-ID-ONLY — cross-tenant lookup keys

34 sites resolve a row by primary or natural key. Most are unremarkable. The ones worth naming
share a property: **an email address is a cross-tenant lookup key**, and nine sites use it.

**Corrected 2026-07-31.** The prose said "eight" while the table listed nine, and every line
number below was stale — they pointed at the opening `await db`/`await tx` rather than the
`where` a few lines down. Both are now the predicate lines, re-verified against the tree.
Two were wrong beyond drift: `organization.service.ts:203` was in a different method's return
block, and `hooks/auth.ts:456` is an `onConflictDoUpdate` keyed on `zitadelUserId`, not email.
The list is confirmed exhaustive — every other `users.email` reference in `apps/api/src` is a
projection or join column whose `WHERE` keys on an id.

| Site                                                        | Op     | Reachable without auth         |
| ----------------------------------------------------------- | ------ | ------------------------------ |
| `services/organization.service.ts:220` (`addMember`)        | SELECT | no — ADMIN only                |
| `services/embed-submission.service.ts:95`, `:124`, `:141`   | SELECT | **yes** — embed intake         |
| `services/federation.service.ts:440` (`resolveWebFinger`)   | SELECT | **yes** — federation discovery |
| `services/federation.service.ts:533` (`getUserDidDocument`) | SELECT | **yes** — federation discovery |
| `services/simsub.service.ts:329`                            | SELECT | S2S signature, not user auth   |
| `services/migration.service.ts:503`                         | SELECT | S2S signature, not user auth   |
| `hooks/auth.ts:495`                                         | UPDATE | no — JIT link on 23505         |

Two things the earlier table obscured. `hooks/auth.ts:495` is an **UPDATE**, not a SELECT,
which matters to anyone auditing read paths only. And the two S2S rows are authenticated —
by HTTP signature against a known peer — so the no-credential count is **five** (the three
embed reads plus the two federation discovery routes), not seven.

Two observations:

- `resolveWebFinger` (`:440`) filters on email alone. Its sibling `getUserDidDocument` (`:533`)
  filters `email` **and** `isNull(deletedAt)` **and** `eq(isGuest, false)`. The asymmetry looks
  unintended: the laxer of the two is the unauthenticated discovery endpoint, so a deleted or
  guest account is discoverable through one path and not the other. Tracked as P2.
- `embed-submission.service.ts:95` returns the existing user id when the email matches, including
  when that account is a real user in another tenant — the embed submission is then attributed to
  them. Deliberate (it is how a known writer submitting through an embed is linked), but it is the
  sharpest edge of email-as-key and belongs in the P3 design question rather than a patch.

### 4.5 SCOPED

18 sites, no action. They are the pattern to copy: `eq(organizations.id, orgId)` for settings and
name reads (`submission-notifications.ts:41`, `slate-notifications.ts:131`,
`discussion-notifications.ts:34`, `submission-vote.service.ts:144`, and others), org-bearing join
conditions in `contest.service.ts:386`/`:594`/`:635`, `pipeline.service.ts:129`/`:188`/`:997`, and
`invitation.service.ts:166`.

Joined here 2026-07-28 by `organization.service.ts` `listMembers` (page and count), the first item
off the §4.1 fix list. It is the worked example of the §2 rule: `users` has no `organizationId`, so
the predicate lands on the org-bearing join partner — a join the method already performed. The
predicate is hoisted once and applied to both queries, which is what makes it impossible to scope
the page and leave the count reporting every organization's member total.

## 5. Legitimately cross-tenant families

Whole categories that will always read these tables without an org predicate, because no org
context exists at the point of the read:

- **Pre-auth webhooks** — `webhooks/zitadel.webhook.ts` (9 sites, keyed on `zitadelUserId`),
  `webhooks/tusd.webhook.ts:64`.
- **Authentication** — `hooks/auth.ts` (4 sites). Resolving who the caller is necessarily
  precedes knowing which org they are acting in.
- **Org resolution** — `hooks/org-context.ts:80` checks the org in the header exists before the
  membership check at `:112`.
- **SECURITY DEFINER** — `list_user_organizations()` and `verify_api_key()` are cross-tenant by
  construction; that is why they exist.
- **Cron fan-out** — `submission-response-reminder.ts`.
- **Federation S2S** — `trust.service.ts`, `migration.service.ts`, `simsub.service.ts`,
  `federation.service.ts`. A remote instance supplies an identifier; resolving it is the point.
- **Unauthenticated public and embed routes** — `routes/public.routes.ts`,
  `services/embed-submission.service.ts`.

## 6. Findings beyond the two tables

Both surfaced while building the gate in
`apps/api/src/__tests__/rls/rls-infrastructure.test.ts`, and both matter more than anything in §4.

### 6.1 The `REVOKE`-based protection does not survive provisioning

`federation_config`, `hub_registered_instances` and `hub_fingerprint_index` are documented as
safe without RLS on the grounds that migration `0029_hub_tables.sql:67` explicitly does
`REVOKE ALL … FROM app_user`.

Measured, `app_user` held `SELECT, INSERT, UPDATE, DELETE` on all three. The revokes execute;
they were undone afterwards, in every path, by the blanket
`GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO app_user` that each
provisioning path issues once migrations have run. `GRANT` is additive and removes nothing, so
only a `REVOKE` placed _after_ that grant survives. Seven paths each re-revoked a hand-copied
subset, and those subsets had drifted: `init-prod.sh` and `db-reset.sh` restored seven tables,
`db-setup.ts` two, `simsub-qa.ts` one, and `init-demo-db.sh` none.

`outbox_events` failed the same way for a different reason: migration `0022`'s comment says
"SELECT is not granted — only the superuser outbox poller reads/updates events", but it only
issued a `GRANT INSERT`, which withholds nothing, and `ALTER DEFAULT PRIVILEGES` had already
granted full DML. This is the additive-`GRANT` trap already documented for `DELETE` on the
append-only tables, reappearing for `SELECT`.

**Confirmed on staging, 2026-07-28.** Measured against `colophony_staging`: all four tables
carried full DML, as did `demo_requests`. The seven tables that _were_ on the re-revoke lists
held correctly, which localises the fault to the lists rather than the mechanism. Production is
not affected — it has never been deployed (`production` is not a configured GitHub
environment). No key material was exposed: `federation_config` had zero rows, federation being
disabled on staging.

**Consequence for P2.1 — resolved, no redesign needed.** The design doc's `service_principals`
recommendation is "no RLS **plus** `REVOKE ALL … FROM app_user`, reads via SECURITY DEFINER",
justified by the hub precedent. Because the mechanism is sound and only the lists had drifted,
the pattern delivers what it promises once privileges live in a single manifest. Every reader
of these tables already goes through the superuser pool (`db` in `packages/db/src/client.ts`
wraps `pool`, not `appPool`), so closing them broke nothing.

**Fixed.** `packages/db/privileges.sql` is now the sole definition of `app_user`'s table
privileges, applied last by all seven paths; migration `0069` carries the same revokes for
already-provisioned databases; and `rls-infrastructure.test.ts` asserts the full
`SELECT/INSERT/UPDATE/DELETE` matrix per table rather than SELECT alone, which is what makes
`outbox_events` (INSERT only) expressible.

### 6.2 Two tables were classified by nothing

`organization_invitations` was absent from both `RLS_TABLES` and `NON_RLS_TABLES` in
`rls-infrastructure.test.ts`, so none of that file's assertions covered it. It is correctly
RLS'd with `FORCE` and a policy — it was simply unchecked. `demo_requests` was likewise
unclassified, and has neither RLS nor a revoke.

The exhaustiveness assertion added in this change closes the class: every table in `public` must
appear in exactly one list.

## 7. Estimate for Phase 2

§2.6(1) asked whether this audit changes the Phase 2 estimate. It does, in both directions.

- **Smaller than feared for `users`/`organizations`.** The predicate work is 5 methods across 2
  service files, not a sweep of 66 modules. Most sites are BY-ID-ONLY or already scoped. Call it
  one to two days including tests, split as P1 and P2 in the backlog.
- **Bounded for the privilege model.** §6.1 initially looked like it invalidated the premise of
  P2.1's table design. On verification it did not: the `REVOKE` mechanism works, and only the
  hand-copied lists had drifted. Consolidating them into `packages/db/privileges.sql` and
  widening the privilege assertion was roughly a day, and `service_principals` proceeds as
  designed.

The P1 items must merge before the instance principal ships; the backlog records that as a
precondition on the Phase 2 entry. **`listMembers` and the REST `invitations/accept` scope gap both
merged 2026-07-28**, clearing the two P1s this audit raised. The two remaining Track 2 P1s
(per-key rate limits, `principal_id` in `audit_events`) are from the integration-surface review, not
from here.

## 8. What keeps this true

- `apps/api/src/__tests__/rls/rls-infrastructure.test.ts` — catalog-derived. Every table in
  `public` must be classified; each unprotected table's `app_user` SELECT privilege is asserted
  against a recorded expectation, so a silent re-grant fails the build.
- `apps/api/src/__tests__/security/tenant-isolation-transitive.test.ts` — per-method proof that
  RLS covers each §4.1 path, with a non-zero own-org assertion so the checks cannot pass against
  empty tables. `listMembers` is deliberately retained here after being scoped: an explicit
  predicate would otherwise mask a regression in `organization_members`' policy. **The pattern for
  the remaining §4.1 fixes** is therefore to keep the app-pool case here and add an admin-pool
  mirror, not to move the case.
- `apps/api/src/__tests__/rls/organization-service.test.ts` and `.../api-key-service.test.ts` —
  the other direction. Both drive the RLS-**bypassing** admin pool so an explicit `WHERE` is the
  only isolation under test; a deleted predicate fails these while everything else stays green.
  `globalSetup()` asserts that the admin connection really does bypass RLS, so neither can quietly
  degrade into an RLS-backed test that passes either way.
- `apps/api/src/__tests__/security/unprotected-table-callsites.test.ts` — file-level tripwire. A
  `users` or `organizations` query in a new file fails until it is classified here. A nudge to
  the reviewer, not a security boundary: a new query in an already-listed file passes.
