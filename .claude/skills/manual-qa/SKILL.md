---
name: manual-qa
description: Automated visual QA walkthrough — capture screenshots across viewports, states, and sections via Chrome DevTools MCP.
---

# /manual-qa

Automated visual QA walkthrough using Chrome DevTools MCP. Captures screenshots across viewports (desktop + mobile), states (loaded, empty, error, dark), and logs findings to `docs/qa-log.md`.

## What this skill does

1. Validates prerequisites (Chrome DevTools, dev server, seed data)
2. Queries postgres MCP for real IDs from seed data
3. Walks every page in the selected section, capturing desktop + mobile + dark mode screenshots
4. Checks console errors and network failures per page
5. Switches orgs for empty-state captures
6. Generates a QA log entry and summary report

## Usage

```
/manual-qa [section]
```

| Argument  | Scope                                                    | Est. Screenshots |
| --------- | -------------------------------------------------------- | ---------------- |
| `all`     | All sections in order                                    | ~310             |
| `public`  | Landing, identity, embed                                 | ~15              |
| `writer`  | Submissions, manuscripts, workspace, settings            | ~70              |
| `editor`  | Editor dashboard, forms, periods, analytics              | ~40              |
| `slate`   | Publications, pipeline, issues, contracts, CMS, calendar | ~80              |
| `admin`   | Org settings, webhooks, plugins, federation              | ~60              |
| `payment` | Stripe Checkout callback pages (success, cancel)         | ~6               |
| `states`  | Error boundaries, 404s, empty states across sections     | ~30              |
| (no arg)  | Prompt user to choose section                            | —                |

## Instructions for Claude

When the user invokes `/manual-qa`, perform these steps in order.

### Step 1: Prerequisites check

Verify all dependencies are available. Run these checks:

**1a. Chrome DevTools MCP connection:**

```
mcp__chrome-devtools__list_pages
```

If this fails, tell the user:

> Chrome must be running with `--remote-debugging-port=9222`. Launch it with:
>
> ```bash
> google-chrome --remote-debugging-port=9222 --user-data-dir=/tmp/chrome-qa
> ```

**1b. Dev server responding:**

```
mcp__chrome-devtools__navigate_page with url "http://localhost:3000"
```

If navigation fails or returns an error page, tell the user:

> Dev servers must be running. Start with `pnpm dev` (requires Docker infra via `pnpm docker:up`).

**1c. Seed data exists:**

```sql
-- via postgres MCP
SELECT id, slug FROM organizations WHERE slug IN ('quarterly-review', 'inkwell-press');
```

If `quarterly-review` is missing, tell the user:

> Seed data required. Run `pnpm db:seed`.

**1d. Create output directory:**

```bash
mkdir -p .qa/screenshots/$(date +%Y-%m-%d)/
```

**1e. Parse argument:**

If no argument provided, ask the user which section to run using AskUserQuestion with options: `all`, `public`, `writer`, `editor`, `slate`, `admin`, `payment`, `states`.

### Step 2: Session setup — discover IDs

Query postgres MCP for all IDs needed by the selected section. Store results in a mental lookup table for URL interpolation.

**For `writer` section (or `all`):**

```sql
SELECT s.id, s.title, s.status
FROM submissions s
JOIN organizations o ON s.organization_id = o.id
WHERE o.slug = 'quarterly-review'
ORDER BY s.created_at DESC LIMIT 5;

SELECT m.id, m.title
FROM manuscripts m
JOIN organizations o ON m.organization_id = o.id
WHERE o.slug = 'quarterly-review'
LIMIT 3;
```

**For `editor` section (or `all`):**

```sql
SELECT sf.id, sf.name
FROM submission_forms sf
JOIN organizations o ON sf.organization_id = o.id
WHERE o.slug = 'quarterly-review'
LIMIT 3;

SELECT sp.id, sp.name
FROM submission_periods sp
JOIN organizations o ON sp.organization_id = o.id
WHERE o.slug = 'quarterly-review'
LIMIT 3;
```

**For `slate` section (or `all`):**

