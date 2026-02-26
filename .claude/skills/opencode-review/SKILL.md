---
name: opencode-review
description: Run OpenCode code review non-interactively (plan, diff, branch; default branch).
---

# /opencode-review

Run a local code review via `opencode run` (non-interactive). OpenCode replaces Codex as the second-opinion review tool.

## What this skill does

1. Verifies prerequisites (nvm, node, opencode)
2. Builds a review prompt with project rules
3. Runs `opencode run` non-interactively with the appropriate prompt
4. Captures output and presents findings structured by severity

## Usage

```
/opencode-review              # Review all changes on current branch vs origin/main (default)
/opencode-review branch       # Same as above
/opencode-review diff         # Review staged/unstaged changes
/opencode-review plan         # Review the current plan file
```

## Instructions for Claude

When the user invokes `/opencode-review`, perform these steps in order:

### Step 1: Preflight check

```bash
export NVM_DIR="$HOME/.nvm" && [ -s "$NVM_DIR/nvm.sh" ] && . "$NVM_DIR/nvm.sh" && nvm use v22.22.0 > /dev/null 2>&1 && command -v opencode
```

If nvm/node/opencode are not available, print:

```
OpenCode CLI not found. Ensure nvm is installed, node v22.22.0 is available, and opencode is installed globally:
  nvm install v22.22.0
  npm install -g opencode
```

If the check fails, stop here — do not proceed.

### Step 2: Determine review type and build command

Parse the argument (if any) from the skill invocation:

- No argument or `branch` → **branch review**
- `diff` → **diff review**
- `plan` → **plan review**

### Step 3: Project rules prompt

Build the project rules block used in all review prompts:

```
Key project rules to enforce:
- Multi-tenancy via RLS: all tenant table queries MUST use SET LOCAL inside transactions, never session-level SET. app_user MUST NOT be superuser. All tenant tables MUST have FORCE ROW LEVEL SECURITY.
- Webhook idempotency: ALL webhook handlers (Stripe, Zitadel) MUST check processed status before handling. Use DB transactions.
- PCI compliance: NEVER log card numbers or CVV. NEVER store card data. Stripe Checkout only.
- Audit logging: sensitive operations MUST be audit logged.
- Input validation: use Zod schemas from @colophony/types on all API surfaces.

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

4. **Build drift check prompt:** Write a prompt file and run `opencode run`:

   ```bash
   cat > /tmp/opencode-drift-prompt.txt << 'DRIFT_EOF'
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

   PROMPT=$(cat /tmp/opencode-drift-prompt.txt)
   export NVM_DIR="$HOME/.nvm" && [ -s "$NVM_DIR/nvm.sh" ] && . "$NVM_DIR/nvm.sh" && nvm use v22.22.0 > /dev/null 2>&1 && cd /home/dmahaffey/projects/colophony && opencode run "$PROMPT"
   ```

5. **Present drift findings** in a separate section before the main review output:

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

First, generate the diff and save it for context:

```bash
git fetch origin main
git diff origin/main...HEAD > /tmp/opencode-review-diff.txt
```

Then build the prompt and run:

```bash
cat > /tmp/opencode-review-prompt.txt << 'PROMPT_EOF'
You are a senior code reviewer. Review the following git diff (branch changes vs origin/main).

Read the diff file at /tmp/opencode-review-diff.txt, then review the actual source files for context.

<project rules from Step 3>

Focus on:
1. Logic errors, bugs, or security issues
2. Missing error handling or edge cases
3. Violations of the project rules above
4. Test coverage gaps for new code
5. API contract changes that could break consumers

Do NOT flag:
- Formatting or style issues (handled by linters/prettier)
- Import ordering
- Minor naming preferences
PROMPT_EOF

PROMPT=$(cat /tmp/opencode-review-prompt.txt)
export NVM_DIR="$HOME/.nvm" && [ -s "$NVM_DIR/nvm.sh" ] && . "$NVM_DIR/nvm.sh" && nvm use v22.22.0 > /dev/null 2>&1 && cd /home/dmahaffey/projects/colophony && opencode run -f /tmp/opencode-review-diff.txt "$PROMPT"
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

Save the diff:

```bash
git diff --cached > /tmp/opencode-review-diff.txt
# If empty, use unstaged:
[ ! -s /tmp/opencode-review-diff.txt ] && git diff > /tmp/opencode-review-diff.txt
```

Then run with the same review prompt as branch review, but adjust the intro line to say "staged/unstaged changes" instead of "branch changes vs origin/main". Attach the diff file with `-f`.

**For plan review:**

Find the most recent plan file:

```bash
ls -t ~/.claude/plans/*.md 2>/dev/null | head -1
```

If no plan file exists, tell the user and exit.

Then run:

```bash
cat > /tmp/opencode-review-prompt.txt << 'PROMPT_EOF'
Review the plan file at: [path to plan file]
Read the plan file, then explore the codebase to verify the plan's assumptions.
Check that referenced files exist, patterns match reality, and the approach is sound.

<project rules from Step 3>
PROMPT_EOF

PROMPT=$(cat /tmp/opencode-review-prompt.txt)
export NVM_DIR="$HOME/.nvm" && [ -s "$NVM_DIR/nvm.sh" ] && . "$NVM_DIR/nvm.sh" && nvm use v22.22.0 > /dev/null 2>&1 && cd /home/dmahaffey/projects/colophony && opencode run -f [plan-file-path] "$PROMPT"
```

**Important:** Run the opencode command in the background using the Bash tool's `run_in_background` parameter. Set a timeout of 300000ms (5 minutes). Tell the user the review is running and check back on it periodically.

### Step 5: Present output

When the command completes, present the review to the user with clear formatting:

```
## OpenCode Review Results

[review output]
```

Then ask the user which findings (if any) they want to address:

```
Which findings would you like me to address? (Enter numbers, "all", or "none")
```

## Important notes

- `opencode run` is the non-interactive execution mode — it runs a single prompt and exits
- Use `-f <file>` to attach files (diffs, plan files) as context for the review
- Always uses `origin/main` (fetched) for branch diffs to avoid stale comparisons
- nvm must be sourced explicitly in every command because Bash tool runs non-interactive shells
- **Branch reviews include plan drift detection** when a plan file exists in `~/.claude/plans/`. Acknowledged overrides in the PR's `## Plan Overrides` section are excluded from drift findings
- **Plan reviews run automatically during plan mode**: Per CLAUDE.md, non-trivial plans must run `/opencode-review plan` before presenting to the user for approval
- OpenCode reads project instructions from `.opencode/instructions.md` if present — these supplement the inline prompt
- The `--model` flag can override the default model if needed (e.g., `opencode run -m anthropic/claude-sonnet-4-5-20250514`)
