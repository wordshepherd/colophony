---
name: start-session
description: Start-of-session orientation — load context, check environment, surface open work.
---

# /start-session

Start-of-session orientation: load context, check environment, surface open work.

## What this skill does

1. Detects incomplete previous sessions (missed /end-session) and offers catch-up
2. Reads the latest DEVLOG entry for context and planned next steps
3. Checks git state (branch, uncommitted changes, open PRs)
4. Checks CI health and open PR status
5. Verifies infrastructure is running (Docker, DB)
6. Surfaces open roadmap items and pending work
7. Prints a briefing for the user

## Usage

```
/start-session
```

## Instructions for Claude

When the user invokes `/start-session`, perform these steps in order:

### Step 1: Detect incomplete previous session

Check whether the previous session ended cleanly. First, fetch the latest remote state:

```bash
git fetch origin main
```

Then run these in parallel:

```bash
# Get the date of the most recent commit on main
git log origin/main -1 --format='%cs'

# Get recently merged PRs (10 most recent)
gh pr list --state merged --limit 10 --json number,title,mergedAt,headRefName

# Check for stale local branches (squash-merged PRs leave branches whose upstream is gone)
# AND check if current branch is a feature branch whose upstream was deleted
git fetch --prune
git branch -vv
```

For the DEVLOG date, use the Grep tool (not bash) to find the first `## YYYY-MM-DD` heading in `docs/DEVLOG.md` and extract the date.

For the `git branch -vv` output, Claude parses it directly:

- Lines containing `[gone]` indicate branches whose remote tracking branch was deleted (PR merged/closed)
- Lines starting with `*` indicate the current branch
- Extract the branch name (first non-whitespace token after `*` or leading spaces)
- Skip `main` — never flag main
- Branches with `[gone]` upstream (excluding main) are stale branches
- If the `*` (current) branch has `[gone]` upstream, the current branch is a merged feature branch

Flag an **incomplete session** if ANY of these are true:

1. **DEVLOG is stale**: The most recent commit date on `origin/main` is newer than the latest DEVLOG entry date. This means work was merged without a DEVLOG update.
2. **Stale branches exist**: Local branches whose remote tracking branch is `[gone]` (squash-merged PRs not cleaned up — indicates session ended without housekeeping).
3. **On a merged branch**: The current branch is a feature branch whose upstream is `[gone]`.

If an incomplete session is detected, alert the user prominently:

```
⚠️  INCOMPLETE SESSION DETECTED

The previous session appears to have ended without running /end-session:
- [describe what was found: stale branches, missing DEVLOG entries, etc.]
- Merged PRs since last DEVLOG: [list]

Recommend: Run /end-session first to catch up, then continue with this session.
Or: I can do the catch-up housekeeping now before the briefing.
```

Wait for the user to decide before continuing. If they say to catch up, perform the end-session steps (DEVLOG update, branch cleanup) before proceeding with the rest of the briefing.

If no incomplete session is detected, proceed normally.

### Step 2: Load session context from DEVLOG

Read the most recent entry in `docs/DEVLOG.md` (the first entry after the header). Extract:

- **What was done last** — the "Done" section
- **Open issues** — the "Issues Found" or "Bugs Found" section (if any)
- **Planned next steps** — the "Next" section

This is the primary source of continuity between sessions.

### Step 3: Check git state

Run these commands in parallel:

```bash
git branch --show-current
git status --short
git log --oneline -5
git branch --list --format='%(refname:short) %(upstream:track)'
```

For the branch tracking output, Claude filters out blank lines when parsing the result.

Report:

- Current branch (flag if on `main` with no feature branch)
- Any uncommitted changes (summarize what files are modified)
- Recent commit history for context

### Step 4: Check open PRs and CI

Run these commands in parallel:

