# Plan: Accessibility Improvements — Cross-Cutting Pre-Launch

## Context

Four P2 accessibility backlog items address WCAG compliance gaps across the web frontend. All are scoped, concrete, and affect existing components. The app uses shadcn/ui (New York), lucide-react icons, and Tailwind CSS.

---

## 1. Status Badges — Add Icons Alongside Color

**Problem:** 8 status badge components use color alone to convey meaning (WCAG 1.4.1 violation). Color-blind users cannot distinguish statuses.

**Approach:** Add a lucide-react icon to each status in every badge config. Render `<Icon className="h-3 w-3" aria-hidden="true" />` before the label text inside each Badge. Icons are decorative (the text label is the accessible name), so `aria-hidden` is correct.

**Icon assignments** (chosen for semantic meaning, not just decoration):

### `status-badge.tsx` (SubmissionStatus — 8 statuses)

| Status              | Icon          | Rationale          |
| ------------------- | ------------- | ------------------ |
| DRAFT               | `FileEdit`    | Editing/incomplete |
| SUBMITTED           | `Send`        | Sent               |
| UNDER_REVIEW        | `Eye`         | Being viewed       |
| ACCEPTED            | `CheckCircle` | Success            |
| REJECTED            | `XCircle`     | Declined           |
| HOLD                | `Pause`       | Paused             |
| REVISE_AND_RESUBMIT | `RotateCcw`   | Redo               |
| WITHDRAWN           | `Undo2`       | Taken back         |

### `pipeline-stage-badge.tsx` (PipelineStage — 7 stages)

| Stage                | Icon          |
| -------------------- | ------------- |
| COPYEDIT_PENDING     | `Clock`       |
| COPYEDIT_IN_PROGRESS | `Pencil`      |
| AUTHOR_REVIEW        | `Eye`         |
| PROOFREAD            | `ScanSearch`  |
| READY_TO_PUBLISH     | `CheckCircle` |
| PUBLISHED            | `BookOpen`    |
| WITHDRAWN            | `XCircle`     |

### `issue-status-badge.tsx` (IssueStatus — 5 statuses)

| Status     | Icon          |
| ---------- | ------------- |
| PLANNING   | `Lightbulb`   |
| ASSEMBLING | `Layers`      |
| READY      | `CheckCircle` |
| PUBLISHED  | `BookOpen`    |
| ARCHIVED   | `Archive`     |

### `publication-status-badge.tsx` (PublicationStatus — 2 statuses)

| Status   | Icon          |
| -------- | ------------- |
| ACTIVE   | `CheckCircle` |
| ARCHIVED | `Archive`     |

### `form-status-badge.tsx` (FormStatus — 3 statuses)

| Status    | Icon          |
| --------- | ------------- |
| DRAFT     | `FileEdit`    |
| PUBLISHED | `CheckCircle` |
| ARCHIVED  | `Archive`     |

### `period-status-badge.tsx` (PeriodStatus — 3 statuses)

| Status   | Icon        |
| -------- | ----------- |
| UPCOMING | `Clock`     |
| OPEN     | `CircleDot` |
| CLOSED   | `Lock`      |

### `contract-status-badge.tsx` + `contract-utils.ts` (ContractStatus — 7 statuses)

| Status        | Icon          |
| ------------- | ------------- |
| DRAFT         | `FileEdit`    |
| SENT          | `Send`        |
| VIEWED        | `Eye`         |
| SIGNED        | `PenTool`     |
| COUNTERSIGNED | `CheckCheck`  |
| COMPLETED     | `CheckCircle` |
| VOIDED        | `XCircle`     |

### `csr-status-badge.tsx` (CSRStatus — 10 statuses)

| Status      | Icon          |
| ----------- | ------------- |
| draft       | `FileEdit`    |
| sent        | `Send`        |
| in_review   | `Eye`         |
| hold        | `Pause`       |
| accepted    | `CheckCircle` |
| rejected    | `XCircle`     |
| withdrawn   | `Undo2`       |
| no_response | `Clock`       |
| revise      | `RotateCcw`   |
| unknown     | `HelpCircle`  |

**Pattern:** Each config record gains an `icon` field typed as `LucideIcon`. The render function adds `<Icon className="h-3 w-3" aria-hidden="true" />` in a `gap-1` flex container (Badge already uses `inline-flex`).

