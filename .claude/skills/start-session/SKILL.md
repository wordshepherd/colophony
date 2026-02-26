---
name: start-session
description: Start-of-session orientation — load context, check environment, surface open work.
---

# /start-session

Start-of-session orientation: load context, check environment, surface open work.

## What this skill does

1. Detects incomplete previous sessions (missed /end-session) and offers catch-up
2. Cleans up stale local branches from merged PRs
3. Reads the latest DEVLOG entry for session context (what was done, open issues)
4. Checks git state (branch, uncommitted changes, open PRs)
5. Checks CI health and open PR status
6. Verifies infrastructure is running (Docker, DB)
7. Assesses development track status and identifies the highest-priority work
8. Prints a briefing with track-driven focus suggestions

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

For the DEVLOG date, determine the current month's devlog file (`docs/devlog/YYYY-MM.md`, e.g., `docs/devlog/2026-02.md`). Use the Grep tool (not bash) to find the first `## YYYY-MM-DD` heading in that file and extract the date.

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

### Step 1b: Clean up stale branches

After the incomplete session check (regardless of outcome), clean up any local branches whose remote tracking branch has been deleted (i.e., squash-merged PRs from previous sessions):

```bash
git fetch --prune
git branch -vv
```

Claude parses the `git branch -vv` output:

- Lines containing `[gone]` indicate branches whose upstream was deleted (the PR was merged/closed and the remote branch removed)
- Lines starting with `*` indicate the current branch
- Extract the branch name (first non-whitespace token after `*` or leading spaces)
- Skip `main` — never delete main

If any stale branches are found (upstream `[gone]`), list them and delete:

```bash
git branch -D "<branch-name>"
```

Note: Use `-D` (force delete) because squash-merged branches are not recognized as `--merged` by git.

