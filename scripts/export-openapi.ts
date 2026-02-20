#!/usr/bin/env tsx
/**
 * Export the OpenAPI 3.1 specification from the running API server.
 *
 * Requires the dev server to be running (`pnpm dev`).
 *
 * Usage:
 *   pnpm sdk:export-spec
 *   npx tsx scripts/export-openapi.ts [base-url]
 *
 * Output: sdks/openapi.json
 */

import { writeFileSync, mkdirSync } from "node:fs";
import { resolve, dirname } from "node:path";

const baseUrl = process.argv[2] ?? "http://localhost:4000";

async function main() {
  const url = `${baseUrl}/v1/openapi.json`;
  console.log(`Fetching OpenAPI spec from ${url}...`);

  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(
      `Failed to fetch OpenAPI spec: ${res.status} ${res.statusText}`,
    );
  }

  const spec = (await res.json()) as Record<string, unknown>;

  const outPath = resolve(
    dirname(new URL(import.meta.url).pathname),
    "../sdks/openapi.json",
  );
  mkdirSync(dirname(outPath), { recursive: true });
  writeFileSync(outPath, JSON.stringify(spec, null, 2) + "\n");
  console.log(`OpenAPI spec written to ${outPath}`);
}

main().catch((err) => {
  console.error(
    "Error: Could not fetch OpenAPI spec. Is the dev server running? (pnpm dev)",
  );
  console.error(err.message);
  process.exit(1);
});
