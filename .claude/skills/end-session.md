---
name: end-session
description: End-of-session housekeeping — update docs, clean up git state, and summarize work.
---

# /end-session

End-of-session housekeeping: update docs, clean up git state, and summarize work.

## What this skill does

1. Updates `docs/DEVLOG.md` with a session summary
2. Checks for any `TODO(CLAUDE.md)` comments and proposes updates
3. Ensures all changes are committed on a feature branch (not `main`)
4. Pushes the branch and creates/updates a PR if needed
5. Checks and addresses AI review comments on the PR
6. Prints a session summary for the user

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

### Step 2: Update DEVLOG

Read `docs/DEVLOG.md` to see the latest entry format, then **prepend** a new entry (newest first) using this template:

```markdown
## YYYY-MM-DD — [Session Focus]

### Done

- [bullet points of completed work]

### Decisions

- [any architectural or process decisions made]

### Issues Found (optional)

- [bugs or problems discovered but not yet fixed]

### Next

- [planned follow-up work]
```

If today already has a DEVLOG entry, **append to the existing entry's sections** rather than creating a duplicate date entry.

### Step 3: Check for CLAUDE.md updates

Search the codebase for any `TODO(CLAUDE.md)` comments added during this session:

```bash
grep -r "TODO(CLAUDE.md)" --include="*.ts" --include="*.tsx" --include="*.js" .
```

Also review the session for any new patterns, quirks, or constraints discovered. If updates are warranted, propose them:

```markdown
## Suggested Update for CLAUDE.md

**Section**: [section name]
**Addition**: [new content]
**Rationale**: [why this is important]
```

Ask the user if they want to apply the suggestions before proceeding.

### Step 4: Git hygiene

1. **Check branch**: Verify we are NOT on `main`. If on `main` with unpushed commits, create a feature branch first.

2. **Check for uncommitted changes** that belong to this session's work:

   ```bash
   git status
   git diff --stat
   ```

   If there are relevant uncommitted changes (e.g., the DEVLOG update), stage and commit them:

   ```bash
   git add docs/DEVLOG.md [other session files]
   git commit -m "docs: update DEVLOG for [session date] session"
   ```

3. **Push the branch**:

   ```bash
   git push -u origin <branch-name>
   ```

4. **Create or update PR**: Check if a PR already exists for this branch:

   ```bash
   gh pr list --head <branch-name> --json number --jq '.[0].number'
   ```

   - If no PR exists, create one with `gh pr create`
   - If a PR exists, it's already updated by the push

5. **Check CI status** on the PR (use Actions API, NOT `gh pr checks`):
   ```bash
   gh run list --branch <branch-name> --limit 1 --json status,conclusion,name
   ```
   Report the CI status to the user.

### Step 5: Check AI review on PR

If a PR exists for the current branch, check if the AI reviewer has posted comments:

```bash
gh pr view <number> --comments --json comments --jq '.comments[] | select(.author.login == "github-actions") | {createdAt: .createdAt, body: .body}'
```

If there are AI review comments that haven't been addressed yet:

1. Use the `/check-ai-review <number>` skill logic to evaluate each finding
2. Fix legitimate issues, dismiss false positives
3. Commit and push any fixes
4. Post a response comment on the PR

If there are no AI review comments, check if CI has finished:

```bash
gh run list --branch <branch-name> --limit 1 --json status,conclusion,name --jq '.[] | select(.name == "CI") | "\(.status) \(.conclusion)"'
```

If CI is still running or just passed, the AI review may not have triggered yet (it runs via `workflow_run` after CI passes). Note this in the session summary so the user knows to check later.

### Step 6: Session summary

Print a summary for the user:

```
## Session Summary

**Branch:** <branch-name>
**PR:** <PR URL>
**CI:** <status>

### Changes
- [list of commits in this session]

### DEVLOG
- Updated docs/DEVLOG.md with session entry

### CLAUDE.md Updates
- [any proposed or applied updates, or "None needed"]

### AI Review
- [findings addressed, or "No AI review comments yet — check after CI passes"]

### Open Items
- [anything left undone, PRs awaiting review, etc.]
```

## Important notes

- NEVER push to `main` — always use a feature branch
- Use `gh run list/view` for CI status, NOT `gh pr checks` (fine-grained PAT limitation)
- The DEVLOG entry should be concise but complete — future sessions rely on it for context
- If the session had multiple unrelated workstreams, consider whether they should be separate PRs
- Commit the DEVLOG update as the last commit on the branch, after all code changes
