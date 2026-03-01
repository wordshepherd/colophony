---
name: codex-review
description: Run Codex code review non-interactively (plan, diff, branch; default branch).
---

# /codex-review

Run a local code review via `codex review` (non-interactive). For interactive Codex sessions with live progress visibility, see **Interactive Codex (tmux)** in CLAUDE.md.

## What this skill does

1. Verifies prerequisites (nvm, node, codex)
2. Builds a review prompt with project rules
3. Runs `codex review` non-interactively with the appropriate flags
4. Captures output and presents findings structured by severity

## Usage

```
/codex-review              # Review all changes on current branch vs origin/main (default)
/codex-review branch       # Same as above
/codex-review diff         # Review staged/unstaged changes
/codex-review plan         # Review the current plan file
```

## Instructions for Claude

When the user invokes `/codex-review`, perform these steps in order:

### Step 1: Preflight check

```bash
export NVM_DIR="$HOME/.nvm" && [ -s "$NVM_DIR/nvm.sh" ] && . "$NVM_DIR/nvm.sh" && nvm use v22.22.0 > /dev/null 2>&1 && command -v codex
```

If nvm/node/codex are not available, print:

```
Codex CLI not found. Ensure nvm is installed, node v22.22.0 is available, and codex is installed globally:
  nvm install v22.22.0
  npm install -g @openai/codex
```

If the check fails, stop here — do not proceed.

### Step 2: Determine review type and build command

Parse the argument (if any) from the skill invocation:

- No argument or `branch` → **branch review**
- `diff` → **diff review**
- `plan` → **plan review**

### Step 3: Project rules (applied automatically)

For **branch** and **diff** reviews, `codex review` does not accept an inline prompt — `--base` and `--uncommitted` are mutually exclusive with the `[PROMPT]` argument. Project-specific review rules are loaded automatically from Codex's rules files (`.codex/instructions.md` in the repo root, or `~/.codex/rules/`).

For **plan** review only, a custom prompt is built and passed via stdin to `codex exec`. Build it from these project rules:

```
Key project rules to enforce:
- Multi-tenancy via RLS: all tenant table queries MUST use SET LOCAL inside transactions, never session-level SET. app_user MUST NOT be superuser. All tenant tables MUST have FORCE ROW LEVEL SECURITY.
- Webhook idempotency: ALL webhook handlers (Stripe, Zitadel) MUST check processed status before handling. Use DB transactions.
- PCI compliance: NEVER log card numbers or CVV. NEVER store card data. Stripe Checkout only.
- Audit logging: sensitive operations MUST be audit logged.
- Input validation: use Zod schemas from @colophony/types on all API surfaces.
- Defense-in-depth for multi-tenancy: service methods querying tenant data MUST include explicit organizationId filter even when RLS is active. Unused parameters prefixed with _ in service methods are a red flag for missing filters.
- SSRF protection: outbound HTTP calls to user-controlled URLs (webhooks, callbacks, federation) MUST validate via validateOutboundUrl(). Direct fetch() to user URLs without SSRF checks is Critical.
- Unbounded queries: list/query methods returning variable-size data MUST have a LIMIT or pagination. Missing LIMIT in service methods is Important.

Format your review as markdown:
- Start with a one-line verdict: LGTM, Minor issues, or Issues found
- Group findings by severity: Critical, Important, Suggestions
- Reference specific file paths and line numbers (file:line format)
- Be concise — skip formatting nits (handled by linters)
```

### Step 3.5: Plan drift check (branch review only)

For **branch** reviews only, check whether the implementation matches an approved plan:

1. **Find the plan file:** Look for the most recent plan file in `~/.claude/plans/*.md`:

   ```bash
   ls -t ~/.claude/plans/*.md 2>/dev/null | head -1
   ```

   If no plan file exists, skip this step entirely.

2. **Find the PR description:** Check if a PR exists for the current branch:

   ```bash
   gh pr view --json body --jq '.body' 2>/dev/null
   ```

3. **Extract plan overrides:** If the PR body contains a `## Plan Overrides` section, parse the table entries. These are acknowledged divergences that should not be flagged.

