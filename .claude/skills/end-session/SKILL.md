---
name: end-session
description: End-of-session housekeeping — update docs, clean up git state, and summarize work.
---

# /end-session

End-of-session housekeeping: address AI review, update docs, push to PR, and summarize work.

## What this skill does

1. Gathers session context from the conversation
2. Ensures all code changes are committed on a feature branch (not `main`)
3. Pushes the branch and creates/updates a PR if needed
4. Checks and addresses AI review comments — fixes code if needed
5. Updates `docs/DEVLOG.md` with a session summary (captures everything including AI review fixes)
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

### Step 3: Check and address AI review

If a PR exists for the current branch, check if the AI reviewer has posted comments:

```bash
gh pr view <number> --comments --json comments --jq '.comments[] | select(.author.login == "github-actions") | {createdAt: .createdAt, body: .body}'
```

**If AI review comments exist and haven't been addressed yet:**

1. Parse and categorize each finding (critical, important, suggestion)
2. Evaluate each finding by reading the relevant source code:
   - **Legitimate issue — fix it**: Apply the minimal fix needed
   - **Legitimate concern — already handled**: Note why it's already addressed
   - **False positive — dismiss**: Note reasoning
3. If code fixes were made, commit and push them:

   ```bash
   git add <fixed files>
   git commit -m "fix: address AI review feedback on PR #<number>

   <summary of what was fixed>"
   git push origin <branch-name>
   ```

4. Post a response comment on the PR:

   ```bash
   gh pr comment <number> --body "$(cat <<'COMMENT'
   ## AI Review Response

   ### Fixed
   - [description of each fix applied, with file:line references]

   ### Already Handled
   - [findings that are valid but already addressed, with explanation]

   ### Dismissed
   - [false positives with reasoning for dismissal]
   COMMENT
   )"
   ```

   Omit any section that has no items.

**If no AI review comments exist yet:**

Check if CI has finished:

```bash
gh run list --branch <branch-name> --limit 1 --json status,conclusion,name --jq '.[] | select(.name == "CI") | "\(.status) \(.conclusion)"'
```

If CI is still running or just passed, the AI review may not have triggered yet (it runs via `workflow_run` after CI passes). Note this in the session summary so the user knows to check later or run `/check-ai-review` before merging.

**If AI review was already addressed earlier in the session**, note this and skip to the next step.

### Step 4: Update DEVLOG

Read `docs/DEVLOG.md` to see the latest entry format, then **prepend** a new entry (newest first) using this template:

```markdown
## YYYY-MM-DD — [Session Focus]

### Done

- [bullet points of completed work, INCLUDING any AI review fixes]

### Decisions

- [any architectural or process decisions made]

### Issues Found (optional)

- [bugs or problems discovered but not yet fixed]

### Next

- [planned follow-up work]
```

If today already has a DEVLOG entry for this session's work, **append to the existing entry's sections** rather than creating a duplicate.

**Important:** The DEVLOG entry should capture the full session including AI review outcomes (e.g., "Addressed AI review: fixed X, dismissed Y as false positive").

### Step 5: Check for CLAUDE.md and other doc updates

Search the codebase for any `TODO(CLAUDE.md)` comments added during this session using the Grep tool (not bash) to search for `TODO(CLAUDE.md)` in `*.ts`, `*.tsx`, and `*.js` files.

Also review the session for any new patterns, quirks, or constraints discovered. Check whether any of these need updates:

- `CLAUDE.md` — Known Quirks, Security Status checklist, Version Pins
- `docs/testing.md` — test counts, new test tiers, running instructions
- Other docs referenced in the session

If updates are warranted, propose them:

```markdown
## Suggested Update for CLAUDE.md

**Section**: [section name]
**Addition**: [new content]
**Rationale**: [why this is important]
```

Ask the user if they want to apply the suggestions before proceeding.

### Step 6: Commit and push doc updates

This is the **final commit** on the branch. Stage all doc changes:

```bash
git add docs/DEVLOG.md CLAUDE.md docs/testing.md [any other docs]
git commit -m "docs: update DEVLOG and docs for [session date] session"
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

### AI Review
- [findings addressed with counts, or "LGTM — no issues", or "Not yet posted — check with /check-ai-review before merging"]

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
- Doc updates are always the LAST commit — after all code changes and AI review fixes
- Do NOT switch to `main`, delete branches, or do branch cleanup — that's handled by `/start-session`
- The PR should be left open for the user to review and merge
