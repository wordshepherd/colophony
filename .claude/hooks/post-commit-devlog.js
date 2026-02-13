#!/usr/bin/env node

/**
 * PostToolUse hook for Bash commands.
 * After a git commit, reminds to update the current month's devlog if it wasn't part of the commit.
 */

const fs = require('fs');
const { execSync } = require('child_process');

const command = process.env.CLAUDE_TOOL_ARGS_command || '';

// Only trigger on git commit commands (not amend, not just `git add`)
if (!command.includes('git commit') || command.includes('--amend')) {
  process.exit(0);
}

try {
  // Check if DEVLOG.md was included in the most recent commit
  const lastCommitFiles = execSync('git diff-tree --no-commit-id --name-only -r HEAD', {
    encoding: 'utf-8',
    cwd: process.env.CLAUDE_WORKING_DIRECTORY || process.cwd(),
  });

  if (!lastCommitFiles.includes('devlog/')) {
    const now = new Date();
    const month = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    console.warn(`📝 REMINDER: Update docs/devlog/${month}.md with what was done in this session.`);
    console.warn('   Format: ## YYYY-MM-DD — [Session Focus]');
    console.warn('   Sections: ### Done / ### Decisions / ### Next / ### Issues Found (optional)');
  }
} catch {
  // Silently ignore if git command fails (e.g., no commits yet)
}

process.exit(0);
