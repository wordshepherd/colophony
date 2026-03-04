# Manual QA Plan

> Comprehensive QA reference for visual review of every Colophony page across viewports, states, and edge cases. Complements the automated `/manual-qa` skill with checks requiring human judgment.

## Quick Start

### Prerequisites

1. **Chrome with remote debugging:**

   ```bash
   google-chrome --remote-debugging-port=9222 --user-data-dir=/tmp/chrome-qa
   ```

2. **Dev servers running:**

   ```bash
   pnpm docker:up        # Core infra
   pnpm db:migrate && pnpm db:seed
   pnpm dev              # API :4000, Web :3000
   ```

3. **Log in** via Chrome at `http://localhost:3000` before running authenticated sections.

4. **Federation** (optional): Set `FEDERATION_ENABLED=true` in `.env` for federation pages.

### Invocation

```
/manual-qa public     # Public pages only (~15 screenshots)
/manual-qa writer     # Writer section (~70 screenshots)
/manual-qa editor     # Editor section (~40 screenshots)
/manual-qa slate      # Slate section (~80 screenshots)
/manual-qa admin      # Admin section (~60 screenshots)
/manual-qa states     # Error boundaries & 404s (~30 screenshots)
/manual-qa all        # Everything (~300 screenshots)
```

Screenshots land in `.qa/screenshots/YYYY-MM-DD/{section}/`.

---

## Section Checklists

### Public (5 pages)

| Page         | URL                         | Expected Behavior                            | Key Elements                      | States |
| ------------ | --------------------------- | -------------------------------------------- | --------------------------------- | ------ |
| Landing      | `/`                         | Marketing/welcome page loads                 | Hero, nav, CTA buttons            | loaded |
| Identity     | `/identity`                 | Redirects to Zitadel login or shows login UI | Login form, SSO buttons           | loaded |
| Embed Form   | `/embed/{token}`            | Submission form renders in embed mode        | Form fields, submit button, theme | loaded |
| Embed Status | `/embed/status/{token}`     | Shows submission tracking status             | Status badge, timeline            | loaded |
| Auth Error   | `/auth/callback?error=test` | Shows friendly error message                 | Error message, retry link         | error  |

### Writer (16 pages)

| Page              | URL                         | Expected Behavior              | Key Elements                                   | States        |
| ----------------- | --------------------------- | ------------------------------ | ---------------------------------------------- | ------------- |
| Submissions List  | `/submissions`              | Table of user's submissions    | Data table, filters, pagination, status badges | loaded, empty |
| New Submission    | `/submissions/new`          | Submission creation form       | Form wizard, file upload, category select      | loaded        |
| Submission Detail | `/submissions/{id}`         | Full submission view           | Title, status, metadata, file list, history    | loaded        |
| Edit Submission   | `/submissions/{id}/edit`    | Edit form pre-filled           | Same as new, pre-populated fields              | loaded        |
| Manuscripts List  | `/manuscripts`              | Table of manuscripts           | Data table, status badges                      | loaded, empty |
| New Manuscript    | `/manuscripts/new`          | Manuscript creation form       | Title, body editor, metadata                   | loaded        |
| Manuscript Detail | `/manuscripts/{id}`         | Full manuscript view           | Title, content, linked submissions             | loaded        |
| Workspace Home    | `/workspace`                | Writer dashboard overview      | Stats cards, recent activity                   | loaded        |
| Correspondence    | `/workspace/correspondence` | Messages/notifications         | Message list, read/unread                      | loaded, empty |
| Portfolio         | `/workspace/portfolio`      | Cross-org submission portfolio | Aggregated table, org badges, status           | loaded        |
| Writer Analytics  | `/workspace/analytics`      | Personal submission stats      | Charts, metrics cards, date filters            | loaded        |
| External Subs     | `/workspace/external`       | External submissions list      | Table with external venue info                 | loaded, empty |
| New External      | `/workspace/external/new`   | Add external submission        | Form with venue, date, status                  | loaded        |
| External Detail   | `/workspace/external/{id}`  | External submission view       | Venue, status, dates, notes                    | loaded        |
| Import            | `/workspace/import`         | CSR import interface           | File upload, preview, mapping                  | loaded        |
| Settings          | `/settings`                 | User preferences               | Profile form, notification prefs               | loaded        |

