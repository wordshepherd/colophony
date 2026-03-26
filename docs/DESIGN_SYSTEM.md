# Colophony Design System

> Component architecture, density model, and interaction patterns for a literary magazine platform.
> This document is the source of truth for UI/UX decisions. Implementation plans reference it; code implements it.

### Audiences

This document serves three readers:

1. **Design** — the primary author and decision-maker. This document captures design intent and rationale so decisions survive between sessions.
2. **Claude Code** — the implementation agent. Implementation plans reference this document but do not duplicate it. When a plan says "follow the density architecture," this is what it means.
3. **Future contributors** — onboarding context. Anyone encountering the codebase should understand _why_ the component architecture looks the way it does, not just _what_ it is.

---

## 1. Design Principles

1. **Density is structural, not preferential.** An editor reviewing fifty submissions needs compact information density baked into their environment. A writer checking on three pieces needs breathing room. The role determines density; the user never toggles it.

2. **Roles are hats, not modes.** The same person submits work in the morning, reads slush at lunch, reviews holds in the afternoon, and checks production before leaving. The UI serves all these activities fluidly within one application, not as discrete modes with ceremony between them.

3. **The writer must not see the sausage-making.** Internal editorial states (Hold, Second Read, Under Discussion) are invisible to writers. Every visible state becomes a signal writers will over-interpret, generating correspondence that eats editorial time. The writer-facing state machine is aggressively simple.

4. **Render manuscripts like literature, not like web content.** Editors form judgments by reading prose and poetry. Typography, whitespace, and genre-aware rendering are not polish — they are core functionality.

5. **The reading pane never goes compact.** Even in triage mode, manuscript text renders at reading-quality typography. If space is constrained, show less text rather than degrading the rendering.

---

## 2. Role Inventory

Five roles, defined by activity rather than permission level. A single user may hold multiple roles simultaneously.

| Role                  | Activity               | Primary Object           | Density                                    | Key Metaphor          |
| --------------------- | ---------------------- | ------------------------ | ------------------------------------------ | --------------------- |
| **Writer**            | Writing, Submitting    | Manuscript               | Comfortable                                | Personal notebook     |
| **Manuscript Reader** | First reading, Scoring | Submission               | Compact (triage) / Comfortable (deep-read) | E-reader with a queue |
| **Text Editor**       | Copyediting, Decisions | Submission + Collections | Compact                                    | Editorial desk        |
| **Production Editor** | Pipeline execution     | Issue                    | Compact + timeline                         | Project manager       |
| **Operations Editor** | System administration  | System                   | Compact                                    | Control panel         |

### Role-to-permission mapping

Roles map to the existing permission model but reframe the UI:

| Role              | Current permission gate         | Notes                               |
| ----------------- | ------------------------------- | ----------------------------------- |
| Writer            | Always (any authenticated user) | Absorbs current "Submitter" section |
| Manuscript Reader | `isEditor` or `isReader`        | First readers / slush readers       |
| Text Editor       | `isEditor`                      | Full editorial authority            |
| Production Editor | `isEditor`                      | Slate pipeline access               |
| Operations Editor | `isAdmin`                       | Org settings, federation, webhooks  |

### Information architecture per role

Each role is organized around a different primary object:

- **Editorial roles** (Writer, Reader, Text Editor): submission-as-primary-object
- **Production Editor**: issue-as-primary-object (submissions nested within issues)
- **Operations Editor**: system-as-primary-object (health, federation, configuration)

These are three distinct information architectures sharing a component library, not three skins on one architecture.

---

## 3. Density Architecture

### Pattern: Shell -> Context -> Component

```
Layout Shell (per activity group)
  -> DensityProvider (sets density in React context)
    -> Domain Components (read density via useDensity() hook, adapt rendering)
```

The dependency direction is: **shell decides density, components respond.** Domain components never decide which density to use — they implement variants for each density level and read the decision from context.

### Density levels

