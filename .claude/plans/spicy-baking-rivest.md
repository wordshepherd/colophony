# Accessibility P2 Improvements

## Context

All 10 development tracks are complete. Four P2 accessibility items remain in the backlog (from persona gap analysis 2026-02-27). These improve usability for color-blind users and screen reader users. The `ScanStatusBadge` in `file-upload.tsx` already demonstrates the icon+color pattern we'll follow for status badges.

---

## 1. Status Badges: Add Icons Alongside Color

**Goal:** Color-blind users can distinguish statuses without relying on color alone.

**Approach:** Add a Lucide icon to each status config entry (following the existing `ScanStatusBadge` pattern in `file-upload.tsx:32-85`). Render `<Icon className="h-3 w-3" />` before the label text, with `gap-1` on the Badge.

### Files to modify

**`apps/web/src/components/submissions/status-badge.tsx`** — SubmissionStatus (8 statuses)

- Extend `statusConfig` type to include `icon: React.ComponentType<{ className?: string }>`
- Icon mapping:
  - DRAFT → `FileEdit` (gray)
  - SUBMITTED → `Send` (blue)
  - UNDER_REVIEW → `Eye` (yellow)
  - ACCEPTED → `CheckCircle` (green)
  - REJECTED → `XCircle` (red)
  - HOLD → `Pause` (orange)
  - REVISE_AND_RESUBMIT → `RotateCcw` (amber)
  - WITHDRAWN → `Ban` (purple)
- Render: `<Badge ...><Icon className="h-3 w-3" />{config.label}</Badge>` with `gap-1`

**`apps/web/src/components/workspace/csr-status-badge.tsx`** — CSRStatus (10 statuses)

- Extend `statusConfig` type to include `icon`
- Icon mapping:
  - draft → `FileEdit`
  - sent → `Send`
  - in_review → `Eye`
  - hold → `Pause`
  - accepted → `CheckCircle`
  - rejected → `XCircle`
  - withdrawn → `Ban`
  - no_response → `Clock`
  - revise → `RotateCcw`
  - unknown → `HelpCircle`
- Render: same pattern as above

**`apps/web/src/components/slate/issue-status-badge.tsx`** — IssueStatus (5 statuses)

- PLANNING → `Pencil`, ASSEMBLING → `Layers`, READY → `CheckCircle`, PUBLISHED → `Globe`, ARCHIVED → `Archive`

**`apps/web/src/components/slate/publication-status-badge.tsx`** — PublicationStatus (2 statuses)

- ACTIVE → `CheckCircle`, ARCHIVED → `Archive`

**`apps/web/src/components/slate/contract-status-badge.tsx`** + **`apps/web/src/lib/contract-utils.ts`**

- Add `icon` to `contractStatusConfig`
- DRAFT → `FileEdit`, SENT → `Send`, VIEWED → `Eye`, SIGNED → `PenLine`, COUNTERSIGNED → `CheckCheck`, COMPLETED → `CheckCircle`, VOIDED → `XCircle`

**`apps/web/src/components/slate/pipeline-stage-badge.tsx`** — PipelineStage (7 statuses)

- COPYEDIT_PENDING → `Clock`, COPYEDIT_IN_PROGRESS → `Pencil`, AUTHOR_REVIEW → `Eye`, PROOFREAD → `BookOpen`, READY_TO_PUBLISH → `CheckCircle`, PUBLISHED → `Globe`, WITHDRAWN → `Ban`

**`apps/web/src/components/periods/period-status-badge.tsx`** — PeriodStatus (3 statuses)

- UPCOMING → `Clock`, OPEN → `CheckCircle`, CLOSED → `Lock`

**`apps/web/src/components/form-builder/form-status-badge.tsx`** — FormStatus (3 statuses)

- DRAFT → `FileEdit`, PUBLISHED → `CheckCircle`, ARCHIVED → `Archive`

### Files that should NOT change

- `apps/web/src/components/slate/calendar-issue-badge.tsx` — uses border-left color only, not a status badge; too compact for icons
- `apps/web/src/components/submissions/file-upload.tsx` `ScanStatusBadge` — already has icons
- `apps/web/src/components/manuscripts/manuscript-version-files.tsx` `ScanStatusBadge` — already has icons; read-only display (no dynamic scan updates, so no `aria-live` needed)

---

## 2. File Drop Zones: Keyboard Accessibility

**Goal:** Drop zones are focusable and operable via keyboard.

### Files to modify

**`apps/web/src/components/submissions/file-upload.tsx`** (lines 303-333)

- Add to drop zone `<div>`:
  - `role="button"`
  - `tabIndex={canUpload ? 0 : -1}`
  - `aria-label={canUpload ? "Drop files here or click to upload" : "Upload limit reached"}`
  - `aria-disabled={!canUpload}`
  - `onKeyDown` handler: trigger `inputRef.current?.click()` on Enter or Space (prevent default for Space to avoid scroll)

**`apps/web/src/components/embed/embed-upload-section.tsx`** (lines 181-207)

- Same changes as above

---

## 3. Scan Status: `aria-live` Regions

**Goal:** Screen readers announce scan status changes dynamically.

### Files to modify

**`apps/web/src/components/submissions/file-upload.tsx`**

- Wrap the scan warning messages (lines 365-381) in a `<div aria-live="polite">` container
- This covers both the "pending scan" and "infected" warnings

**`apps/web/src/components/embed/embed-upload-section.tsx`**

- Same: wrap scan warning messages in `<div aria-live="polite">`

---

## 4. Sidebar: `aria-label` on `<nav>`

**Goal:** Screen readers announce the sidebar navigation's purpose.

### Files to modify

**`apps/web/src/components/layout/sidebar.tsx`** (line 113)

- Add `aria-label="Main navigation"` to the `<nav>` element

---

## Tests

### New test file: `apps/web/src/components/submissions/__tests__/status-badge.spec.tsx`

- Test: each status renders an icon (check for SVG element within badge)
- Test: each status renders correct label text

### New test file: `apps/web/src/components/workspace/__tests__/csr-status-badge.spec.tsx`

- Test: each CSR status renders an icon
- Test: each CSR status renders correct label text

### Update: `apps/web/src/components/layout/__tests__/sidebar.spec.tsx`

- Test: nav element has `aria-label="Main navigation"`

### Update: `apps/web/src/components/submissions/__tests__/file-upload.spec.tsx`

- Test: drop zone has `role="button"` and `tabIndex`
- Test: drop zone has `aria-label`
- Test: scan warnings are in `aria-live` region

### Update: `apps/web/src/components/embed/__tests__/embed-upload-section.spec.tsx`

- Test: drop zone has `role="button"` and `tabIndex`
- Test: scan warnings are in `aria-live` region

---

## Verification

1. `pnpm --filter @colophony/web test` — all Jest tests pass
2. `pnpm type-check` — no type errors
3. `pnpm lint` — no lint errors
4. Visual check: badges render with icons in dev (not required for merge but nice to confirm)