### Editor (8 pages)

| Page              | URL                   | Expected Behavior              | Key Elements                                       | States        |
| ----------------- | --------------------- | ------------------------------ | -------------------------------------------------- | ------------- |
| Dashboard         | `/editor`             | Editor overview                | Stats cards, pending reviews, quick actions        | loaded        |
| Submissions       | `/editor/submissions` | All org submissions            | Data table, status filters, bulk actions           | loaded        |
| Submission Detail | `/editor/{id}`        | Review interface               | Submission content, review panel, decision buttons | loaded        |
| Analytics         | `/editor/analytics`   | Submission analytics dashboard | Charts, filters, date range, export                | loaded        |
| Forms List        | `/editor/forms`       | Submission form configs        | Table of forms, status toggles                     | loaded, empty |
| New Form          | `/editor/forms/new`   | Form builder                   | Drag-and-drop fields, preview, settings            | loaded        |
| Form Detail       | `/editor/forms/{id}`  | Edit existing form             | Same as new, pre-populated                         | loaded        |
| Periods           | `/editor/periods`     | Submission periods             | Table, date ranges, open/closed status             | loaded        |

### Slate (20 pages)

| Page               | URL                                    | Expected Behavior             | Key Elements                             | States        |
| ------------------ | -------------------------------------- | ----------------------------- | ---------------------------------------- | ------------- |
| Dashboard          | `/slate`                               | Publication pipeline overview | Stats, pipeline summary, recent activity | loaded        |
| Publications       | `/slate/publications`                  | Publications list             | Table, status badges, filters            | loaded, empty |
| New Publication    | `/slate/publications/new`              | Create publication            | Title, type, metadata form               | loaded        |
| Publication Detail | `/slate/publications/{id}`             | Publication view              | Content, status, linked items            | loaded        |
| Edit Publication   | `/slate/publications/{id}/edit`        | Edit publication              | Pre-populated form                       | loaded        |
| Pipeline           | `/slate/pipeline`                      | Pipeline board/list           | Stage columns or table, drag support     | loaded, empty |
| Pipeline Item      | `/slate/pipeline/{id}`                 | Item detail                   | Stage, assignee, history, actions        | loaded        |
| Issues             | `/slate/issues`                        | Issues list                   | Table, date, status                      | loaded        |
| New Issue          | `/slate/issues/new`                    | Create issue                  | Form with pieces, date, metadata         | loaded        |
| Issue Detail       | `/slate/issues/{id}`                   | Issue view                    | Pieces list, status, publication date    | loaded        |
| Edit Issue         | `/slate/issues/{id}/edit`              | Edit issue                    | Pre-populated form                       | loaded        |
| Calendar           | `/slate/calendar`                      | Publication calendar          | Calendar grid, scheduled items           | loaded        |
| Contracts          | `/slate/contracts`                     | Contracts list                | Table, status, signatory info            | loaded        |
| Contract Detail    | `/slate/contracts/{id}`                | Contract view                 | Terms, status, signatures                | loaded        |
| Templates          | `/slate/contracts/templates`           | Template list                 | Table of templates                       | loaded        |
| New Template       | `/slate/contracts/templates/new`       | Create template               | Form with clause editor                  | loaded        |
| Template Detail    | `/slate/contracts/templates/{id}`      | Template view                 | Clauses, variables, preview              | loaded        |
| Edit Template      | `/slate/contracts/templates/{id}/edit` | Edit template                 | Pre-populated form                       | loaded        |
| CMS                | `/slate/cms`                           | CMS content list              | Table of content entries                 | loaded, empty |
| New CMS Entry      | `/slate/cms/new`                       | Create CMS entry              | Rich editor, metadata                    | loaded        |

### Admin (15 pages)

