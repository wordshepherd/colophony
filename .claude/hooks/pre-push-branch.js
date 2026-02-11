#!/usr/bin/env node

/**
 * PreToolUse hook for Bash commands.
 * Blocks `git push` directly to main/master. Reminds to use a feature branch + PR.
 *
 * This enforces the project's protected-branch workflow:
 *   1. Create feature branch (feat/, fix/, chore/, test/, docs/, refactor/)
 *   2. Push feature branch
 *   3. Open PR via `gh pr create`
 */

const command = process.env.CLAUDE_TOOL_ARGS_command || '';

// Only check git push commands
if (!command.includes('git push')) {
  process.exit(0);
}

// Detect pushing directly to main or master
// Matches: git push origin main, git push -u origin main, git push origin HEAD:main, etc.
// Uses end-of-string or whitespace anchor to avoid matching branch names like fix/master-data
const pushToMainPattern = /git push\b.*(?:\s|:)(main|master)(?:\s|$)/;

if (pushToMainPattern.test(command)) {
  // Output JSON to block the action
  const result = {
    decision: "block",
    reason: "Cannot push directly to main — it is a protected branch.\n" +
      "Use a feature branch + PR instead:\n" +
      "  1. git checkout -b feat/<topic>  (or fix/, chore/, test/, docs/, refactor/)\n" +
      "  2. git push -u origin <branch>\n" +
      "  3. gh pr create --title '...' --body '...'"
  };
  console.log(JSON.stringify(result));
  process.exit(0);
}

process.exit(0);