| Level         | Line height | Padding            | Font size                  | Row height | Use case                       |
| ------------- | ----------- | ------------------ | -------------------------- | ---------- | ------------------------------ |
| `comfortable` | 1.6         | Generous (p-4/p-6) | Base (14-16px)             | 56-64px    | Writer views, deep-read mode   |
| `compact`     | 1.4         | Tight (p-1.5/p-2)  | Slightly smaller (13-14px) | 36-40px    | Editor triage, production, ops |

### DensityProvider

A standalone React context provider. The layout shell composes it alongside other providers — it is **not** a property on a monolithic role-context object.

```tsx
// Composable density context
<DensityProvider density="compact">{children}</DensityProvider>;

// Any component reads it
const { density } = useDensity();
```

### Override capability

Density can be overridden at a lower level within a shell. The primary use case: an editor in compact triage mode enters deep-read mode, which overrides density to `comfortable` for the reading pane without changing the overall shell.

```tsx
// EditorLayout shell: compact by default
<DensityProvider density="compact">
  <SubmissionList /> {/* compact */}
  {isDeepReadMode && (
    <DensityProvider density="comfortable">
      <ManuscriptRenderer /> {/* comfortable override */}
    </DensityProvider>
  )}
</DensityProvider>
```

### Manuscript renderer exception

The `ManuscriptRenderer` component **ignores density context entirely.** It always renders at reading-quality typography. This is the one place where density does not apply — the reading pane's job is to present literature, and that presentation has its own rules (see Section 8).

---

## 4. Navigation Architecture

### Unified sidebar, grouped by activity

The sidebar is a single, coherent navigation organized by activity group. Groups appear based on the user's role assignments. Clicking a nav item implicitly loads the appropriate layout shell — no explicit mode switching.

```
[Recents / Cmd+K jump-to]
─────────────────────────

Writing                          (Writer)
  My Submissions
  Drafts
  Correspondence

Reading                          (Manuscript Reader)
  Queue
  My Reviews
  Statistics

Editing                          (Text Editor)
  Desk
  Recommendations
  Decisions
  Correspondence

Production                       (Production Editor)
  Current Issue
  Pipeline
  Assets
  Author Proofs

Operations                       (Operations Editor)
  System Health
  Federation
  Users & Roles
  Settings
  Logs
```

### Navigation principles

- **Groups are chapters, not applications.** Visual distinction between groups uses subtle spacing and muted labels — not heavy separators. The sidebar should read as one coherent navigation.
- **Self-configuring.** A writer who is not an editor sees only Writing. An editor who also submits sees Writing + Reading + Editing. No configuration required.
- **URL-driven.** Each nav item is a route. Browser back/forward works naturally. Bookmarkable. Linkable.
- **Implicit shell transition.** Navigating from a Writing page to a Reading page changes the layout shell (and therefore density context) via the route's layout component — a Next.js layout boundary, not a mode toggle.

### Quick access

- **Recents list** at the top of the sidebar: last 3-5 visited submissions/pages, with Cmd+K command palette for instant jump. Provides the quick-access benefit of tabs without persistent visual weight.
- **Keyboard command palette** (Cmd+K): search across all sections — submissions by title, issues by name, system pages. Available globally regardless of current activity group.

---

## 5. Layout Shells

Each activity group has a layout shell that establishes:

1. Density context (via DensityProvider)
2. Available keyboard shortcuts
3. Page structure (single pane, split pane, dashboard grid)
4. Role-specific context (available actions, state projections)

### Shell definitions

| Shell              | Density     | Page structure                                          | Keyboard set                           |
| ------------------ | ----------- | ------------------------------------------------------- | -------------------------------------- |
| `WriterLayout`     | comfortable | Single pane, centered content                           | Minimal (navigation only)              |
| `ReaderLayout`     | compact     | Split pane (list 30% + detail 70%), collapsible to rail | Full editorial: j/k, r, Esc, 1-3, d, h |
| `EditorLayout`     | compact     | Split pane with desk drawer                             | Full editorial + collection shortcuts  |
| `ProductionLayout` | compact     | Issue-centric dashboard (pipeline + timeline)           | Stage transition shortcuts             |
| `OpsLayout`        | compact     | Dashboard grid (health cards + detail panels)           | Navigation only                        |