### Files to modify

- `apps/web/src/components/submissions/status-badge.tsx`
- `apps/web/src/components/slate/pipeline-stage-badge.tsx`
- `apps/web/src/components/slate/issue-status-badge.tsx`
- `apps/web/src/components/slate/publication-status-badge.tsx`
- `apps/web/src/components/slate/contract-status-badge.tsx`
- `apps/web/src/lib/contract-utils.ts`
- `apps/web/src/components/form-builder/form-status-badge.tsx`
- `apps/web/src/components/periods/period-status-badge.tsx`
- `apps/web/src/components/workspace/csr-status-badge.tsx`

---

## 2. File Drop Zones — Keyboard Focus & ARIA

**Problem:** Drop zone `<div>`s are clickable but not keyboard-accessible. No `role`, `tabIndex`, or `onKeyDown`. Hidden `<input type="file">` is inaccessible without mouse.

**Approach:** Add `role="button"`, `tabIndex={0}`, `onKeyDown` (Enter/Space triggers file input click), `aria-label`, and `aria-disabled` to both drop zone divs. Also add `aria-label="Remove file"` / `aria-label="Cancel upload"` to the X buttons.

### `apps/web/src/components/submissions/file-upload.tsx`

**Drop zone div (line 303):** Add:

- `role="button"`
- `tabIndex={canUpload ? 0 : -1}`
- `aria-label={canUpload ? "Upload files" : "Upload limit reached"}`
- `aria-disabled={!canUpload}`
- `onKeyDown` handler: Enter/Space → `inputRef.current?.click()`

**X buttons (lines 126–133, 165–172):** Add `aria-label`:

- Uploading: `aria-label="Cancel upload"` or `aria-label="Remove file"` depending on `upload.status`
- Existing: `aria-label="Delete file"`

### `apps/web/src/components/embed/embed-upload-section.tsx`

Same changes to the drop zone div (line 181) and X buttons (lines 246–257).

---

## 3. Scan Status — `aria-live` Region

**Problem:** Scan status changes (PENDING → SCANNING → CLEAN/INFECTED) are not announced to screen readers.

**Approach:** Wrap the `ScanStatusBadge` in both files with `<span role="status" aria-live="polite">`. This is the simplest approach — the badge re-renders with new text when status changes, and `aria-live="polite"` causes the screen reader to announce the new content.

Also add `aria-hidden="true"` to the icon inside `ScanStatusBadge` (the text label is sufficient).

### Files to modify

- `apps/web/src/components/submissions/file-upload.tsx` — `ScanStatusBadge` component (line 73), usages at lines 118, 163
- `apps/web/src/components/embed/embed-upload-section.tsx` — `ScanStatusBadge` component (line 78), usages at lines 241, 280

**Implementation:** Modify `ScanStatusBadge` itself to include the `role="status"` wrapper, so all usages get it automatically:

```tsx
function ScanStatusBadge({ status }: { status: ScanStatus }) {
  const config = scanStatusConfig[status];
  const Icon = config.icon;
  return (
    <span role="status" aria-live="polite">
      <Badge variant="secondary" className={cn("gap-1", config.className)}>
        <Icon
          className={cn("h-3 w-3", status === "SCANNING" && "animate-spin")}
          aria-hidden="true"
        />
        {config.label}
      </Badge>
    </span>
  );
}
```

---

## 4. Sidebar — `aria-label` on `<nav>`

**Problem:** The `<nav>` element has no `aria-label`, making it indistinguishable from other nav landmarks.

**Approach:** Add `aria-label="Main navigation"` to the `<nav>` element at line 113.

### File to modify

- `apps/web/src/components/layout/sidebar.tsx` — line 113

---

## Files NOT Changed

- `apps/web/src/components/ui/badge.tsx` — base shadcn component, no changes needed (already `inline-flex`)

## Verification

1. `pnpm type-check` passes (lucide icon imports are correct)
2. `pnpm lint` passes
3. Visual check: badges show icons + text in all status badge locations
4. Keyboard check: Tab to drop zone → Enter/Space opens file picker
5. Screen reader check: scan status changes announced; sidebar nav identified by label
6. Existing tests pass: `pnpm test` (unit) + verify no Playwright regressions
