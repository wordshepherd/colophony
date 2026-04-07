#!/usr/bin/env node

/**
 * PreToolUse hook for Bash commands.
 * Before creating a PR, ensures the current branch is rebased on latest origin/main.
 * Prevents merge conflicts from stale branches.
 */

const { execSync } = require('child_process');

const command = process.env.CLAUDE_TOOL_ARGS_command || '';

// Only check gh pr create commands
if (!command.includes('gh pr create')) {
  process.exit(0);
}

try {
  // Fetch latest main
  execSync('git fetch origin main', { stdio: 'pipe' });

  // Check if current branch is up to date with origin/main
  const behindCount = execSync('git rev-list --count HEAD..origin/main', {
    encoding: 'utf-8',
  }).trim();

  if (behindCount !== '0') {
    const currentBranch = execSync('git branch --show-current', {
      encoding: 'utf-8',
    }).trim();

    console.error(
      JSON.stringify({
        decision: 'block',
        reason: `Branch "${currentBranch}" is ${behindCount} commit(s) behind origin/main. Rebase first to avoid merge conflicts:\n\n  git fetch origin main && git rebase origin/main\n\nThen push and retry the PR.`,
      })
    );
    process.exit(0);
  }

  // Check for merge conflicts with main
  const mergeBase = execSync('git merge-base HEAD origin/main', {
    encoding: 'utf-8',
  }).trim();
  const mainHead = execSync('git rev-parse origin/main', {
    encoding: 'utf-8',
  }).trim();

  if (mergeBase !== mainHead) {
    console.error(
      JSON.stringify({
        decision: 'block',
        reason:
          'Branch has diverged from origin/main. Rebase first:\n\n  git fetch origin main && git rebase origin/main',
      })
    );
    process.exit(0);
  }
} catch (err) {
  // Don't block on hook errors (e.g., no network for fetch)
  console.error(
    JSON.stringify({
      decision: 'warn',
      reason: `Pre-PR rebase check failed: ${err.message}. Proceeding anyway.`,
    })
  );
}