```bash
gh pr list --state open --json number,title,headRefName,createdAt --jq '.[] | "#\(.number) \(.title) [\(.headRefName)]"'
gh run list --limit 5 --json headBranch,status,conclusion,name --jq '.[] | select(.name == "CI") | "\(.headBranch)\t\(.conclusion)"'
```

Report:

- Open PRs and their branches
- CI status for each (pass/fail)
- Any PRs with failing CI that need attention
- Any PRs with unresolved AI review comments

For PRs with failures, fetch the failure details:

```bash
gh run list --branch <branch> --limit 1 --json databaseId,conclusion --jq '.[] | select(.conclusion == "failure") | .databaseId'
```

Then `gh run view <id> --json jobs --jq '.jobs[] | select(.conclusion == "failure") | .name'`

For each open PR, check for unaddressed AI review comments:

```bash
gh pr view <number> --comments --json comments --jq '[.comments[] | select(.author.login == "github-actions")] | length'
```

If a PR has AI review comments, note it in the briefing. To check whether they've already been addressed, look for a follow-up "AI Review Response" comment:

```bash
gh pr view <number> --comments --json comments --jq '.comments[] | select(.body | test("AI Review Response")) | .createdAt'
```

If there are AI review comments with no response, flag the PR as needing attention.

### Step 5: Check infrastructure

Run these commands in parallel:

```bash
docker compose ps --format '{{.Name}}\t{{.Status}}' 2>/dev/null || echo "Docker Compose not running"
```

Report which services are up/down. Flag if critical services (postgres, redis) are not running.

Do NOT auto-start services — just report status so the user can decide.

### Step 6: Surface open work

Read the Post-MVP Roadmap section of `CLAUDE.md` (search for `## Post-MVP Roadmap`) and list the unchecked `[ ]` items from the "Immediate (pre-launch)" and "Short-term" sections.

Also check for any `TODO(CLAUDE.md)` comments in the codebase using the Grep tool (not bash) to search for `TODO(CLAUDE.md)` in `*.ts`, `*.tsx`, and `*.js` files.

### Step 7: Print briefing

Format everything as a concise briefing:

```
## Session Briefing

### Last Session
[Date] — [Focus]
Next steps planned: [bullet points from DEVLOG "Next" section]

### Git State
- Branch: <current branch>
- Uncommitted changes: [yes/no, summary if yes]
- Open PRs: [list with CI status and AI review status]

### Infrastructure
- PostgreSQL: [running/stopped]
- Redis: [running/stopped]
- MinIO: [running/stopped]

### Open Work
- [unchecked roadmap items]
- [TODO(CLAUDE.md) items if any]
- [open issues from DEVLOG]

### Suggested Focus
[Based on the DEVLOG "Next" section and open PR state, suggest what to work on]
```

### Step 8: Branch prompt (when on main)

If the current branch is `main` and there is no open feature branch for the suggested focus, prompt the user to confirm what they're working on and offer to create a branch:

```
You're on main. What are you working on this session?

Based on the DEVLOG "Next" steps, I'd suggest:
  1. <suggested topic> → `feat/<suggested-branch>`
  2. <other topic> → `fix/<suggested-branch>`
  3. Something else

Want me to create a branch so we're ready to go?
```

Use AskUserQuestion with the suggested options. Once the user picks (or provides their own topic), create the branch with:

```bash
git checkout -b <prefix>/<branch-name>
```

If the user is already on a feature branch, skip this step entirely.

## Important notes

- This is a READ-ONLY operation — do not modify any files or start any services (exception: if the user opts for catch-up housekeeping in Step 1, perform end-session steps before continuing)
- Use `gh run list/view` for CI status, NOT `gh pr checks` (fine-grained PAT limitation)
- Keep the briefing concise — the user wants orientation, not a novel
- If Docker services are down, mention it but don't block — the user may not need them for every task
- If there are uncommitted changes on `main`, flag this prominently as it likely needs to be moved to a branch
- Always prompt for a branch when on `main` (Step 8) — never skip this, as the pre-push hook blocks pushes to main
