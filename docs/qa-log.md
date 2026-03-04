# QA Log

> Track manual and MCP-assisted testing sessions. Each entry records what was tested,
> how (Chrome DevTools MCP vs Playwright vs manual browser), issues found, and
> automation candidates identified.
>
> **When to add an entry:** After any exploratory testing, pre-release smoke test,
> or regression check done outside of automated test suites.
>
> **Automation rule:** If the same check appears 3+ times in this log, it should be
> promoted to a Playwright E2E test. Tag it `[AUTOMATE]` and create a backlog item.

## Template

<!-- Copy this for new entries -->
<!--
## YYYY-MM-DD — [Focus Area]

**Method:** Chrome DevTools MCP | Playwright MCP | Manual browser
**Areas tested:**
- [ ] [Area]: [what was verified] — [PASS|FAIL|ISSUE #N]

**Issues found:**
- None | #N: [description]

**Automation candidates:**
- None | [Check description] — [count of times tested manually]
-->

## Entries

Newest first.

## 2026-03-04 — Full Manual QA: All Sections (Desktop Only)

**Method:** Chrome DevTools MCP
**Viewport:** Desktop 1440x900 only (mobile/dark mode omitted per request)

### PUBLIC (7 screenshots)

- [x] Landing (`/`): visual review + desktop screenshot — PASS
- [x] Identity (`/identity`): visual review + desktop screenshot — PASS (shows "Unable to Load" — expected with `FEDERATION_ENABLED=false`)
- [ ] Embed Form (`/embed/{token}`): SKIPPED — no active embed tokens in seed data
- [ ] Embed Status (`/embed/status/{token}`): SKIPPED — no status tokens available
- [x] Auth Callback Error (`/auth/callback?error=test`): visual review + desktop screenshot — PASS

### WRITER (14 screenshots)

- [x] Submissions List (`/submissions`): visual review — PASS
- [x] New Submission (`/submissions/new`): form renders correctly — PASS
- [x] Manuscripts List (`/manuscripts`): visual review — PASS
- [x] New Manuscript (`/manuscripts/new`): form renders correctly — PASS
- [x] Workspace Home (`/workspace`): dashboard with stats — PASS
- [x] Correspondence (`/workspace/correspondence`): empty state — PASS
- [x] Portfolio (`/workspace/portfolio`): shows cross-org submissions — PASS
- [x] Writer Analytics (`/workspace/analytics`): charts + stats render — PASS
- [x] External Subs (`/workspace/external`): empty state — PASS
- [x] New External Sub (`/workspace/external/new`): form renders — PASS
- [x] Import (`/workspace/import`): CSR import page — PASS
- [x] Settings (`/settings`): user settings form — PASS
- [ ] Submission Detail: SKIPPED (covered in editor section)
- [ ] External Sub Detail: SKIPPED (no external submissions in seed data)

### EDITOR (9 screenshots)

- [x] Editor Dashboard (`/editor`): stats + recent activity — PASS
- [x] Editor Submissions (`/editor/submissions`): table with submissions — PASS
- [x] Editor Sub Detail (`/editor/{id}`): full submission view — PASS
- [x] Analytics (`/editor/analytics`): charts render correctly — PASS
- [x] Forms List (`/editor/forms`): form definitions table — PASS
- [x] New Form (`/editor/forms/new`): form builder renders — PASS
- [x] Periods (`/editor/periods`): submission periods list — PASS

### SLATE (14 screenshots)

- [x] Slate Dashboard (`/slate`): overview cards — PASS
- [x] Publications List (`/slate/publications`): table with pubs — PASS
- [x] Publication Detail (`/slate/publications/{id}`): detail view — PASS
- [x] Pipeline (`/slate/pipeline`): pipeline items list — PASS
- [x] Pipeline Item (`/slate/pipeline/{id}`): full detail + stage info — PASS
- [x] Issues List (`/slate/issues`): issues table — PASS
- [x] Issue Detail (`/slate/issues/{id}`): issue with TOC — PASS
- [x] Calendar (`/slate/calendar`): production calendar — PASS
- [x] Contracts List (`/slate/contracts`): contracts table — PASS
- [x] Contract Detail (`/slate/contracts/{id}`): contract view — PASS
- [x] Templates List (`/slate/contracts/templates`): templates table — PASS
- [x] Template Detail (`/slate/contracts/templates/{id}`): merge fields + body — PASS
- [x] CMS (`/slate/cms`): connections list with WordPress entry — PASS

### ADMIN (11 screenshots)

- [x] Org Settings (`/organizations/settings`): general tab with form — PASS
- [x] Webhooks List (`/webhooks`): empty state (no webhooks in seed) — PASS
- [x] New Webhook (`/webhooks/new`): form with event checkboxes — PASS
- [ ] Webhook Detail: SKIPPED — no webhooks in seed data
- [x] Plugins (`/plugins`): plugin browser with category tabs — PASS (shows "No plugins found")
- [x] Federation Home (`/federation`): config + peer summary — PASS (federation disabled)
- [x] Federation Audit (`/federation/audit`): audit log with 65 events, paginated — PASS
- [x] Federation Peers (`/federation/peers`): empty state with tabs — PASS
- [x] Sim-Sub (`/federation/sim-sub`): lookup form — PASS
- [x] Transfers (`/federation/transfers`): empty state — PASS
- [x] Migrations (`/federation/migrations`): empty state with tabs — PASS
- [x] Hub (`/federation/hub`): hub mode not enabled message — PASS

### PAYMENT (2 screenshots)

- [x] Payment Success (`/payment/success`): placeholder page — PASS
- [x] Payment Cancel (`/payment/cancel`): placeholder page — PASS

### STATES (5 screenshots)

- [x] 404 Submission (`/submissions/{nil-uuid}`): "Submission not found" + back link — PASS
- [x] 404 Pipeline Item (`/slate/pipeline/{nil-uuid}`): "Pipeline item not found" + back link — PASS
- [x] 404 Editor Sub (`/editor/{nil-uuid}`): "Submission not found" + back link — PASS
- [x] 404 Publication (`/slate/publications/{nil-uuid}`): "Publication not found" + back link — PASS
- [x] 404 Webhook (`/webhooks/{nil-uuid}`): "Webhook endpoint not found" + back link — PASS

### Summary

**Console errors:** CORS on `/api/notifications/stream` (SSE endpoint missing `Access-Control-Allow-Origin` header) — appears on all authenticated pages. This is a real bug.
**Network failures:** Identity page: `GET /.well-known/colophony` → 404 (expected — federation disabled)
**Issues found:**

- **BUG:** CORS policy blocks `GET /api/notifications/stream` from `localhost:3000` → `localhost:4000`. The SSE endpoint does not include CORS headers. Affects all authenticated pages (notification stream fails silently).

**Automation candidates:** None (first full run)

**Total screenshots:** 62 across 7 sections
**Screenshots:** `.qa/screenshots/2026-03-04/{public,writer,editor,slate,admin,payment,states}/`

---