```sql
SELECT p.id, p.title
FROM publications p
JOIN organizations o ON p.organization_id = o.id
WHERE o.slug = 'quarterly-review'
LIMIT 3;

SELECT pi.id, pi.stage
FROM pipeline_items pi
JOIN organizations o ON pi.organization_id = o.id
WHERE o.slug = 'quarterly-review'
LIMIT 3;

SELECT i.id, i.title
FROM issues i
JOIN organizations o ON i.organization_id = o.id
WHERE o.slug = 'quarterly-review'
LIMIT 3;

SELECT c.id
FROM contracts c
JOIN organizations o ON c.organization_id = o.id
WHERE o.slug = 'quarterly-review'
LIMIT 2;

SELECT ct.id, ct.name
FROM contract_templates ct
JOIN organizations o ON ct.organization_id = o.id
WHERE o.slug = 'quarterly-review'
LIMIT 2;
```

**For `admin` section (or `all`):**

```sql
SELECT w.id, w.url
FROM webhooks w
JOIN organizations o ON w.organization_id = o.id
WHERE o.slug = 'quarterly-review'
LIMIT 2;

SELECT fp.id, fp.domain
FROM federation_peers fp
LIMIT 2;

SELECT ft.id
FROM federation_transfers ft
LIMIT 2;

SELECT fm.id
FROM federation_migrations fm
LIMIT 2;
```

**For `public` section (or `all`):**

```sql
SELECT sf.id, sf.public_token
FROM submission_forms sf
JOIN organizations o ON sf.organization_id = o.id
WHERE o.slug = 'quarterly-review' AND sf.public_token IS NOT NULL
LIMIT 1;
```

**For empty states — get inkwell-press org ID:**

```sql
SELECT id FROM organizations WHERE slug = 'inkwell-press';
```

Set desktop viewport as default (1440x900):

```
mcp__chrome-devtools__evaluate_script with expression:
"window.__origWidth = window.innerWidth; window.__origHeight = window.innerHeight;"
```

### Step 3: Screenshot capture protocol

For each page in the section catalog (Step 4), follow this protocol:

**3a. Navigate:**

```
mcp__chrome-devtools__navigate_page with url "<resolved-url>"
```

**3b. Wait for content:**

```
mcp__chrome-devtools__wait_for with selector "<wait-selector>" and timeout 10000
```

If wait times out, capture anyway but flag in the log as `[TIMEOUT]`.

**3c. Desktop screenshot (1440x900):**

Set viewport first:

```
mcp__chrome-devtools__evaluate_script with expression:
"(async()=>{await (await import('chrome-remote-interface')).send?.('Emulation.setDeviceMetricsOverride',{width:1440,height:900,deviceScaleFactor:1,mobile:false})||true})()"
```

If the above doesn't work (MCP may not support CDP directly), use:

```
mcp__chrome-devtools__evaluate_script with expression:
"document.documentElement.style.width='1440px'; document.documentElement.style.minHeight='900px'; true"
```

Then capture:

```
mcp__chrome-devtools__take_screenshot
```

Save as: `.qa/screenshots/YYYY-MM-DD/{section}/{NN}-{page-name}-desktop-{state}.png`

**3d. Mobile screenshot (375x812):**

```
mcp__chrome-devtools__evaluate_script with expression:
"(async()=>{const p=window.CDP||null;if(p)await p.send('Emulation.setDeviceMetricsOverride',{width:375,height:812,deviceScaleFactor:2,mobile:true});else{document.querySelector('meta[name=viewport]')?.setAttribute('content','width=375');document.documentElement.style.width='375px';}true})()"
```

Wait 500ms for reflow, then screenshot.
Save as: `.qa/screenshots/YYYY-MM-DD/{section}/{NN}-{page-name}-mobile-{state}.png`

**3e. Dark mode (desktop only):**

```
mcp__chrome-devtools__evaluate_script with expression:
"document.documentElement.classList.add('dark'); true"
```

Wait 300ms, screenshot.
Save as: `.qa/screenshots/YYYY-MM-DD/{section}/{NN}-{page-name}-desktop-dark.png`

Remove dark mode:

```
mcp__chrome-devtools__evaluate_script with expression:
"document.documentElement.classList.remove('dark'); true"
```

**3f. Console check:**

```
mcp__chrome-devtools__list_console_messages
```

Record any `error` level messages. Ignore `warning` about React DevTools, favicon, or HMR.

**3g. Network check:**

```
mcp__chrome-devtools__list_network_requests
```

Flag any 4xx or 5xx responses (ignore 304, ignore `/api/trpc` polling with expected 401 on public pages).

**3h. Reset viewport:**

Restore to 1440x900 desktop for next page.

### Screenshot naming convention

Pattern: `{section}/{NN}-{page-name}-{viewport}-{state}.png`

