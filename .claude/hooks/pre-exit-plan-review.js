#!/usr/bin/env node

/**
 * PreToolUse hook for ExitPlanMode.
 * Blocks ExitPlanMode unless a codex plan review has been completed (marker file)
 * or the plan is trivial (< 10 content lines or explicit TRIVIAL marker).
 *
 * Enforces CLAUDE.md "Plan Review: Codex Integration":
 *   1. Write the plan → 2. Run /codex-review plan → 3. Adjust → 4. Present to user
 */

const fs = require('fs');
const path = require('path');
const os = require('os');

const MARKER_FILE = path.join(os.tmpdir(), '.colophony-plan-reviewed');
const PLANS_DIR = path.join(os.homedir(), '.claude', 'plans');
const TRIVIAL_LINE_THRESHOLD = 10;
const MARKER_MAX_AGE_MS = 2 * 60 * 60 * 1000; // 2 hours

function findMostRecentPlan() {
  try {
    const files = fs.readdirSync(PLANS_DIR)
      .filter(f => f.endsWith('.md'))
      .map(f => {
        const fullPath = path.join(PLANS_DIR, f);
        return { path: fullPath, mtime: fs.statSync(fullPath).mtimeMs };
      })
      .sort((a, b) => b.mtime - a.mtime);
    return files.length > 0 ? files[0] : null;
  } catch {
    return null;
  }
}

function isPlanTrivial(planPath) {
  try {
    const content = fs.readFileSync(planPath, 'utf-8');

    // Explicit TRIVIAL marker on first line
    if (content.trimStart().startsWith('TRIVIAL')) {
      return true;
    }

    // Strip frontmatter (--- ... ---)
    let body = content;
    const frontmatterMatch = content.match(/^---\n[\s\S]*?\n---\n/);
    if (frontmatterMatch) {
      body = content.slice(frontmatterMatch[0].length);
    }

    // Count non-empty lines
    const contentLines = body.split('\n').filter(line => line.trim().length > 0);
    return contentLines.length < TRIVIAL_LINE_THRESHOLD;
  } catch {
    // If we can't read the plan, don't block
    return true;
  }
}

function isMarkerValid() {
  try {
    const stat = fs.statSync(MARKER_FILE);
    const age = Date.now() - stat.mtimeMs;
    return age < MARKER_MAX_AGE_MS;
  } catch {
    return false;
  }
}

function cleanupMarker() {
  try {
    fs.unlinkSync(MARKER_FILE);
  } catch {
    // Ignore — already gone or never existed
  }
}

// Main logic
const plan = findMostRecentPlan();

// No plan file → allow (nothing to review)
if (!plan) {
  process.exit(0);
}

// Trivial plan → allow
if (isPlanTrivial(plan.path)) {
  cleanupMarker();
  process.exit(0);
}

// Check for review marker
if (isMarkerValid()) {
  cleanupMarker();
  process.exit(0);
}

// Block — plan review not done
const result = {
  decision: 'block',
  reason:
    'Run /codex-review plan before exiting plan mode.\n\n' +
    'Per CLAUDE.md "Plan Review: Codex Integration", every non-trivial plan\n' +
    'must be reviewed before presenting to the user.\n\n' +
    'Run /codex-review plan now, then retry ExitPlanMode.\n\n' +
    'Skip exception: If this plan is truly trivial (typo fix, single config\n' +
    'change, doc-only update), add "TRIVIAL" to the plan file\'s first line.',
};
console.log(JSON.stringify(result));
process.exit(0);
