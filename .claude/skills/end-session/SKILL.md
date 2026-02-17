---
name: end-session
description: End-of-session housekeeping — update docs, clean up git state, and summarize work.
---

# /end-session

End-of-session housekeeping: update docs, push to PR, and summarize work.

## What this skill does

1. Gathers session context from the conversation
2. Ensures all code changes are committed on a feature branch (not `main`)
3. Notes any Codex review findings addressed during this session
4. Updates the current month's devlog (`docs/devlog/YYYY-MM.md`) with a session summary (captures everything including Codex review fixes addressed during this session)
5. Checks for any `TODO(CLAUDE.md)` comments and proposes updates
6. Commits doc updates as the final commit on the branch
7. Pushes the branch and creates/updates a PR (all commits — code + docs — land together so CI covers everything)
8. Prints a session summary with PR link for user to merge

## Usage

```
/end-session
```

## Instructions for Claude

When the user invokes `/end-session`, perform these steps in order:

### Step 1: Gather session context

Scan the conversation to identify:

- **What was done** — features added, bugs fixed, tests written, config changes
- **Decisions made** — architectural choices, trade-offs, things deferred
- **Issues found** — bugs discovered, quirks encountered, things that need follow-up
- **Next steps** — open TODOs, planned follow-up work

### Step 2: Ensure code is committed

1. **Check branch**: Verify we are NOT on `main`. If on `main` with unpushed commits, create a feature branch first.

2. **Check for uncommitted code changes** (NOT doc updates yet — those come later):

   ```bash
   git status
   git diff --stat
   ```

   If there are uncommitted code changes from this session, stage and commit them with an appropriate conventional commit message. Do NOT push yet — docs will be committed first so everything lands in one push.

### Step 3: Note Codex review status

Check the conversation history for any `/codex-review` invocations during this session:

- **If a review was done**: Note which findings were addressed vs deferred in the session summary
- **If no review was done and there are code changes**: Suggest running `/codex-review` before ending

This step does NOT perform a review — it only records what happened during the session.

### Step 4: Update DEVLOG and backlog

#### 4a: Update DEVLOG

Determine the current month's devlog file: `docs/devlog/YYYY-MM.md` (e.g., `docs/devlog/2026-02.md`). If the file doesn't exist yet, create it with the header `# Development Log — [Month Year]` followed by a blank line and `Newest entries first.`

Read the current month's devlog to see the latest entry format, then **prepend** a new entry (newest first, after the header) using this template:

```markdown
## YYYY-MM-DD — [Session Focus]

### Done

- [bullet points of completed work, INCLUDING any Codex review fixes addressed during this session]

### Decisions

- [any architectural or process decisions made]
```

**Important changes from previous format:**

- The DEVLOG **no longer has a "Next" section** for deferred work. Deferred items go in `docs/backlog.md` instead.
- Only include an **"Issues Found"** section if there are bugs or problems discovered during this session that need immediate attention (e.g., "CI is broken", "test is flaky"). Routine follow-up work goes in the backlog.
- The DEVLOG entry should capture the full session including any Codex review outcomes (e.g., "Addressed Codex review: fixed X, deferred Y").

If today already has a DEVLOG entry for this session's work, **append to the existing entry's sections** rather than creating a duplicate.

**File convention:** Monthly rotation in `docs/devlog/YYYY-MM.md`. Never write to `docs/DEVLOG.md` (redirect stub only).

#### 4b: Update backlog

Read `docs/backlog.md` and update it:

1. **Check off completed items:** If any backlog items were completed in this session, mark them `[x]`.
2. **Add new deferrals:** Any items raised during the session that were intentionally deferred (Codex review findings, ideas, discovered work) get added to the appropriate track section with a source annotation (e.g., `— (DEVLOG 2026-02-15, Codex review)`).
3. **Add items from Codex reviews:** If a `/codex-review` was run, any findings that were noted but not addressed in this session should be added with their priority level (e.g., `- [ ] [P2] Add input validation on X endpoint — (Codex review 2026-02-15)`).

**Categorize new items** into the correct track section. If unsure which track an item belongs to, add it to the track currently being worked on. Use the existing format: `- [ ] Description — (source)`.

### Step 5: Check for CLAUDE.md and other doc updates

Search the codebase for any `TODO(CLAUDE.md)` comments added during this session using the Grep tool (not bash) to search for `TODO(CLAUDE.md)` in `*.ts`, `*.tsx`, and `*.js` files.

Also review the session for any new patterns, quirks, or constraints discovered. Check whether any of these CLAUDE.md files need updates:

- `CLAUDE.md` (root) — Known Quirks, Security Status checklist, Version Pins, Key File Locations
- `packages/db/CLAUDE.md` — RLS rules, schema files, migration workflow
- `apps/api/CLAUDE.md` — Key Paths, hook chain, tRPC procedures, quirks
- `apps/web/CLAUDE.md` — tRPC client, providers, conventions, quirks
- `docs/testing.md` — test counts, new test tiers, running instructions
- Other docs referenced in the session

Domain-specific discoveries should go in the relevant per-directory CLAUDE.md, not the root. The root file covers cross-cutting concerns only.

If updates are warranted, propose them:

```markdown
## Suggested Update for [file path]

**Section**: [section name]
**Addition**: [new content]
**Rationale**: [why this is important]
```

Ask the user if they want to apply the suggestions before proceeding.

### Step 6: Commit doc updates

This is the **final commit** on the branch. Stage all doc changes:

```bash
git add docs/devlog/ docs/backlog.md CLAUDE.md docs/testing.md [any other docs]
git commit -m "docs: update devlog and docs for [session date] session"
```

### Step 7: Push and create/update PR

Push all commits (code + docs) together so CI covers everything in one run:

1. **Push the branch**:

   ```bash
   git push -u origin <branch-name>
   ```

2. **Create PR if needed**: Check if a PR already exists for this branch:

   ```bash
   gh pr list --head <branch-name> --json number --jq '.[0].number'
   ```

   - If no PR exists, create one with `gh pr create`
   - If a PR exists, it's already updated by the push

### Step 8: Verify CI and report

Check CI status on the branch after the push:

```bash
gh run list --branch <branch-name> --limit 1 --json status,conclusion,name
```

Report the status. If CI is running, note that the user should wait for it to pass before merging.

### Step 9: Session summary

Print a summary for the user:

```
## Session Summary

**Branch:** <branch-name>
**PR:** <PR URL> — ready to merge
**CI:** <status>

### Changes
- [list of commits in this session]

### Code Review
- [Codex review findings addressed with counts, or "No review done this session"]

### Docs Updated
- [list of doc files updated]

### CLAUDE.md Updates
- [any proposed or applied updates, or "None needed"]

### Open Items
- [anything left undone, next session priorities]
```

## Important notes

- NEVER push to `main` — always use a feature branch
- Use `gh run list/view` for CI status, NOT `gh pr checks` (fine-grained PAT limitation)
- The DEVLOG entry should be concise but complete — future sessions rely on it for context
- If the session had multiple unrelated workstreams, consider whether they should be separate PRs
- Doc updates are always the LAST commit — after all code changes and any review fixes, but BEFORE the push/PR so CI covers everything in one run
- Do NOT switch to `main`, delete branches, or do branch cleanup — that's handled by `/start-session`
- The PR should be left open for the user to review and merge