If the **current branch** has upstream `[gone]` (you're on a merged feature branch), switch to `main` first, then delete it:

```bash
git checkout main && git pull origin main
git branch -D "<previous-branch-name>"
```

Report what was cleaned up in the briefing.

If no stale branches are found, skip this step silently.

### Step 2: Load session context

**Primary source: `session-handoff.md`** (project root). Check if this file exists. If it does, read it for instant context restoration:

- Branch and PR status
- Files touched (scope of recent changes)
- Decisions made during last session
- Open questions and next action (immediate focus)

After reading, delete the handoff file so it doesn't persist across sessions:

```bash
rm session-handoff.md
```

**Fallback: DEVLOG** — If `session-handoff.md` does not exist (previous session ended without `/end-session`, or first session), fall back to the DEVLOG.

Determine the current month's devlog file: `docs/devlog/YYYY-MM.md` (e.g., `docs/devlog/2026-02.md`). If the file for the current month doesn't exist yet, check the previous month's file instead.

Read the most recent entry (the first entry after the header). Extract:

- **What was done last** — the "Done" section
- **Open issues** — the "Issues Found" or "Bugs Found" section (if any)

Report which source was used in the briefing (handoff file or DEVLOG fallback). Note: Track status (Step 6) determines the suggested focus, not the handoff or DEVLOG.

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

For PRs with failures, fetch the failure details:

```bash
gh run list --branch <branch> --limit 1 --json databaseId,conclusion --jq '.[] | select(.conclusion == "failure") | .databaseId'
```

Then `gh run view <id> --json jobs --jq '.jobs[] | select(.conclusion == "failure") | .name'`

### Step 5: Check infrastructure

Run these commands in parallel:

```bash
docker compose ps --format '{{.Name}}\t{{.Status}}' 2>/dev/null || echo "Docker Compose not running"
```

Check for stale dev processes blocking ports 3000/4000:

```bash
lsof -ti :3000 2>/dev/null && echo "stale:3000" || true
lsof -ti :4000 2>/dev/null && echo "stale:4000" || true
```

If stale processes are found on either port, report them in the briefing and suggest running `pnpm dev:clean` before starting dev servers.

Also check if the Codex review tmux window is available (part of the `colophony` tmux session):

```bash
tmux list-windows -t colophony -F '#{window_name}' 2>/dev/null | grep -q codex-review && echo "available" || echo "not found (start with: cc)"
```

Report which services are up/down. Flag if critical services (postgres, redis) are not running.

Do NOT auto-start services — just report status so the user can decide.

### Step 6: Determine track status and priorities

The development tracks in `docs/architecture-v2-planning.md` Section 6.2 define the project's priority order. The DEVLOG "Next" items are session-level continuity notes, NOT the strategic priority. **Tracks take precedence over DEVLOG "Next" when suggesting focus.**

**Primary source: `docs/backlog.md`** — Read the backlog file and identify:

- Which track has the most unchecked `[ ]` code items (this is the current track)
- The unchecked items in the current track (these are the priority suggestions)
- Any items in later tracks that shouldn't have been started yet (track drift)

**Secondary: codebase spot-checks** — For the current track, verify the backlog is accurate by spot-checking a few items against the codebase. For example, for Track 1: grep for `@fastify/helmet` in `apps/api/`, check if rate-limit hook is registered in `main.ts`, check for API key auth middleware.

Also check for any `TODO(CLAUDE.md)` comments in the codebase using the Grep tool (not bash) to search for `TODO(CLAUDE.md)` in `*.ts`, `*.tsx`, and `*.js` files.

### Step 7: Print briefing

Format everything as a concise briefing:

```
## Session Briefing

### Last Session
[Date] — [Focus]
[Brief summary of what was done — from DEVLOG "Done" section]

### Git State
- Branch: <current branch>
- Uncommitted changes: [yes/no, summary if yes]
- Open PRs: [list with CI status]
- Branches cleaned up: [list of deleted stale branches, or "None"]

### Infrastructure
- PostgreSQL: [running/stopped]
- Redis: [running/stopped]
- MinIO: [running/stopped]
- Code review: [available] (run /opencode-review or /codex-review when ready)

### Track Status
- Current track: [Track N — Name] ([X]% complete)
- Remaining items: [list gaps in the current track]
- Track drift: [flag if recent work has been on a later track while the current track has gaps]

### Backlog (Current Track)
- [unchecked items from docs/backlog.md for the current track — code items first, then QA, then ops]
- [total count of remaining items in current track]

### Other
- [TODO(CLAUDE.md) items if any]
- [open issues from DEVLOG "Issues Found" if any]

### Suggested Focus
[Based on TRACK PRIORITY first, then DEVLOG "Next" items. If the current track has
unfinished code items, suggest those over DEVLOG "Next" items from later tracks.
Clearly distinguish between "track priority" and "session continuity" suggestions.
Example: "Track 1 has 3 unfinished code items (helmet, rate limiting, API key auth).
The DEVLOG suggests E2E tests and editor dashboard (Track 3), but closing Track 1
gaps should come first."]
```

### Step 8: Branch prompt (when on main)

If the current branch is `main` and there is no open feature branch for the suggested focus, prompt the user to confirm what they're working on and offer to create a branch.

**Priority order for suggestions:**

1. Unfinished code items in the current track (highest priority)
2. Next track that's ready to start (if current track is complete or only has ops/deployment items remaining)
3. DEVLOG "Next" items (only if they align with track priorities, or if the user explicitly wants to work on them)

```
You're on main. What are you working on this session?

Based on track priorities, I'd suggest:
  1. [Track N item] → `feat/<suggested-branch>` (track priority)
  2. [Track N item] → `feat/<suggested-branch>` (track priority)
  3. [DEVLOG item, if relevant] → `feat/<suggested-branch>` (session continuity)
  4. Something else

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
- `gh pr edit` is broken (Projects Classic deprecation). Use `gh api repos/{owner}/{repo}/pulls/{number} -X PATCH` instead
- `gh pr create/list/view` use GraphQL (5000 pts/hr shared budget). If rate limit errors occur, convert to REST: `gh api repos/{owner}/{repo}/pulls`
- Keep the briefing concise — the user wants orientation, not a novel
- If Docker services are down, mention it but don't block — the user may not need them for every task
- If there are uncommitted changes on `main`, flag this prominently as it likely needs to be moved to a branch
- Always prompt for a branch when on `main` (Step 8) — never skip this, as the pre-push hook blocks pushes to main
