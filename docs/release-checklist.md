# Release Checklist

> Pre-release verification for Colophony. Run through before tagging a release.
>
> **Automated checks** are covered by CI — verify they pass on the release branch.
> **MCP-assisted checks** use Chrome DevTools MCP for flows that aren't fully automated.
> **Manual checks** require human judgment (visual, UX, copy review).
>
> After completing a release check, log results in `docs/qa-log.md`.

## 1. CI Pipeline (automated)

All CI jobs must pass on the release branch:

- [ ] `quality` — lint, type-check, format, audit
- [ ] `unit-tests` — ~1584 API + ~38 package tests
- [ ] `rls-tests` — 122 RLS tenant isolation tests
- [ ] `queue-tests` — 19 queue/worker integration tests
- [ ] `service-integration-tests` — 63 service integration tests
- [ ] `security-tests` — 20 security invariant tests
- [ ] `build` — production build (API + Web)
- [ ] `playwright-*` — all 10 E2E suites (145+ tests)

## 2. Critical Path Smoke Tests (MCP-assisted)

Flows covered by Playwright E2E but worth a quick MCP verification on staging:

- [ ] **Submit a piece** — create submission with file upload, verify appears in list
- [ ] **Review + accept** — change submission status to ACCEPTED, verify pipeline item created
- [ ] **Pipeline flow** — advance item through COPYEDIT → AUTHOR_REVIEW → PROOFREAD → READY_TO_PUBLISH
- [ ] **Embed form** — load public embed URL, complete submission as anonymous user
- [ ] **Organization** — create org, invite member, verify member appears

## 3. Gaps Not Covered by Automation (MCP-assisted)

These flows have no Playwright coverage — verify manually or via MCP:

- [ ] **Stripe checkout** — trigger payment flow, verify Stripe redirect and webhook processing
- [ ] **Email delivery** — trigger a notification, verify email sent (check Ethereal or SMTP logs)
- [ ] **File virus scan** — upload file, verify ClamAV scan completes (check file status in DB)
- [ ] **Federation handshake** — if federation enabled: initiate trust request, verify peer appears
- [ ] **CMS publish** — publish an issue to connected CMS, verify external content created
- [ ] **Contract signing** — create contract, verify Documenso webhook processes signature
- [ ] **OIDC login** — full Zitadel login flow on staging (E2E exists but requires live Zitadel)
- [ ] **API key auth** — create API key, make authenticated REST/GraphQL request
- [ ] **Mobile responsive** — check submission form + dashboard on 375px viewport

## 4. Data Integrity Checks (MCP-assisted or DB query)

- [ ] **RLS isolation** — query a tenant table as app_user without SET LOCAL, verify empty result
- [ ] **Audit trail** — perform a sensitive action, verify audit_events row created
- [ ] **Webhook idempotency** — replay a Stripe/Zitadel webhook, verify no duplicate processing

## 5. Visual / UX Review (manual)

- [ ] **Dark mode** — if applicable, check key pages render correctly
- [ ] **Error states** — trigger 404, 403, 500 pages, verify user-friendly messages
- [ ] **Loading states** — verify skeleton/spinner displays during data fetches
- [ ] **Copy review** — scan user-facing text for typos, unclear language

## 6. Deployment

- [ ] All sections above verified on staging
- [ ] Create git tag: `git tag v<major>.<minor>.<patch>`
- [ ] Push tag: `git push origin v<major>.<minor>.<patch>`
- [ ] Create GitHub Release with changelog
- [ ] Dispatch production deploy: Actions → Deploy → production → tag
- [ ] Verify smoke test passes in workflow output
- [ ] Monitor Sentry for 15 minutes post-deploy
- [ ] Spot-check one critical flow on production
