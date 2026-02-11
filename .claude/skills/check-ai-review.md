# /check-ai-review

Fetch, evaluate, and address AI code review comments on a PR.

## What this skill does

1. Fetches AI review comments from the specified PR (or auto-detects current branch's PR)
2. Categorizes findings by severity (critical, important, suggestion)
3. Evaluates each finding — is it a real issue or a false positive?
4. Fixes legitimate issues and dismisses false positives with reasoning
5. Posts a response comment on the PR summarizing actions taken

## Usage

```
/check-ai-review           # Auto-detect PR for current branch
/check-ai-review 18        # Check specific PR number
```

## Instructions for Claude

When the user invokes `/check-ai-review`:

### Step 1: Identify the PR

If a PR number is provided, use that. Otherwise, detect the current branch's PR:

```bash
gh pr list --head $(git branch --show-current) --json number,title --jq '.[0] | "#\(.number) \(.title)"'
```

If no PR exists for the current branch, tell the user and exit.

### Step 2: Fetch AI review comments

Fetch all comments from the `github-actions` bot (the AI reviewer):

```bash
gh pr view <number> --comments --json comments --jq '.comments[] | select(.author.login == "github-actions") | {createdAt: .createdAt, body: .body}'
```

If there are no AI review comments, tell the user the review hasn't posted yet. Check if CI is still running:

```bash
gh run list --branch <branch> --limit 1 --json status,conclusion,name --jq '.[] | select(.name == "CI") | "\(.status) \(.conclusion)"'
```

If CI is still running or just completed, the AI review may not have triggered yet (it runs via `workflow_run` after CI passes). Let the user know to wait a few minutes and try again.

### Step 3: Parse and categorize findings

Read through each AI review comment. The AI reviewer uses these categories:

- **Critical** — security vulnerabilities, RLS violations, data leaks
- **Important** — bugs, reliability issues, missing error handling
- **Suggestions** — style, optimization, nice-to-haves

Extract each individual finding with:

- Category/severity
- File and line reference
- Description of the issue
- Suggested fix (if provided)

### Step 4: Evaluate each finding

For each finding, assess whether it's:

1. **Legitimate issue — fix it**: The finding identifies a real bug, security issue, or reliability problem. Apply the fix.

2. **Legitimate concern — already handled**: The issue is valid in general but is already addressed by existing code the reviewer didn't see (e.g., error handling in a helper function, RLS via superuser client by design).

3. **False positive — dismiss**: The finding is based on incorrect assumptions about the codebase (e.g., suggesting RLS context for test helpers that intentionally bypass RLS).

For each evaluation, note your reasoning. When fixing issues:

- Read the relevant source files first
- Make the minimal fix needed
- Verify the fix doesn't break tests

### Step 5: Commit fixes (if any)

If you made code changes:

```bash
git add <fixed files>
git commit -m "fix: address AI review feedback on PR #<number>

<summary of what was fixed>"
git push origin <branch>
```

### Step 6: Post response comment

Post a response comment on the PR summarizing your evaluation:

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

### Step 7: Report to user

Print a summary:

```
## AI Review: PR #<number>

**Findings:** X total (Y fixed, Z already handled, W dismissed)

### Fixed
- [list]

### Already Handled
- [list]

### Dismissed
- [list]
```

## Important notes

- Always READ the source code before evaluating a finding — don't assume it's wrong
- The AI reviewer doesn't have full repo context, so false positives are common for:
  - Test helpers (intentionally bypass RLS with superuser)
  - Cleanup functions with `.catch(() => {})` (already swallow errors)
  - Patterns documented in CLAUDE.md (e.g., `withOrgContext` for RLS)
- Security findings (RLS, data leaks, PCI) should be evaluated carefully even if they seem like false positives
- When fixing, keep changes minimal — don't refactor surrounding code
- Use `gh run list/view` for CI status, NOT `gh pr checks`
