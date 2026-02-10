#!/usr/bin/env node

/**
 * PostToolUse hook for Bash commands.
 * After a git commit, reminds to update docs/DEVLOG.md if it wasn't part of the commit.
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

  if (!lastCommitFiles.includes('DEVLOG.md')) {
    console.warn('📝 REMINDER: Update docs/DEVLOG.md with what was done in this session.');
    console.warn('   Format: ## YYYY-MM-DD — [Session Focus]');
    console.warn('   Sections: ### Done / ### Decisions / ### Next / ### Issues Found (optional)');
  }
} catch {
  // Silently ignore if git command fails (e.g., no commits yet)
}

process.exit(0);