### Triage and deep-read modes (ReaderLayout / EditorLayout)

The editorial experience has two sub-modes within the compact shell:

**Triage mode** (default):

- Split pane: dense submission list (30% width) + submission detail (70%)
- List shows: title, author, genre, word count, first 2-3 lines of manuscript, age badge
- Keyboard-driven: j/k to navigate list, 1/2/3 for quick scoring, d for decline, h for hold
- Actions available directly from the list without opening detail

**Deep-read mode** (entered via `r` key or explicit toggle):

- List collapses to a narrow rail (position indicator: "14 of 237")
- Manuscript gets near-full-width
- Density overrides to `comfortable` for the reading pane
- Scoring/notes interface appears only after reaching end of manuscript (or when invoked)
- j/k advances to next/previous submission without reopening the list
- Esc returns to triage mode
- Transition is instant and reversible

---

## 6. State Projections

### Architecture

The state machine is a **single source of truth** in the backend. The frontend maps it to **role-specific projections** — different data shapes per role, not different presentation of the same shape.

```
                                  +---> ACCEPTED
                                  |
DRAFT -> SUBMITTED -> UNDER_REVIEW +---> HOLD -----+---> ACCEPTED
              |            |       |        |       |
              |            |       +---> REJECTED   +---> REJECTED
              |            |       |        |       |
              |            |       |        +-------+---> REVISE_AND_RESUBMIT -> (re-enters SUBMITTED)
              |            |       |                |
              |            |       +----------------+---> REVISE_AND_RESUBMIT -> (re-enters SUBMITTED)
              |            |
              +------------+------------------------+---> WITHDRAWN
              (any pre-terminal state)
```

**Transition notes:**