- `NN`: zero-padded sequence (01, 02, ...)
- `viewport`: `desktop` | `mobile`
- `state`: `loaded` | `empty` | `error` | `dark`

Example: `.qa/screenshots/2026-03-04/writer/03-submission-detail-desktop-loaded.png`

### Step 4: Page catalog

Process pages for the selected section. Each entry: URL, wait selector, states to capture, notes.

Before capturing, check if the screenshot already exists in today's directory. If it does, skip (supports resumability).

---

#### PUBLIC section (5 pages)

| #   | Page                | URL                           | Wait Selector | States | Notes                                             |
| --- | ------------------- | ----------------------------- | ------------- | ------ | ------------------------------------------------- |
| 01  | Landing             | `/`                           | `main`        | loaded | Public page, no auth needed                       |
| 02  | Identity / Login    | `/identity`                   | `main, form`  | loaded | Zitadel login page redirect                       |
| 03  | Embed Form          | `/embed/{publicToken}`        | `form`        | loaded | Use token from setup query                        |
| 04  | Embed Status        | `/embed/status/{statusToken}` | `main`        | loaded | May need a real status token; skip if unavailable |
| 05  | Auth Callback Error | `/auth/callback?error=test`   | `main`        | error  | Simulates OIDC error                              |

---

#### WRITER section (16 pages)

User must be logged in. Navigate to `http://localhost:3000` first to verify auth.

| #   | Page                | URL                                | Wait Selector    | States        | Notes                          |
| --- | ------------------- | ---------------------------------- | ---------------- | ------------- | ------------------------------ |
| 01  | Submissions List    | `/submissions`                     | `main h1, table` | loaded, empty | Empty: switch to inkwell-press |
| 02  | New Submission      | `/submissions/new`                 | `form`           | loaded        |                                |
| 03  | Submission Detail   | `/submissions/{submissionId}`      | `main h1`        | loaded        | Use first submission ID        |
| 04  | Edit Submission     | `/submissions/{submissionId}/edit` | `form`           | loaded        |                                |
| 05  | Manuscripts List    | `/manuscripts`                     | `main h1`        | loaded, empty | Empty: switch to inkwell-press |
| 06  | New Manuscript      | `/manuscripts/new`                 | `form`           | loaded        |                                |
| 07  | Manuscript Detail   | `/manuscripts/{manuscriptId}`      | `main h1`        | loaded        |                                |
| 08  | Workspace Home      | `/workspace`                       | `main h1`        | loaded        |                                |
| 09  | Correspondence      | `/workspace/correspondence`        | `main h1`        | loaded, empty | Empty: switch to inkwell-press |
| 10  | Portfolio           | `/workspace/portfolio`             | `main h1`        | loaded        |                                |
| 11  | Writer Analytics    | `/workspace/analytics`             | `main h1`        | loaded        |                                |
| 12  | External Subs List  | `/workspace/external`              | `main h1`        | loaded, empty | Empty: switch to inkwell-press |
| 13  | New External Sub    | `/workspace/external/new`          | `form`           | loaded        |                                |
| 14  | External Sub Detail | `/workspace/external/{externalId}` | `main h1`        | loaded        | May need query; skip if none   |
| 15  | Import              | `/workspace/import`                | `main h1`        | loaded        |                                |
| 16  | Settings            | `/settings`                        | `main h1, form`  | loaded        |                                |

---

#### EDITOR section (8 pages)

| #   | Page               | URL                      | Wait Selector    | States        | Notes                          |
| --- | ------------------ | ------------------------ | ---------------- | ------------- | ------------------------------ |
| 01  | Editor Dashboard   | `/editor`                | `main h1`        | loaded        |                                |
| 02  | Editor Submissions | `/editor/submissions`    | `main h1, table` | loaded        |                                |
| 03  | Editor Sub Detail  | `/editor/{submissionId}` | `main h1`        | loaded        | Use first submission ID        |
| 04  | Analytics          | `/editor/analytics`      | `main h1`        | loaded        |                                |
| 05  | Forms List         | `/editor/forms`          | `main h1`        | loaded, empty | Empty: switch to inkwell-press |
| 06  | New Form           | `/editor/forms/new`      | `form`           | loaded        |                                |
| 07  | Form Detail        | `/editor/forms/{formId}` | `main h1, form`  | loaded        |                                |
| 08  | Periods            | `/editor/periods`        | `main h1`        | loaded        |                                |

---

#### SLATE section (20 pages)