4. **Build drift check prompt:** Run a separate `codex exec` call before the main review:

   ```bash
   cat > /tmp/codex-drift-prompt.txt << 'DRIFT_EOF'
   Compare the plan file at [path] against the actual branch changes.

   Run: git diff origin/main...HEAD --stat
   Then read the plan file and check each planned item:

   For each item in the plan:
   - Verify the specified file exists
   - Verify expected exports/functions are present
   - Verify test cases match (by name or intent)

   Exclude these acknowledged overrides: [parsed overrides from PR body, or "none"]

   Report as a table:
   - MATCH: plan item implemented as specified
   - OVERRIDE: divergence acknowledged in Plan Overrides table
   - DRIFT: unacknowledged divergence (flag for review)
   - MISSING: plan item not implemented
   DRIFT_EOF

   export NVM_DIR="$HOME/.nvm" && [ -s "$NVM_DIR/nvm.sh" ] && . "$NVM_DIR/nvm.sh" && nvm use v22.22.0 > /dev/null 2>&1 && cd /home/dmahaffey/projects/colophony && codex exec -s read-only - < /tmp/codex-drift-prompt.txt
   ```

5. **Present drift findings** in a separate section before the main Codex review output:

   ```
   ## Plan Drift Check
   - N items matched
   - N overrides acknowledged
   - N items drifted (details below)
   - N items missing
   ```

**When this step produces no plan file:** Skip silently. Not all branches have an associated plan.

### Step 4: Run the review

**For branch review:**

```bash
git fetch origin main

export NVM_DIR="$HOME/.nvm" && [ -s "$NVM_DIR/nvm.sh" ] && . "$NVM_DIR/nvm.sh" && nvm use v22.22.0 > /dev/null 2>&1 && cd /home/dmahaffey/projects/colophony && codex review --base origin/main
```

**For diff review:**

First check if there are changes:

```bash
git diff --cached --stat
```

If nothing staged, check unstaged:

```bash
git diff --stat
```

If no changes at all, tell the user and exit.

Then run:

```bash
export NVM_DIR="$HOME/.nvm" && [ -s "$NVM_DIR/nvm.sh" ] && . "$NVM_DIR/nvm.sh" && nvm use v22.22.0 > /dev/null 2>&1 && cd /home/dmahaffey/projects/colophony && codex review --uncommitted
```

**For plan review:**

Find the most recent plan file:

```bash
ls -t ~/.claude/plans/*.md 2>/dev/null | head -1
```

If no plan file exists, tell the user and exit.

Then run (using `codex exec` since plan review isn't a git diff — `exec` accepts stdin prompts):

```bash
cat > /tmp/codex-review-prompt.txt << 'PROMPT_EOF'
Review the plan file at: [path to plan file]
Read the plan file, then explore the codebase to verify the plan's assumptions.
Check that referenced files exist, patterns match reality, and the approach is sound.

<project rules prompt from Step 3>
PROMPT_EOF

export NVM_DIR="$HOME/.nvm" && [ -s "$NVM_DIR/nvm.sh" ] && . "$NVM_DIR/nvm.sh" && nvm use v22.22.0 > /dev/null 2>&1 && cd /home/dmahaffey/projects/colophony && codex exec -s read-only - < /tmp/codex-review-prompt.txt
```

**Important:** Run the codex command in the background using the Bash tool's `run_in_background` parameter. Set a timeout of 300000ms (5 minutes). Tell the user the review is running and check back on it periodically.

### Step 5: Present output

When the command completes, present the review to the user with clear formatting:

```
## Codex Review Results

[review output]
```

Then ask the user which findings (if any) they want to address:

```
Which findings would you like me to address? (Enter numbers, "all", or "none")
```

## Important notes

- `codex review` runs non-interactively — no tmux session management needed
- **`codex review --base` and `--uncommitted` cannot be combined with a `[PROMPT]` argument** — they are mutually exclusive. Custom review instructions must come from Codex project rules files, not inline
- Always uses `origin/main` (fetched) for branch diffs to avoid stale comparisons
- Plan review uses `codex exec -s read-only` since it's not a git diff operation and `exec` accepts stdin prompts
- nvm must be sourced explicitly in every command because Bash tool runs non-interactive shells
- For interactive Codex sessions with live progress, see the **Interactive Codex (tmux)** section in CLAUDE.md
- **Branch reviews include plan drift detection** when a plan file exists in `~/.claude/plans/`. Acknowledged overrides in the PR's `## Plan Overrides` section are excluded from drift findings
- **Plan reviews run automatically during plan mode**: Per CLAUDE.md, non-trivial plans must run `/codex-review plan` before presenting to the user for approval