- REVISE_AND_RESUBMIT is reachable from both UNDER_REVIEW and HOLD (editor holds a piece, then decides it's worth an R&R rather than a flat accept or decline)
- WITHDRAWN is reachable from any pre-terminal state (SUBMITTED, UNDER_REVIEW, HOLD) — a writer can withdraw at any point before a decision is made
- ACCEPTED, REJECTED, and WITHDRAWN are terminal states

### Per-role projections

#### Writer projection

Aggressively simple. Internal states collapse to a black box.

| Internal state(s)   | Writer sees        | Notes                |
| ------------------- | ------------------ | -------------------- |
| DRAFT               | Draft              | Editable             |
| SUBMITTED           | Received           | Confirmation         |
| UNDER_REVIEW, HOLD  | In Review          | Deliberate black box |
| REVISE_AND_RESUBMIT | Revision Requested | Actionable           |
| ACCEPTED            | Accepted           | Terminal             |
| REJECTED            | Decision Sent      | Softened language    |
| WITHDRAWN           | Withdrawn          | Writer-initiated     |

**Writer-facing status names are org-configurable.** Different magazines have different cultures around transparency. Some want "Received -> In Review -> Decision." Others want "Received -> Under Consideration -> Final Review -> Decision." This is an editorial voice decision, not a software decision.

The writer's primary information need is **elapsed time**. The status display should emphasize: when they submitted, when the status last changed, and the magazine's stated response window.

#### Manuscript Reader projection

Scoped to the reader's own decision authority. They don't see what happens after recommendation.

| State               | Reader sees            | Action          |
| ------------------- | ---------------------- | --------------- |
| (in their queue)    | Unread                 | Read it         |
| (they've opened it) | Read                   | Score/recommend |
| (they've scored it) | Recommended / Declined | Done            |

#### Text Editor projection

The full graph. Editors need aggregate pipeline awareness: how many pieces at each stage, where bottlenecks form, which holds have been sitting too long. The state machine is explicit and navigable — click a state node to see everything in that state.

#### Operations Editor projection

The state machine itself as a **configurable object**: add/rename/reorder stages, set time-based escalation rules, define which transitions are available from which states. This is where Colophony differentiates from Submittable's fixed pipeline.

### Implementation

The `SubmissionStatus` component reads from role context (provided by the layout shell) and renders the appropriate projection. The projection is a **mapping function**, not a display variant:

```tsx
// Conceptual — the projection transforms the data, not just the rendering
const writerProjection = (status: InternalStatus): WriterStatus => {
  if (["UNDER_REVIEW", "HOLD"].includes(status)) return "IN_REVIEW";
  if (status === "REJECTED") return "DECISION_SENT";
  // ... etc
};
```

The projection function is parameterized by **org configuration** for writer-facing names. The backend API should return the appropriate projection based on the requesting user's role, so the frontend never receives internal states it shouldn't display.

---

## 7. Editor Workspace (Collections)

### The "desk" primitive

The workspace is a container of **typed collections**. A collection is an ordered set of submission references with shared metadata.

Examples of collections an editor might create:

- "Holds" (the simple case)
- "Issue 14 candidates"
- "Pieces to reread in April"
- "Comparison set: which memoir closes the issue"

### Collection data model

```
workspace_collections
  id, owner_id, organization_id, name, description,
  visibility (private | team | collaborators),
  type_hint (holds | reading_list | comparison | issue_planning | custom),
  created_at, updated_at

workspace_items
  id, collection_id, submission_id,
  position, notes (private, never writer-visible),
  color, icon,
  reading_anchor (content-anchored position: paragraph index or character offset into intermediate format),
  added_at, touched_at
```

### Design principles for collections

- **One primitive, many uses.** Instead of building holds, bookmarks, reading lists, and comparison sets as separate features, build one collection primitive and let editors organize however they think.
- **References, not copies.** Items link to canonical submission records. When a submission's status changes, the workspace item reflects it immediately.
- **Multi-membership.** A submission can live in multiple collections simultaneously.
- **Private notes are always private.** No configuration toggle. An editor's desk reasoning is never submitter-facing.
- **Type hints are advisory.** A `comparison` hint defaults the UI to side-by-side view; a `reading_list` hint defaults to sequential reader. But editors aren't locked into those behaviors.
- **Visibility scoping.** Private (default), shared with editorial team, or shared with specific collaborators.

### Reading position memory

Stored per workspace item as `reading_anchor` — a **content-anchored position** (paragraph index or character offset into the intermediate manuscript format), not a scroll offset. A scroll offset is fragile: if the renderer changes layout (different font size, window resize, browser update), a stored pixel offset lands in the wrong place. A content anchor lets the renderer scroll to the correct paragraph regardless of current layout geometry.

When an editor reads half a story, moves on, and returns, the pane scrolls to where they left off. This is the detail that separates a tool editors tolerate from one they love.

### Deferred features (build on the collection primitive later)

- Side-by-side comparison reading view
- Drag-between-collections behavior
- Automated rules ("add to my desk when a first reader recommends to me")

---

## 8. Typography System

### Principle

Render manuscripts like literature. Editors at literary magazines have strong opinions about how text looks on screen. Submittable renders manuscripts like web content. Colophony renders them like literature.

### Foundation: exceptional defaults

| Property        | Prose                                                  | Poetry                                          | Creative Nonfiction               |
| --------------- | ------------------------------------------------------ | ----------------------------------------------- | --------------------------------- |
| **Typeface**    | High-quality serif (Literata, Source Serif, or Lora)   | Same serif family                               | Same serif family                 |
| **Line height** | 1.6-1.7                                                | 1.5-1.6                                         | 1.6-1.7                           |
| **Measure**     | Max 65ch                                               | Tighter (poems rarely reach 65ch)               | Max 65ch                          |
| **Margins**     | Optical margins, generous                              | Extra breathing room around the poem            | Optical margins                   |
| **Paragraphs**  | Indent (not block spacing). First paragraph no indent. | N/A                                             | Indent (not block spacing)        |
| **Alignment**   | Left-aligned (not justified)                           | Left-aligned                                    | Left-aligned                      |
| **Line breaks** | Normal flow                                            | Preserved exactly as authored                   | Honor multiple consecutive breaks |
| **Whitespace**  | Standard                                               | Preserved internal spacing, stepped indentation | Structural whitespace preserved   |

### Smart typography pass

On render, normalize by default:

- Straight quotes -> curly quotes
- Double hyphens -> em dashes
- Three dots -> proper ellipses
- Small caps available for authors who use them

**Bypass mechanism:** Some writers use straight quotes intentionally, or use double hyphens as a stylistic choice (especially in experimental fiction and poetry). The conversion pipeline should store **both the normalized and original forms** in the intermediate format. The renderer applies normalization by default, with a "show as submitted" toggle per submission that the editor can flip. This avoids silently altering someone's manuscript — the normalization is always reversible because the original is preserved.

### Genre-aware rendering

The `ManuscriptRenderer` component selects rendering strategy based on a **genre hint**:

- Genre hint comes from the submission form (writer selects prose/poetry/hybrid)
- Editor can override on the reading side
- No auto-detection — edge cases are too ambiguous; the cost of wrong detection is mangling someone's poem

### Editor display preferences

Editors can adjust (constrained range):

- **Font size** (accessibility requirement)
- **Theme**: light / sepia / dark
- **Line height**: within a small range around the default

Editors cannot adjust:

- Typeface (Colophony has a house opinion)
- Paragraph indent vs. block spacing
- Measure

The reading experience should have a strong house opinion. If every editor configures a completely different environment, the platform loses its identity and creates a support surface where rendering bugs entangle with personal configuration.

### Manuscript intermediate format

Writers submit in various formats (.doc, .docx, .pdf, .rtf, plain text). The conversion pipeline must:

1. Preserve authorial intent (especially for poetry — tab-based and space-based indentation must produce identical output)
2. Normalize into a **structured intermediate format** (constrained HTML subset or custom AST)
3. Give the renderer a stable input regardless of source format

This intermediate format is one of the hardest technical problems in the platform and should be designed carefully before implementation.

---

## 9. Production Editor Dashboard

### Primary object: the issue

Everything else in Colophony is organized by submission. The Production Editor thinks in **issues** — what's in the next issue, what stage is each piece at, what's blocking publication.

### Key requirements

#### Time-visible pipeline

A table flattens time. A Kanban shows stage distribution but not time pressure. The production view needs each piece to show:

- How long it's been in its current stage
- What its deadline is
- Whether it's on track or behind (visual warning)

The right format may be Kanban with time-based visual warnings, a timeline/Gantt-style view, or a table with aggressive aging indicators. **Prototype multiple approaches before committing.**

#### Production data model prerequisite

The production dashboard depends on a data model that doesn't fully exist yet. The relationship between issues, pieces, stages, and deadlines isn't captured in the collection primitive or the submission state machine. Specifically:

- **Issue-to-submission ordering** — position within issue, section assignment, page allocation
- **Per-piece stage deadlines** — not just "what stage is it in" but "when does this stage need to be done"
- **Dependency graph** — which stages block which, handoff tracking with external parties
- **Asset tracking** — art, photos, author bios, rights clearances linked to issue items

This schema needs its own design pass before the dashboard can be built. The dashboard is the most complex single screen in the application because it's where editorial judgment meets operational execution against real deadlines.

#### Dependency awareness

Production stages have ordering constraints. You can't send proofs until copyediting is done. The dashboard should surface **blocked items** — pieces that can't advance because an upstream dependency isn't complete — distinctly from items that are in progress.

#### Handoff tracking

Production involves the most external communication in the pipeline — author proof approvals, art commissions, rights clearances. Visual distinction between:

- **"We're working on this"** — internal progress
- **"We're waiting on someone"** — ball in external court, with elapsed time since handoff

### Dashboard structure

```
Current Issue: [Issue name] — [Publication date] — [N pieces, M on track, K blocked]

| Piece           | Stage              | Days in stage | Deadline  | Status    | Blocking |
|-----------------|--------------------|--------------:|-----------|-----------|----------|
| The River House | Author Proofs      |             8 | Mar 28    | WAITING   | Author   |
| Memory Palace   | Copyedit           |             2 | Mar 30    | ON TRACK  |          |
| After the Rain  | Layout             |             0 | Apr 2     | BLOCKED   | Art      |
```

---

## 10. Operations Editor Dashboard

### Primary object: the system

The Ops Editor's dashboard has almost nothing in common with editorial UI. It's closer to Grafana than to a submission queue.

### Key patterns

#### Status-at-a-glance with drill-down

Top level: health indicators (green/yellow/red) for:

- Federation peers (reachable, last synced, failed messages)
- Queue depths (email, webhook, file scan workers)
- Webhook delivery health
- Submission volume trends

**"Everything is fine" in under 2 seconds. "Here's what's wrong" in under 10.**

Clicking any indicator drills into detail.

#### Federation-specific views

Unique to Colophony's federated architecture:

- Connected magazines and peer status
- Content sharing activity (offered, accepted, conflicts)
- Sync failures and resolution

#### Audit and activity logs

Filterable, searchable log answering: who changed this setting, when did this magazine join the federation, why did this webhook start failing. Core component with no analog in the editorial UI.

---

## 11. Shared Component Patterns

Components that span multiple roles and respond to density context.

### Density-responsive components

| Component       | Comfortable                                           | Compact                                             |
| --------------- | ----------------------------------------------------- | --------------------------------------------------- |
| `SubmissionRow` | Full metadata, generous spacing, status badge + label | Condensed metadata, tight spacing, icon-only status |
| `StatusBadge`   | Icon + label + elapsed time                           | Icon + abbreviated time                             |
| `DataTable`     | Standard row height (56px), full column set           | Reduced row height (36px), priority columns only    |
| `Card`          | Full description, visual hierarchy                    | Title + key stat, denser grid                       |
| `ActionBar`     | Labeled buttons                                       | Icon-only buttons with tooltips                     |

### Keyboard shortcut system

Global shortcuts (always available):

- `Cmd+K` — Command palette / jump-to
- `?` — Show keyboard shortcut overlay

Editorial shortcuts (Reading / Editing shells):

- `j` / `k` — Navigate up/down in submission list
- `r` — Enter deep-read mode
- `Esc` — Return to triage mode
- `1` / `2` / `3` — Quick score (reject / maybe / accept)
- `d` — Decline submission
- `h` — Hold / add to desk
- `n` — Next unread
- `c` — Open correspondence / comment

Shortcuts are **shell-scoped** — the editorial shortcuts only bind when a Reading or Editing layout shell is active. This prevents conflicts with text input in Writer views.

### First-paragraph preview

In triage mode, the submission list shows the first 2-3 lines of the manuscript alongside metadata. For experienced editors, the opening paragraph is the primary triage signal — not genre, not word count, not the cover letter. **Surface the text.**

---

## 12. Recurring Component Patterns

### Pattern: Master-Detail with Collapsible List

Used by: Reading Queue, Editing Desk, Production Pipeline

```
+--[ List (30%) ]--+--[ Detail (70%) ]--+     Triage mode
|  Title / Preview  |                    |
|  Title / Preview  |  Full submission   |
|  > Selected       |  or issue detail   |
|  Title / Preview  |                    |
+-------------------+--------------------+

+--[Rail]--+--[ Detail (95%) ]----------+     Deep-read mode
| 14/237   |                            |
|          |  Manuscript at reading      |
|          |  quality typography         |
|          |                            |
+----------+----------------------------+
```

### Pattern: Role-Filtered Status

Used by: every status display in the application

One `SubmissionStatus` component that reads role context from the layout shell and renders the appropriate projection. The API returns the appropriate projection based on the requesting user's role.

### Pattern: Health Card Grid

Used by: Operations Dashboard, Production Overview

```
+--------+ +--------+ +--------+
| GREEN  | | YELLOW | | GREEN  |
| Peers  | | Queues | | Hooks  |
| 12 ok  | | 3 deep | | 100%   |
+--------+ +--------+ +--------+
```

Click-to-drill-down. Two-second glance for "all clear."

### Pattern: Timeline with Aging

Used by: Production Pipeline, Writer Status View, Aging Submissions

Visual emphasis on elapsed time. Color-coding:

- Green: on track / within expected response window
- Yellow: approaching deadline / aging
- Red: overdue / stale

---

## 13. Migration Path from Current Architecture

### Current state -> Target state

| Current                                                                       | Target                                                                | Migration                                                       |
| ----------------------------------------------------------------------------- | --------------------------------------------------------------------- | --------------------------------------------------------------- |
| 5 sidebar sections (My Writing, Submissions & Settings, Editor, Slate, Admin) | 5 activity groups (Writing, Reading, Editing, Production, Operations) | Reorganize sidebar; merge Submissions into Writing              |
| `isEditor` / `isAdmin` binary gates                                           | Same permission gates, reframed as role-hat membership                | No backend changes needed initially                             |
| Single page layout for all views                                              | Per-group layout shells with DensityProvider                          | Introduce layout shell components; wrap existing pages          |
| Monolithic editor queue                                                       | Split pane with triage/deep-read modes                                | Major refactor of `editor-submission-queue.tsx`                 |
| Status badges with full internal state                                        | Role-filtered projections                                             | Add projection layer; backend API returns role-appropriate data |
| Table-based Slate pipeline                                                    | Issue-centric production dashboard                                    | New dashboard design (prototype first)                          |
| Basic admin pages                                                             | Ops dashboard with health indicators                                  | New dashboard design                                            |
| No editor workspace                                                           | Collections primitive (workspace_collections + workspace_items)       | New schema + service + UI                                       |
| No manuscript rendering strategy                                              | Genre-aware ManuscriptRenderer with intermediate format               | New component + conversion pipeline                             |
| No keyboard shortcuts                                                         | Shell-scoped shortcut system                                          | New keyboard hook + per-shell bindings                          |
| No density system                                                             | DensityProvider + useDensity() + component variants                   | New context + incremental component updates                     |

### Suggested implementation order

**Step 0 (parallel foundations):**

- **0a. DensityProvider + useDensity()** — UI foundation. No visible change, but enables everything else.
- **0b. Manuscript intermediate format design** — Data foundation. Design the structured format (constrained HTML or AST), prototype the conversion pipeline for at least .docx and plain text. This is a prerequisite for the editorial split pane (step 2) — if you build the split pane first with raw manuscript display, you'll retrofit the renderer later and touch every integration point twice.

These are independent workstreams that can happen in parallel.

**Sequential steps:**

1. **Layout shells** — Wrap existing pages in role-appropriate shells. Sidebar reorganization.
2. **Editorial split pane + ManuscriptRenderer** — Triage/deep-read modes. Genre-aware typography. Depends on both 0a (density) and 0b (intermediate format).
3. **State projections** — Role-filtered status display. Org-configurable writer names.
4. **Collections primitive** — Editor workspace/desk. Schema + service + UI.
5. **Keyboard shortcuts** — Shell-scoped bindings.
6. **Production data model + dashboard** — Schema design first, then issue-centric view. Prototype before committing to a layout.
7. **Ops dashboard** — Health card grid. Federation views.
8. **Command palette** — Cmd+K jump-to across all sections.

---

## 14. Responsive Behavior

### Decision: desktop-first, with a minimal mobile writer experience

Colophony is a **desktop-first tool.** The editorial workflows (triage, deep-read, production pipeline, operations) assume a desktop viewport and are not designed for mobile. Literary magazine editors are not doing production work on their phones, and the information density that makes the desktop experience powerful would be illegible on a small screen.

However, **writers absolutely check submission status on mobile.** The writer experience — comfortable density, simple status projections, minimal actions — is the easiest to make responsive and the most likely to be accessed from a phone.

### Responsive tiers

| Viewport                | Experience                   | Notes                                                                                                                           |
| ----------------------- | ---------------------------- | ------------------------------------------------------------------------------------------------------------------------------- |
| **Desktop** (>= 1024px) | Full experience, all roles   | Primary target. Split panes, keyboard shortcuts, full density system.                                                           |
| **Tablet** (768-1023px) | Writer + read-only editorial | Writer views fully responsive. Editorial views in single-pane mode (no split pane). Production/Ops redirect to desktop.         |
| **Mobile** (< 768px)    | Writer-only                  | My Submissions, status checks, correspondence. No editorial, production, or ops views. Sidebar becomes bottom nav or hamburger. |

### What this means for implementation

- Writer layout shell (`WriterLayout`) must be responsive from the start.
- Editorial, production, and ops shells can assume desktop and defer responsive work.
- The sidebar navigation needs a mobile variant for the Writing group only.
- Status check pages (including embed status at `/embed/status/:token`) must be mobile-friendly — these are the most common mobile touch point.

---

## Appendix A: Design Decision Log

| Decision               | Choice                                                      | Rationale                                                                                                                                                                           |
| ---------------------- | ----------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Density mechanism      | Layout shells with DensityProvider context                  | Shell -> context -> component gets dependency direction right. Role determines density, not per-component props.                                                                    |
| Navigation model       | Unified sidebar grouped by activity                         | Roles are hats worn simultaneously, not modes. Avoids ceremony of mode-switching. Route-driven shell transitions.                                                                   |
| Editor UX model        | Split pane with collapsible list + deep-read mode           | Editors read literature, not emails. The reading pane needs room to breathe. Triage and deep-read are different cognitive modes.                                                    |
| State visibility       | Role-filtered projections                                   | Writers must not see internal editorial states. Each role sees only states relevant to their decision authority.                                                                    |
| Writer-facing statuses | Org-configurable names                                      | Different magazines have different transparency cultures. Editorial voice decision, not software decision.                                                                          |
| Editor workspace       | Generic collection primitive                                | One primitive (named, ordered, annotated collection) replaces holds, bookmarks, comparison sets, reading lists. Let editorial culture determine usage.                              |
| Typography             | Genre-aware with strong house opinion                       | Render literature like literature. Constrained editor preferences (size, theme, line-height) around exceptional defaults.                                                           |
| Production view        | Issue-centric with time-visible pipeline                    | Production thinks in issues and deadlines, not submissions. Time pressure must be visible. Prototype multiple approaches.                                                           |
| Manuscript storage     | Structured intermediate format (constrained HTML or AST)    | Decouple rendering from source format (.docx, .pdf). Preserve authorial intent. Hardest technical problem — design carefully.                                                       |
| Private notes          | Always invisible to writers, no toggle                      | An editor's desk reasoning is never submitter-facing. Making it configurable invites mistakes.                                                                                      |
| Reading position       | Content-anchored (paragraph/char offset), not scroll offset | Scroll offsets break on any layout change (font size, resize, browser update). Content anchors are stable across rendering contexts.                                                |
| Smart typography       | On by default, bypass per submission, store both forms      | Some writers use straight quotes or double hyphens intentionally. Storing both normalized and original in the intermediate format makes normalization reversible without data loss. |
| Responsive strategy    | Desktop-first; mobile limited to writer status checks       | Editorial workflows need desktop viewports. Writers check status on mobile. Build responsive for WriterLayout only; defer mobile editorial.                                         |