| #   | Page               | URL                                            | Wait Selector | States        | Notes                          |
| --- | ------------------ | ---------------------------------------------- | ------------- | ------------- | ------------------------------ |
| 01  | Slate Dashboard    | `/slate`                                       | `main h1`     | loaded        |                                |
| 02  | Publications List  | `/slate/publications`                          | `main h1`     | loaded, empty | Empty: switch to inkwell-press |
| 03  | New Publication    | `/slate/publications/new`                      | `form`        | loaded        |                                |
| 04  | Publication Detail | `/slate/publications/{pubId}`                  | `main h1`     | loaded        |                                |
| 05  | Edit Publication   | `/slate/publications/{pubId}/edit`             | `form`        | loaded        |                                |
| 06  | Pipeline           | `/slate/pipeline`                              | `main h1`     | loaded, empty | Empty: switch to inkwell-press |
| 07  | Pipeline Item      | `/slate/pipeline/{pipelineId}`                 | `main h1`     | loaded        |                                |
| 08  | Issues List        | `/slate/issues`                                | `main h1`     | loaded        |                                |
| 09  | New Issue          | `/slate/issues/new`                            | `form`        | loaded        |                                |
| 10  | Issue Detail       | `/slate/issues/{issueId}`                      | `main h1`     | loaded        |                                |
| 11  | Edit Issue         | `/slate/issues/{issueId}/edit`                 | `form`        | loaded        |                                |
| 12  | Calendar           | `/slate/calendar`                              | `main h1`     | loaded        |                                |
| 13  | Contracts List     | `/slate/contracts`                             | `main h1`     | loaded        |                                |
| 14  | Contract Detail    | `/slate/contracts/{contractId}`                | `main h1`     | loaded        |                                |
| 15  | Templates List     | `/slate/contracts/templates`                   | `main h1`     | loaded        |                                |
| 16  | New Template       | `/slate/contracts/templates/new`               | `form`        | loaded        |                                |
| 17  | Template Detail    | `/slate/contracts/templates/{templateId}`      | `main h1`     | loaded        |                                |
| 18  | Edit Template      | `/slate/contracts/templates/{templateId}/edit` | `form`        | loaded        |                                |
| 19  | CMS                | `/slate/cms`                                   | `main h1`     | loaded, empty | Empty: switch to inkwell-press |
| 20  | New CMS Entry      | `/slate/cms/new`                               | `form`        | loaded        |                                |

---

#### ADMIN section (15 pages)

| #   | Page             | URL                                    | Wait Selector   | States        | Notes                          |
| --- | ---------------- | -------------------------------------- | --------------- | ------------- | ------------------------------ |
| 01  | Org Settings     | `/organizations/settings`              | `main h1, form` | loaded        |                                |
| 02  | Webhooks List    | `/webhooks`                            | `main h1`       | loaded, empty | Empty: switch to inkwell-press |
| 03  | New Webhook      | `/webhooks/new`                        | `form`          | loaded        |                                |
| 04  | Webhook Detail   | `/webhooks/{webhookId}`                | `main h1`       | loaded        |                                |
| 05  | Plugins          | `/plugins`                             | `main h1`       | loaded        |                                |
| 06  | Federation Home  | `/federation`                          | `main h1`       | loaded        | Needs FEDERATION_ENABLED=true  |
| 07  | Federation Audit | `/federation/audit`                    | `main h1`       | loaded        |                                |
| 08  | Federation Peers | `/federation/peers`                    | `main h1`       | loaded, empty | Empty: switch to inkwell-press |
| 09  | Sim-Sub          | `/federation/sim-sub`                  | `main h1`       | loaded, empty | Empty: switch to inkwell-press |
| 10  | Transfers List   | `/federation/transfers`                | `main h1`       | loaded, empty | Empty: switch to inkwell-press |
| 11  | Transfer Detail  | `/federation/transfers/{transferId}`   | `main h1`       | loaded        | Skip if no transfers exist     |
| 12  | Migrations List  | `/federation/migrations`               | `main h1`       | loaded, empty | Empty: switch to inkwell-press |
| 13  | Migration Detail | `/federation/migrations/{migrationId}` | `main h1`       | loaded        | Skip if no migrations exist    |
| 14  | Hub List         | `/federation/hub`                      | `main h1`       | loaded, empty | Empty: switch to inkwell-press |
| 15  | Hub Detail       | `/federation/hub/{hubId}`              | `main h1`       | loaded        | Skip if no hub entries exist   |

