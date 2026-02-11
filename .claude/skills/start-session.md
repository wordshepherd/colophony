# /start-session

Start-of-session orientation: load context, check environment, surface open work.

## What this skill does

1. Reads the latest DEVLOG entry for context and planned next steps
2. Checks git state (branch, uncommitted changes, open PRs)
3. Checks CI health and open PR status
4. Verifies infrastructure is running (Docker, DB)
5. Surfaces open roadmap items and pending work
6. Prints a briefing for the user

## Usage

```
/start-session
```

## Instructions for Claude

When the user invokes `/start-session`, perform these steps in order:

### Step 1: Load session context from DEVLOG

Read the most recent entry in `docs/DEVLOG.md` (the first entry after the header). Extract:

- **What was done last** — the "Done" section
- **Open issues** — the "Issues Found" or "Bugs Found" section (if any)
- **Planned next steps** — the "Next" section

This is the primary source of continuity between sessions.

### Step 2: Check git state

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

### Step 3: Check open PRs and CI

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

### Step 4: Check infrastructure

Run these commands in parallel:

```bash
docker compose ps --format '{{.Name}}\t{{.Status}}' 2>/dev/null || echo "Docker Compose not running"
```

Report which services are up/down. Flag if critical services (postgres, redis) are not running.

Do NOT auto-start services — just report status so the user can decide.

### Step 5: Surface open work

Read the Post-MVP Roadmap section of `CLAUDE.md` (search for `## Post-MVP Roadmap`) and list the unchecked `[ ]` items from the "Immediate (pre-launch)" and "Short-term" sections.

Also check for any `TODO(CLAUDE.md)` comments in the codebase:

```bash
grep -r "TODO(CLAUDE.md)" --include="*.ts" --include="*.tsx" --include="*.js" . 2>/dev/null
```

### Step 6: Print briefing

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

- This is a READ-ONLY operation — do not modify any files or start any services
- Use `gh run list/view` for CI status, NOT `gh pr checks` (fine-grained PAT limitation)
- Keep the briefing concise — the user wants orientation, not a novel
- If Docker services are down, mention it but don't block — the user may not need them for every task
- If there are uncommitted changes on `main`, flag this prominently as it likely needs to be moved to a branch
