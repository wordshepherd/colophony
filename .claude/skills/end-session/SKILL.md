---
name: end-session
description: End-of-session housekeeping — update docs, clean up git state, and summarize work.
---

# /end-session

End-of-session housekeeping: update docs, push to PR, and summarize work.

## What this skill does

1. Gathers session context from the conversation
2. Ensures all code changes are committed on a feature branch (not `main`)
3. Pushes the branch and creates/updates a PR if needed
4. Notes any Codex review findings addressed during this session
5. Updates the current month's devlog (`docs/devlog/YYYY-MM.md`) with a session summary (captures everything including Codex review fixes addressed during this session)
6. Checks for any `TODO(CLAUDE.md)` comments and proposes updates
7. Commits and pushes doc updates as the final commit on the branch
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

### Step 2: Ensure code is committed and pushed

1. **Check branch**: Verify we are NOT on `main`. If on `main` with unpushed commits, create a feature branch first.

2. **Check for uncommitted code changes** (NOT doc updates yet — those come later):

   ```bash
   git status
   git diff --stat
   ```

   If there are uncommitted code changes from this session, stage and commit them with an appropriate conventional commit message.

3. **Push the branch**:

   ```bash
   git push -u origin <branch-name>
   ```

4. **Create PR if needed**: Check if a PR already exists for this branch:

   ```bash
   gh pr list --head <branch-name> --json number --jq '.[0].number'
   ```

   - If no PR exists, create one with `gh pr create`
   - If a PR exists, it's already updated by the push

### Step 3: Note Codex review status

Check the conversation history for any `/codex-review` invocations during this session:

- **If a review was done**: Note which findings were addressed vs deferred in the session summary
- **If no review was done and there are code changes**: Suggest running `/codex-review` before ending

This step does NOT perform a review — it only records what happened during the session.

### Step 4: Update DEVLOG

Determine the current month's devlog file: `docs/devlog/YYYY-MM.md` (e.g., `docs/devlog/2026-02.md`). If the file doesn't exist yet, create it with the header `# Development Log — [Month Year]` followed by a blank line and `Newest entries first.`

Read the current month's devlog to see the latest entry format, then **prepend** a new entry (newest first, after the header) using this template:

```markdown
## YYYY-MM-DD — [Session Focus]

### Done

- [bullet points of completed work, INCLUDING any Codex review fixes addressed during this session]

### Decisions

- [any architectural or process decisions made]

### Issues Found (optional)

- [bugs or problems discovered but not yet fixed]

### Next

- [planned follow-up work]
```

If today already has a DEVLOG entry for this session's work, **append to the existing entry's sections** rather than creating a duplicate.

**Important:** The DEVLOG entry should capture the full session including any Codex review outcomes (e.g., "Addressed Codex review: fixed X, deferred Y").

**File convention:** Monthly rotation in `docs/devlog/YYYY-MM.md`. Never write to `docs/DEVLOG.md` (redirect stub only).

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

### Step 6: Commit and push doc updates

This is the **final commit** on the branch. Stage all doc changes:

```bash
git add docs/devlog/ CLAUDE.md docs/testing.md [any other docs]
git commit -m "docs: update devlog and docs for [session date] session"
git push origin <branch-name>
```

### Step 7: Verify CI and report

Check CI status on the branch after the doc push:

```bash
gh run list --branch <branch-name> --limit 1 --json status,conclusion,name
```

Report the status. If CI is running, note that the user should wait for it to pass before merging.

### Step 8: Session summary

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
- Doc updates are always the LAST commit — after all code changes and any review fixes
- Do NOT switch to `main`, delete branches, or do branch cleanup — that's handled by `/start-session`
- The PR should be left open for the user to review and merge