---

#### PAYMENT section (2 pages)

Stripe Checkout callback pages. These are placeholder pages for the submission fee flow.

| #   | Page            | URL                | Wait Selector | States | Notes                                 |
| --- | --------------- | ------------------ | ------------- | ------ | ------------------------------------- |
| 01  | Payment Success | `/payment/success` | `main h1`     | loaded | Stripe Checkout success redirect      |
| 02  | Payment Cancel  | `/payment/cancel`  | `main h1`     | loaded | Stripe Checkout cancellation redirect |

---

#### STATES section (error boundaries + 404s)

| #   | Page              | URL                                                        | Wait Selector | States | Notes                             |
| --- | ----------------- | ---------------------------------------------------------- | ------------- | ------ | --------------------------------- |
| 01  | 404 Submission    | `/submissions/00000000-0000-0000-0000-000000000000`        | `main`        | error  | Should show error boundary or 404 |
| 02  | 404 Pipeline Item | `/slate/pipeline/00000000-0000-0000-0000-000000000000`     | `main`        | error  |                                   |
| 03  | 404 Editor Sub    | `/editor/00000000-0000-0000-0000-000000000000`             | `main`        | error  |                                   |
| 04  | 404 Publication   | `/slate/publications/00000000-0000-0000-0000-000000000000` | `main`        | error  |                                   |
| 05  | 404 Webhook       | `/webhooks/00000000-0000-0000-0000-000000000000`           | `main`        | error  |                                   |

### Step 5: Org switching for empty states

When a page needs the `empty` state, switch to the `inkwell-press` org:

```
mcp__chrome-devtools__evaluate_script with expression:
"localStorage.setItem('colophony-org-id', '<inkwell-org-id>'); window.location.reload(); true"
```

Wait for the page to reload (`mcp__chrome-devtools__wait_for` with `main`), then capture the screenshot.

After all empty-state captures for that page, switch back to `quarterly-review`:

```
mcp__chrome-devtools__evaluate_script with expression:
"localStorage.setItem('colophony-org-id', '<quarterly-review-org-id>'); window.location.reload(); true"
```

Batch empty-state captures together per page to minimize org switches.

### Step 6: QA log entry

After completing a section, append an entry to `docs/qa-log.md` above the `---` separator at the bottom. Use this format:

```markdown
## YYYY-MM-DD — Manual QA: [Section Name]

**Method:** Chrome DevTools MCP
**Areas tested:**

- [x] [Page Name]: visual review + screenshot at [viewports] — PASS
- [x] [Page Name]: visual review + screenshot at [viewports] — PASS
      (list all pages, mark FAIL for any with console errors or network failures)

**Console errors:** None | [page: error message]
**Network failures:** None | [page: status code + URL]
**Issues found:** None | #N: [description]
**Automation candidates:** None | [description of repeated manual check]
```

### Step 7: Summary report

After all pages in the section are processed, print a summary:

```
## QA Summary: [Section]

Total screenshots: NN
Console errors: NN (pages: ...)
Network failures: NN (pages: ...)
Timeouts: NN (pages: ...)
Skipped (already captured): NN

Suggested follow-ups:
- [any issues found]
- [any pages that need manual re-check]
```

## Known limitations

- **Viewport resize** via `evaluate_script` is approximate — true mobile device emulation requires Chrome DevTools UI
- **Dark mode** validates CSS class injection but the app has no runtime theme toggle (only embed has ThemeProvider)
- **User must be logged in** via Chrome before running writer/editor/slate/admin sections
- **Loading/skeleton states** are timing-dependent and cannot be reliably captured via MCP
- **Federation pages** may show empty unless `FEDERATION_ENABLED=true` is set in `.env`
- **Embed status token** requires a real submission with status tracking; skip if unavailable
- **External submission detail** requires writer workspace entries; skip if none exist in seed data

## Important notes

- Run sections individually for manageability. `all` can take 30+ minutes.
- Screenshots are saved to `.qa/screenshots/YYYY-MM-DD/` which is gitignored.
- The skill is resumable — it checks for existing screenshots before recapturing.
- Console error filtering ignores: React DevTools warnings, favicon 404, HMR messages.
- Network check ignores: 304 (cache), expected 401 on public pages.
- If a page times out on wait, it's still captured but flagged `[TIMEOUT]` in the log.
- The `states` section runs independently of other sections (no org switching needed).
