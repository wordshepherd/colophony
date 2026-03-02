---
name: end-session
description: End-of-session housekeeping — update docs, clean up git state, and summarize work.
---

# /end-session

End-of-session housekeeping: update docs, push to PR, and summarize work.

## What this skill does

1. Gathers session context from the conversation
2. Ensures all code changes are committed on a feature branch (not `main`)
3. Notes any code review findings addressed during this session
4. Updates the current month's devlog (`docs/devlog/YYYY-MM.md`) with a session summary (captures everything including code review fixes addressed during this session)
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

### Step 3: Note code review status

<!-- Active review tool: /codex-review. To switch back: replace /codex-review with /opencode-review -->

Check the conversation history for any `/codex-review` or `/opencode-review` invocations during this session. **Distinguish between review types** — they are not interchangeable:

- **Plan review** (`/codex-review plan`): Reviews the _plan file_ for soundness before implementation. Does NOT review actual code written.
- **Branch review** (`/codex-review branch`): Reviews the _actual code diff_ against `origin/main`. This is the implementation review.

Record which types were run:

- **If a branch review was done**: Note which findings were addressed vs deferred in the session summary
- **If only a plan review was done**: Note it, but do NOT count it as a code review — Step 6.5 still needs to run
- **If no review was done and there are code changes**: Note that Step 6.5 will handle it

This step does NOT perform a review — it only records what happened during the session.

### Step 3.5: Write session handoff

Write a machine-readable `session-handoff.md` in the project root. This file is gitignored and provides instant context restoration for the next session. Overwrite any existing file.

Use this exact format:

```markdown
# Session Handoff

## Meta

- Date: YYYY-MM-DD
- Branch: <branch-name>
- PR: <PR URL or "none">

## Status

- [ ] or [x] All code committed
- [ ] or [x] Tests passing
- [ ] or [x] Plan review done (opencode/codex)
- [ ] or [x] Branch review done (opencode/codex)
- [ ] or [x] DEVLOG updated
- [ ] or [x] PR created/updated

## Files Touched

- `path/to/file1.ts` — [what changed]
- `path/to/file2.ts` — [what changed]

## Decisions Made

- [Decision 1]: [choice made and brief rationale]

## Open Questions

- [Question that needs resolution next session]

## Next Action

[Single most important thing to do next session — be specific]
```

**Important:** This file is for **machine consumption** by `/start-session`. Keep values terse and factual. The DEVLOG entry (Step 4) provides the human-readable narrative.

### Step 4: Update DEVLOG and backlog

#### 4a: Update DEVLOG

Determine the current month's devlog file: `docs/devlog/YYYY-MM.md` (e.g., `docs/devlog/2026-02.md`). If the file doesn't exist yet, create it with the header `# Development Log — [Month Year]` followed by a blank line and `Newest entries first.`

Read the current month's devlog to see the latest entry format, then **prepend** a new entry (newest first, after the header) using this template:

```markdown
## YYYY-MM-DD — [Session Focus]

### Done

- [bullet points of completed work, INCLUDING any code review fixes addressed during this session]

### Decisions

- [any architectural or process decisions made]
```

**Important changes from previous format:**

- The DEVLOG **no longer has a "Next" section** for deferred work. Deferred items go in `docs/backlog.md` instead.
- Only include an **"Issues Found"** section if there are bugs or problems discovered during this session that need immediate attention (e.g., "CI is broken", "test is flaky"). Routine follow-up work goes in the backlog.
- The DEVLOG entry should capture the full session including any code review outcomes (e.g., "Addressed review: fixed X, deferred Y").

If today already has a DEVLOG entry for this session's work, **append to the existing entry's sections** rather than creating a duplicate.

**File convention:** Monthly rotation in `docs/devlog/YYYY-MM.md`. Never write to `docs/DEVLOG.md` (redirect stub only).

#### 4b: Update backlog

Read `docs/backlog.md` and update it:

1. **Check off completed items:** If any backlog items were completed in this session, mark them `[x]`.
2. **Add new deferrals:** Any items raised during the session that were intentionally deferred (code review findings, ideas, discovered work) get added to the appropriate track section with a source annotation (e.g., `— (DEVLOG 2026-02-15, code review)`).
3. **Add items from code reviews:** If `/opencode-review` or `/codex-review` was run, any findings that were noted but not addressed in this session should be added with their priority level (e.g., `- [ ] [P2] Add input validation on X endpoint — (code review 2026-02-15)`).

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

### Step 6.5: Run branch review

<!-- Active review tool: /codex-review. To switch back: replace /codex-review with /opencode-review -->

After all commits (code + docs) are complete but before pushing, run a branch review:

1. **Check prerequisites:** Verify all code changes are committed (no uncommitted changes except `session-handoff.md` which is gitignored).

2. **Run the review:** Execute `/codex-review branch` (which includes plan drift detection if a plan file exists).

3. **Present findings to the user:** Show the review results and ask which findings (if any) to address before the PR.

4. **If findings are addressed:** Make the fixes, commit them (new commit, not amend), then proceed to Step 7.

5. **If no findings or user says "none":** Proceed to Step 7.

**Skip this step when:**

- The session had no code changes (doc-only update)
- The user explicitly says to skip review (e.g., "just push it")
- A `/codex-review branch` (or `/opencode-review branch`) was already run during this session and no code changes were made after it

**IMPORTANT: A plan review (`/codex-review plan`) does NOT substitute for a branch review.** Plan reviews check the plan's assumptions against the codebase; branch reviews check the actual implementation. Even if a plan review ran earlier in the session, a branch review is still required here unless explicitly skipped by the user.

Update the session summary (Step 9) to include the review outcome under "Code Review", distinguishing between plan and branch reviews.

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
- [Review findings addressed with counts, or "No review done this session"]

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
- `gh pr edit` is broken (Projects Classic deprecation). Use `gh api repos/{owner}/{repo}/pulls/{number} -X PATCH -f title="..." -f body="..."` instead
- `gh pr create/list/view` use GraphQL (5000 pts/hr shared budget). If rate limit errors occur, convert to REST: `gh api repos/{owner}/{repo}/pulls`
- The DEVLOG entry should be concise but complete — future sessions rely on it for context
- If the session had multiple unrelated workstreams, consider whether they should be separate PRs
- Doc updates are always the LAST commit — after all code changes and any review fixes, but BEFORE the push/PR so CI covers everything in one run
- Do NOT switch to `main`, delete branches, or do branch cleanup — that's handled by `/start-session`
- The PR should be left open for the user to review and merge
