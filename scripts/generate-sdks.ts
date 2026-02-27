#!/usr/bin/env tsx
/**
 * Regenerate TypeScript and Python SDKs from the committed OpenAPI spec.
 *
 * Prerequisites:
 *   - sdks/openapi.json must exist (run `pnpm sdk:export-spec` first)
 *   - Node.js (for TypeScript generation)
 *   - Python 3 + openapi-python-client (for Python generation)
 *
 * Usage:
 *   pnpm sdk:generate
 *   npx tsx scripts/generate-sdks.ts
 */

import { execSync } from "node:child_process";
import { existsSync } from "node:fs";
import { resolve, dirname } from "node:path";

const ROOT = resolve(dirname(new URL(import.meta.url).pathname), "..");
const SPEC = resolve(ROOT, "sdks/openapi.json");
const TS_DIR = resolve(ROOT, "sdks/typescript");
const PY_DIR = resolve(ROOT, "sdks/python");

function run(cmd: string, cwd: string) {
  console.log(`  $ ${cmd}`);
  execSync(cmd, { cwd, stdio: "inherit" });
}

function checkPrerequisites() {
  if (!existsSync(SPEC)) {
    console.error(
      `Error: ${SPEC} not found. Run "pnpm sdk:export-spec" first (requires dev server).`,
    );
    process.exit(1);
  }
}

function generateTypeScript() {
  console.log("\n=== TypeScript SDK ===\n");

  if (!existsSync(resolve(TS_DIR, "node_modules"))) {
    console.log("Installing dependencies...");
    run("npm install", TS_DIR);
  }

  console.log("Generating types from OpenAPI spec...");
  run(
    "npx openapi-typescript ../openapi.json -o src/generated/openapi.ts",
    TS_DIR,
  );

  console.log("Building...");
  run("npx tsc -p tsconfig.build.json", TS_DIR);

  console.log("TypeScript SDK generated successfully.");
}

function generatePython() {
  console.log("\n=== Python SDK ===\n");

  // Check for openapi-python-client
  try {
    execSync("openapi-python-client --version", { stdio: "pipe" });
  } catch {
    console.warn(
      "Warning: openapi-python-client not found in PATH. Skipping Python SDK generation.",
    );
    console.warn("  Install: pip install openapi-python-client");
    return;
  }

  // Remove existing generated code (keep config and .gitignore)
  const generatedDir = resolve(PY_DIR, "colophony");
  if (existsSync(generatedDir)) {
    run("rm -rf colophony pyproject.toml README.md", PY_DIR);
  }

  console.log("Generating Python SDK from OpenAPI spec...");
  run(
    `openapi-python-client generate --path ../openapi.json --config openapi-python-client.yaml --output-path .generated`,
    PY_DIR,
  );

  // Move generated files to the right place
  run(
    "mv .generated/colophony .generated/pyproject.toml .generated/README.md .generated/.gitignore . 2>/dev/null; rm -rf .generated",
    PY_DIR,
  );

  console.log("Python SDK generated successfully.");
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

checkPrerequisites();
generateTypeScript();
generatePython();

console.log("\nDone. Both SDKs regenerated from sdks/openapi.json.");
