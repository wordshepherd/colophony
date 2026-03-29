#!/usr/bin/env node

/**
 * Post-edit hook for test files.
 * Reminds to update docs/testing.md if test counts, tiers, or running instructions changed.
 */

const filePath = process.env.CLAUDE_TOOL_ARGS_file_path || '';
const isTestFile = /\.(spec|test)\.(ts|tsx)$/.test(filePath) || filePath.includes('/e2e/');
if (!isTestFile) process.exit(0);

console.log('⚠️ Test file modified. If test counts, tiers, or running instructions changed, update docs/testing.md');
