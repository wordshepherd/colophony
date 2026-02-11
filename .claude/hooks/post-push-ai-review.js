#!/usr/bin/env node

/**
 * PostToolUse hook for Bash commands.
 * After a `git push` to a feature branch, reminds to check for AI review
 * comments once CI passes and the AI review workflow runs.
 *
 * Does NOT block — just outputs a reminder message.
 */

const command = process.env.CLAUDE_TOOL_ARGS_command || "";

// Only check git push commands
if (!command.includes("git push")) {
  process.exit(0);
}

// Don't remind if pushing to main (that's blocked by pre-push-branch.js anyway)
const pushToMainPattern = /git push\b.*(?:\s|:)(main|master)(?:\s|$)/;
if (pushToMainPattern.test(command)) {
  process.exit(0);
}

// Output a reminder (non-blocking)
const result = {
  decision: "approve",
  reason:
    "Reminder: After CI passes, the AI reviewer will post comments on the PR.\n" +
    "Use `/check-ai-review` to fetch, evaluate, and address AI review findings.",
};
console.log(JSON.stringify(result));
process.exit(0);
