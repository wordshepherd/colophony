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

Check whether the previous session ended cleanly. Run these in parallel:

```bash
# Get the date from the latest DEVLOG entry
grep -m1 -oE '## [0-9]{4}-[0-9]{2}-[0-9]{2}' docs/DEVLOG.md | sed 's/## //'

# Get the date of the most recent commit on main
git log origin/main -1 --format='%cs'

# Get recently merged PRs (last 48 hours)
gh pr list --state merged --limit 10 --json number,title,mergedAt,headRefName

# Check for stale local branches (merged remotely but still local)
git branch --merged origin/main | grep -v '^\*\|main$' | sed 's/^[* ] *//'
```

Flag an **incomplete session** if ANY of these are true:

1. **DEVLOG is stale**: The most recent commit date on `origin/main` is newer than the latest DEVLOG entry date. This means work was merged without a DEVLOG update.
2. **Stale branches exist**: Local branches that are already merged to main but weren't cleaned up (indicates session ended without housekeeping).
3. **On a merged branch**: The current branch is a feature branch whose PR has already been merged.

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
git branch --list --format='%(refname:short) %(upstream:track)' | grep -v '^\s*$'
```

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

Also check for any `TODO(CLAUDE.md)` comments in the codebase:

```bash
grep -r "TODO(CLAUDE.md)" --include="*.ts" --include="*.tsx" --include="*.js" . 2>/dev/null
```

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

## Important notes

- This is a READ-ONLY operation — do not modify any files or start any services (exception: if the user opts for catch-up housekeeping in Step 1, perform end-session steps before continuing)
- Use `gh run list/view` for CI status, NOT `gh pr checks` (fine-grained PAT limitation)
- Keep the briefing concise — the user wants orientation, not a novel
- If Docker services are down, mention it but don't block — the user may not need them for every task
- If there are uncommitted changes on `main`, flag this prominently as it likely needs to be moved to a branch