| Page             | URL                           | Expected Behavior                | Key Elements                           | States        |
| ---------------- | ----------------------------- | -------------------------------- | -------------------------------------- | ------------- |
| Org Settings     | `/organizations/settings`     | Organization configuration       | Name, slug, branding, members          | loaded        |
| Webhooks List    | `/webhooks`                   | Webhook endpoints                | Table, status, last delivery           | loaded, empty |
| New Webhook      | `/webhooks/new`               | Create webhook                   | URL, events, secret form               | loaded        |
| Webhook Detail   | `/webhooks/{id}`              | Webhook config + delivery log    | Config form, delivery history          | loaded        |
| Plugins          | `/plugins`                    | Installed plugins                | Plugin cards, enable/disable           | loaded        |
| Federation Home  | `/federation`                 | Federation dashboard             | Status, peer count, recent activity    | loaded        |
| Federation Audit | `/federation/audit`           | Audit log                        | Table with timestamps, actions, actors | loaded        |
| Peers            | `/federation/peers`           | Connected peers                  | Table with domain, status, trust level | loaded, empty |
| Sim-Sub          | `/federation/sim-sub`         | Simultaneous submission tracking | Table with cross-instance submissions  | loaded, empty |
| Transfers        | `/federation/transfers`       | Piece transfers                  | Table with status, source, destination | loaded, empty |
| Transfer Detail  | `/federation/transfers/{id}`  | Transfer detail                  | Timeline, pieces, approval status      | loaded        |
| Migrations       | `/federation/migrations`      | Data migrations                  | Table with status, progress            | loaded, empty |
| Migration Detail | `/federation/migrations/{id}` | Migration detail                 | Bundle contents, progress, errors      | loaded        |
| Hub List         | `/federation/hub`             | Hub connections                  | Table with hub domains, status         | loaded, empty |
| Hub Detail       | `/federation/hub/{id}`        | Hub detail                       | Connection info, sync status           | loaded        |

### Payment (2 pages)

| Page            | URL                | Expected Behavior                    | Key Elements                | States |
| --------------- | ------------------ | ------------------------------------ | --------------------------- | ------ |
| Payment Success | `/payment/success` | Stripe Checkout success confirmation | Success heading, next steps | loaded |
| Payment Cancel  | `/payment/cancel`  | Stripe Checkout cancellation message | Cancel heading, retry link  | loaded |

Note: These are callback pages for the submission fee flow (configured via submission periods with a fee amount). Currently placeholder pages.

---

## Cross-Cutting Checks

### Responsive Design

Check at three breakpoints: desktop (1440px), tablet (768px), mobile (375px).

- [ ] **Sidebar** collapses to hamburger on mobile
- [ ] **Data tables** scroll horizontally or stack on mobile
- [ ] **Forms** stack fields vertically on mobile
- [ ] **Dialogs** are properly sized and scrollable on mobile
- [ ] **Navigation** is reachable on all viewports
- [ ] **Charts** resize or scroll without overlapping labels
- [ ] **Page titles** don't overflow or truncate awkwardly

### Dark Mode

Inject `document.documentElement.classList.add('dark')` and verify:

- [ ] **Text contrast** is readable (no light-on-light or dark-on-dark)
- [ ] **Chart colors** remain distinguishable
- [ ] **Borders** are visible against dark backgrounds
- [ ] **Form inputs** have visible borders and placeholder text
- [ ] **Status badges** maintain color meaning
- [ ] **Shadows** don't create harsh edges
- [ ] **Images/logos** have appropriate treatment (invert or swap)

### Error Handling

- [ ] **Error boundary** renders user-friendly message (not stack trace)
- [ ] **404 routes** show "not found" page (not blank or crash)
- [ ] **Network timeout** shows retry option or helpful message
- [ ] **403 Forbidden** shows access denied (not raw error)
- [ ] **Invalid UUID** in URL doesn't crash (graceful error)
- [ ] **Expired session** redirects to login (not infinite spinner)

### Empty States

- [ ] **Message** is descriptive (not just "No data")
- [ ] **CTA button** is present where applicable ("Create your first...")
- [ ] **Charts** show placeholder or "No data yet" (not broken axes)
- [ ] **Tables** show empty message row (not blank space)
- [ ] **Filters** that produce no results show "No matches" with clear-filters option

### Loading States

- [ ] **Skeleton loaders** appear during data fetch (not blank page)
- [ ] **No FOUC** (flash of unstyled content) on page transitions
- [ ] **Button loading** indicators during form submission
- [ ] **Progress indicators** for file uploads
- [ ] **Spinner/skeleton** for lazy-loaded components

### Accessibility

