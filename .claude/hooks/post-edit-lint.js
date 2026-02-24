#!/usr/bin/env node

/**
 * Post-edit hook: lint the edited file and warn on new warnings/errors.
 *
 * Runs eslint on the specific file that was just edited. Fast (~1-2s) compared
 * to full `pnpm lint`. Catches issues as they're introduced rather than at
 * commit/push time.
 *
 * Exit code is always 0 (advisory, never blocks). Warnings are surfaced to
 * Claude Code so they can be fixed immediately.
 */

const { execSync } = require("child_process");
const path = require("path");

const filePath = process.env.CLAUDE_TOOL_ARGS_file_path || "";
const cwd = process.env.CLAUDE_WORKING_DIRECTORY || process.cwd();

if (!filePath) {
  process.exit(0);
}

// Resolve absolute path
const absPath = path.isAbsolute(filePath)
  ? filePath
  : path.resolve(cwd, filePath);

// Determine which package owns this file to find the right eslint config
const appsApi = path.join(cwd, "apps", "api");
const appsWeb = path.join(cwd, "apps", "web");

let eslintCwd;
if (absPath.startsWith(appsApi)) {
  eslintCwd = appsApi;
} else if (absPath.startsWith(appsWeb)) {
  eslintCwd = appsWeb;
} else {
  // File is in packages/ or root — no eslint config, skip
  process.exit(0);
}

try {
  // Run eslint on just this file. --no-error-on-unmatched-pattern avoids
  // failures when the file doesn't match eslint's include patterns.
  const result = execSync(
    `npx eslint --no-error-on-unmatched-pattern --format compact "${absPath}"`,
    {
      cwd: eslintCwd,
      encoding: "utf-8",
      timeout: 15000,
      stdio: ["pipe", "pipe", "pipe"],
    },
  );

  // eslint exits 0 with no output when clean
  if (result.trim()) {
    // Has output but exit 0 — informational only, shouldn't happen with compact format
    process.exit(0);
  }
} catch (err) {
  // eslint exits 1 on warnings/errors
  const output = (err.stdout || "").trim();
  const stderr = (err.stderr || "").trim();

  if (!output && !stderr) {
    // eslint failed for a non-lint reason (config error, etc.) — don't block
    process.exit(0);
  }

  // Count warnings and errors from compact format
  // Compact format: /path/file.ts: line X, col Y, Warning/Error - message (rule)
  const lines = output.split("\n").filter((l) => l.includes(": line "));
  const errorCount = lines.filter((l) => l.includes("Error -")).length;
  const warningCount = lines.filter((l) => l.includes("Warning -")).length;

  if (errorCount > 0 || warningCount > 0) {
    const relPath = path.relative(cwd, absPath);
    const parts = [];
    if (errorCount > 0) parts.push(`${errorCount} error${errorCount > 1 ? "s" : ""}`);
    if (warningCount > 0) parts.push(`${warningCount} warning${warningCount > 1 ? "s" : ""}`);

    console.warn(`\n⚠️  LINT: ${relPath} has ${parts.join(" and ")}`);

    // Show the actual issues (compact format is already concise)
    for (const line of lines) {
      // Extract just the relevant part after the filename
      const match = line.match(/: line (\d+).*?(?:Warning|Error) - (.+)/);
      if (match) {
        const type = line.includes("Error -") ? "❌" : "⚠️";
        console.warn(`   ${type}  Line ${match[1]}: ${match[2]}`);
      }
    }

    console.warn("   Fix these before committing — do not defer lint issues.");
  }
}

process.exit(0);
