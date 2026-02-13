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
export NVM_DIR="$HOME/.nvm" && [ -s "$NVM_DIR/nvm.sh" ] && . "$NVM_DIR/nvm.sh" && nvm use v20.20.0 > /dev/null 2>&1 && command -v codex
```

If nvm/node/codex are not available, print:

```
Codex CLI not found. Ensure nvm is installed, node v20.20.0 is available, and codex is installed globally:
  nvm install v20.20.0
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

Format your review as markdown:
- Start with a one-line verdict: LGTM, Minor issues, or Issues found
- Group findings by severity: Critical, Important, Suggestions
- Reference specific file paths and line numbers (file:line format)
- Be concise — skip formatting nits (handled by linters)
```

### Step 4: Run the review

**For branch review:**

```bash
git fetch origin main

export NVM_DIR="$HOME/.nvm" && [ -s "$NVM_DIR/nvm.sh" ] && . "$NVM_DIR/nvm.sh" && nvm use v20.20.0 > /dev/null 2>&1 && cd /home/dmahaffey/projects/prospector && codex review --base origin/main
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
export NVM_DIR="$HOME/.nvm" && [ -s "$NVM_DIR/nvm.sh" ] && . "$NVM_DIR/nvm.sh" && nvm use v20.20.0 > /dev/null 2>&1 && cd /home/dmahaffey/projects/prospector && codex review --uncommitted
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

export NVM_DIR="$HOME/.nvm" && [ -s "$NVM_DIR/nvm.sh" ] && . "$NVM_DIR/nvm.sh" && nvm use v20.20.0 > /dev/null 2>&1 && cd /home/dmahaffey/projects/prospector && codex exec -s read-only - < /tmp/codex-review-prompt.txt
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