- [ ] **Keyboard navigation** reaches all interactive elements
- [ ] **Focus visible** indicator on focused elements
- [ ] **Landmarks** present (main, nav, aside, footer)
- [ ] **Alt text** on meaningful images
- [ ] **ARIA labels** on icon-only buttons
- [ ] **Color** is not the only indicator of state (icons/text supplement)
- [ ] **Form labels** are associated with inputs

---

## Edge Cases (Manual Only)

These require human interaction and timing that automated MCP capture can't reliably handle.

### Form Validation

- [ ] Submit with all required fields empty — error messages appear inline
- [ ] Max length inputs — text truncates or shows counter
- [ ] Special characters in text fields (`<script>`, `"quotes"`, `emoji`)
- [ ] Rich text paste from Word/Google Docs — formatting cleaned
- [ ] File upload: zero-byte file, oversized file, wrong MIME type
- [ ] Date pickers: past dates, far-future dates, invalid ranges

### State Transitions

- [ ] **Double-click submit** — only one request fires (button disabled)
- [ ] **Unsaved changes warning** — navigate away triggers prompt
- [ ] **Back button** — form state preserved or properly reset
- [ ] **Session timeout** — mid-form, redirects to login, data recoverable?
- [ ] **Concurrent edits** — two tabs editing same entity, last-write-wins?

### Multi-Tab Behavior

- [ ] **Logout in one tab** — other tabs detect and redirect
- [ ] **Org switch in one tab** — other tabs update or show stale notice
- [ ] **Concurrent form edits** — no silent data loss

### Performance

- [ ] **50+ items in table** — pagination works, no excessive render time
- [ ] **Large date ranges** on analytics — charts don't freeze
- [ ] **Rapid navigation** — no memory leaks or stale data

---

## Screenshot Review Workflow

1. **Capture**: Run `/manual-qa {section}` to generate screenshots in `.qa/screenshots/YYYY-MM-DD/`
2. **Review**: Open screenshot directory, compare against expected layouts
3. **Flag**: Log issues in `docs/qa-log.md` with page name and description
4. **Tag**: Add `[AUTOMATE]` to any check appearing 3+ times in the log
5. **Promote**: Convert `[AUTOMATE]` items to Playwright E2E tests via `/new-e2e`

---

## Appendix A: Seed Data Reference

Seed data created by `pnpm db:seed`. Use these known values for QA navigation.

### Organizations

| Slug               | Name             | Purpose                              |
| ------------------ | ---------------- | ------------------------------------ |
| `quarterly-review` | Quarterly Review | Primary org with full data           |
| `inkwell-press`    | Inkwell Press    | Minimal data for empty-state testing |

### Users (Zitadel)

Refer to `pnpm zitadel:setup` output for test user credentials.

### Submissions

Seeded in `quarterly-review` org. Query for current IDs:

```sql
SELECT id, title, status FROM submissions
JOIN organizations ON submissions.organization_id = organizations.id
WHERE organizations.slug = 'quarterly-review'
ORDER BY created_at DESC;
```

### Pipeline Items

```sql
SELECT id, stage FROM pipeline_items
JOIN organizations ON pipeline_items.organization_id = organizations.id
WHERE organizations.slug = 'quarterly-review';
```

### Publications, Issues, Contracts

Similar queries — join on `organization_id` and filter by `quarterly-review` slug.

### Forms

```sql
SELECT id, name, public_token FROM submission_forms
JOIN organizations ON submission_forms.organization_id = organizations.id
WHERE organizations.slug = 'quarterly-review';
```

---

## Appendix B: MCP Tool Quick Reference

Chrome DevTools MCP tools used by the `/manual-qa` skill:

| Tool                                          | Purpose                                  |
| --------------------------------------------- | ---------------------------------------- |
| `mcp__chrome-devtools__list_pages`            | Verify Chrome connection                 |
| `mcp__chrome-devtools__navigate_page`         | Navigate to URL                          |
| `mcp__chrome-devtools__wait_for`              | Wait for selector to appear              |
| `mcp__chrome-devtools__take_screenshot`       | Capture page screenshot                  |
| `mcp__chrome-devtools__evaluate_script`       | Run JS (viewport, dark mode, org switch) |
| `mcp__chrome-devtools__list_console_messages` | Check for JS errors                      |
| `mcp__chrome-devtools__list_network_requests` | Check for failed requests                |

Postgres MCP is used for ID discovery queries (see Step 2 in skill).
