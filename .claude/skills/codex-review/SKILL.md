---
name: codex-review
description: Run Codex code review in a tmux session (plan, diff, branch; default branch).
---

# /codex-review

Run a local code review via Codex CLI in a tmux session.

## What this skill does

1. Verifies prerequisites (tmux, nvm, node, codex)
2. Manages a dedicated `codex-review` tmux session (lazy-init, context isolation between reviews)
3. Sends a review prompt to Codex with project rules and sentinel detection
4. Polls for completion and captures output
5. Presents findings structured by severity

## Usage

```
/codex-review              # Review all changes on current branch vs origin/main (default)
/codex-review branch       # Same as above
/codex-review diff         # Review staged changes (falls back to unstaged if nothing staged)
/codex-review plan         # Review the current plan file
```

## Instructions for Claude

When the user invokes `/codex-review`, perform these steps in order:

### Step 1: Preflight checks

Run these checks before anything else:

```bash
command -v tmux
```

```bash
export NVM_DIR="$HOME/.nvm" && [ -s "$NVM_DIR/nvm.sh" ] && . "$NVM_DIR/nvm.sh" && nvm use v20.20.0 > /dev/null 2>&1 && command -v codex
```

If tmux is not installed, print:

```
tmux is not installed. Install it with: sudo apt install tmux
```

If nvm/node/codex are not available, print:

```
Codex CLI not found. Ensure nvm is installed, node v20.20.0 is available, and codex is installed globally:
  nvm install v20.20.0
  npm install -g @openai/codex
```

If any check fails, stop here — do not proceed.

### Step 2: Determine review type

Parse the argument (if any) from the skill invocation:

- No argument or `branch` → **branch review** (all changes on current branch vs `origin/main`)
- `diff` → **diff review** (staged changes; fall back to unstaged if nothing is staged)
- `plan` → **plan review** (review the current plan file)

For branch review, fetch the latest main first:

```bash
git fetch origin main
```

For diff review, check if there are staged changes:

```bash
git diff --cached --stat
```

If nothing is staged, fall back to unstaged:

```bash
git diff --stat
```

If there are no changes at all, tell the user and exit.

For plan review, find the most recent plan file:

```bash
ls -t ~/.claude/plans/*.md 2>/dev/null | head -1
```

If no plan file exists, tell the user and exit.

### Step 3: Manage tmux session

Check if the `codex-review` session already exists:

```bash
tmux has-session -t codex-review 2>/dev/null
```

**If the session does NOT exist**, create it and launch Codex:

```bash
tmux new-session -d -s codex-review -x 200 -y 50
```

Then send the nvm + Codex launch command:

```bash
tmux send-keys -t codex-review 'export NVM_DIR="$HOME/.nvm" && [ -s "$NVM_DIR/nvm.sh" ] && . "$NVM_DIR/nvm.sh" && nvm use v20.20.0 > /dev/null 2>&1 && cd /home/dmahaffey/projects/prospector && codex' Enter
```

**If the session DOES exist**, kill the old Codex process and relaunch for fresh context:

```bash
tmux send-keys -t codex-review C-c
```

Wait 2 seconds, then:

```bash
tmux send-keys -t codex-review 'export NVM_DIR="$HOME/.nvm" && [ -s "$NVM_DIR/nvm.sh" ] && . "$NVM_DIR/nvm.sh" && nvm use v20.20.0 > /dev/null 2>&1 && cd /home/dmahaffey/projects/prospector && codex' Enter
```

**Wait for Codex to be ready** — poll every 3 seconds for up to 30 seconds, checking for the Codex interactive prompt:

```bash
tmux capture-pane -t codex-review -p -S -50
```

Look for the `>` prompt character or "Codex" in the output indicating Codex is ready to accept input.

### Step 4: Build and send the review prompt

Construct the review prompt based on review type. The prompt has four parts:

**Part 1 — Preamble** (same for all review types):

```
You are reviewing code in the Colophony project at /home/dmahaffey/projects/prospector.

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

**Part 2 — Task** (varies by review type):

For **branch** review:

```
Review all changes on the current branch compared to origin/main.
Run: git fetch origin main && git diff origin/main...HEAD
Also run: git log origin/main...HEAD --oneline
to understand the commit history. Then read any files you need for full context.
```

For **diff** review:

```
Review the currently staged changes (or unstaged if nothing is staged).
Run: git diff --cached
(If empty, run: git diff)
Read any surrounding files you need for context.
```

For **plan** review:

```
Review the plan file at: [path to plan file]
Read the plan file, then explore the codebase to verify the plan's assumptions.
Check that referenced files exist, patterns match reality, and the approach is sound.
```

**Part 3 — Sentinel**:

```
When you are completely finished with your review, print the exact line: __CODEX_REVIEW_DONE__
```

Send the complete prompt to Codex:

```bash
tmux send-keys -t codex-review '<full prompt text>' Enter
```

**Important:** The prompt must be sent as a single `send-keys` command. If it's very long, use `tmux load-buffer` + `tmux paste-buffer` instead:

```bash
# Write prompt to temp file
cat > /tmp/codex-review-prompt.txt << 'PROMPT_EOF'
<full prompt text>
PROMPT_EOF

tmux load-buffer /tmp/codex-review-prompt.txt
tmux paste-buffer -t codex-review
tmux send-keys -t codex-review '' Enter
```

### Step 5: Poll for completion

Wait 10 seconds initially, then poll every 5 seconds:

```bash
sleep 10
```

Then in a loop (up to 180 seconds total):

```bash
tmux capture-pane -t codex-review -p -S -200
```

Check the captured output for:

1. **Primary signal**: Output contains `__CODEX_REVIEW_DONE__`
2. **Fallback signal**: Output contains `Token usage:` followed by a shell prompt (e.g., `$` at start of line)

If either signal is detected, proceed to Step 6.

If 180 seconds pass without completion:

```
Review is still running. You can check progress with:
  tmux attach -t codex-review

Partial output captured — see below.
```

Then proceed to Step 6 with whatever output is available.

### Step 6: Capture and present output

Capture the full scrollback:

```bash
tmux capture-pane -t codex-review -p -S -500
```

Parse the output:

- Find the review content between the prompt echo and the sentinel (`__CODEX_REVIEW_DONE__`) or `Token usage:` line
- Strip the prompt echo and sentinel from the output
- If the output contains a verdict line (LGTM, Minor issues, Issues found), use it as the header

Present the review to the user with clear formatting:

```
## Codex Review Results

[parsed review content]
```

Then ask the user which findings (if any) they want to address:

```
Which findings would you like me to address? (Enter numbers, "all", or "none")
```

## Important notes

- The tmux session is named `codex-review` to avoid conflicts with user sessions
- Codex is killed and relaunched between reviews for context isolation
- Always use `origin/main` (not local `main`) for branch diffs to avoid stale comparisons
- The sentinel `__CODEX_REVIEW_DONE__` is critical for reliable idle detection
- If tmux send-keys has issues with special characters in the prompt, use the load-buffer approach
- The review prompt tells Codex to explore the codebase itself — do NOT paste large diffs into the prompt
- nvm must be sourced explicitly because tmux runs non-interactive shells
