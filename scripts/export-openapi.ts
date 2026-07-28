#!/usr/bin/env tsx
/**
 * Export the OpenAPI 3.1 specification from the oRPC router definitions.
 *
 * Builds the document in-process — no running server, database, or Redis
 * required — so this can run in CI. The `sdk-check` job uses `--check` to fail
 * the build when the committed spec no longer matches the routers.
 *
 * Usage:
 *   pnpm sdk:export-spec            # write sdks/openapi.json
 *   pnpm sdk:check-spec             # verify it matches, exit 1 on drift
 *   npx tsx scripts/export-openapi.ts [--check]
 *
 * Output: sdks/openapi.json
 */

import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { format, resolveConfig } from "prettier";
import { generateOpenApiDocument } from "../apps/api/src/rest/openapi-spec.js";

const HELP = `Export the OpenAPI 3.1 spec from the oRPC routers.

Usage:
  tsx scripts/export-openapi.ts            Write sdks/openapi.json
  tsx scripts/export-openapi.ts --check    Compare against the committed spec;
                                           exit 1 if they differ. Writes nothing.
  tsx scripts/export-openapi.ts --help     Show this message.
`;

const OUT_PATH = resolve(
  dirname(new URL(import.meta.url).pathname),
  "../sdks/openapi.json",
);

type Spec = Record<string, unknown>;
type PathsObject = Record<string, Record<string, unknown>>;

/**
 * Serialize exactly as the committed file is stored, so --check is a byte
 * comparison.
 *
 * `sdks/openapi.json` is not in `.prettierignore` (unlike `sdks/typescript/`
 * and `sdks/python/`), so the pre-commit hook formats it. Writing raw
 * `JSON.stringify` output would leave the working tree dirty after every
 * export and make --check fail in CI against the formatted committed file.
 */
async function serialize(spec: Spec): Promise<string> {
  const config = await resolveConfig(OUT_PATH);
  return format(JSON.stringify(spec, null, 2), {
    ...config,
    filepath: OUT_PATH,
    parser: "json",
  });
}

function paths(spec: Spec): PathsObject {
  return (spec.paths ?? {}) as PathsObject;
}

/** "GET /organizations/{id}" for every operation, as a stable identity set. */
function operations(spec: Spec): Set<string> {
  const ops = new Set<string>();
  for (const [path, methods] of Object.entries(paths(spec))) {
    for (const method of Object.keys(methods)) {
      ops.add(`${method.toUpperCase()} ${path}`);
    }
  }
  return ops;
}

function counts(spec: Spec): string {
  const p = Object.keys(paths(spec)).length;
  return `${p} paths, ${operations(spec).size} operations`;
}

function reportDrift(generated: Spec, committed: Spec): void {
  console.error("Error: sdks/openapi.json does not match the routers.\n");
  console.error(`  committed: ${counts(committed)}`);
  console.error(`  source:    ${counts(generated)}\n`);

  const before = operations(committed);
  const after = operations(generated);
  const added = [...after].filter((o) => !before.has(o)).sort();
  const removed = [...before].filter((o) => !after.has(o)).sort();

  for (const op of added) console.error(`  + ${op}`);
  for (const op of removed) console.error(`  - ${op}`);

  if (added.length === 0 && removed.length === 0) {
    console.error(
      "  (no operations added or removed — the difference is in schemas or metadata)",
    );
  }

  console.error("\nRun 'pnpm sdk:export-spec' and commit the result.");
}

async function main() {
  const args = process.argv.slice(2);

  if (args.includes("--help") || args.includes("-h")) {
    console.log(HELP);
    return;
  }

  const check = args.includes("--check");
  const spec = await generateOpenApiDocument();
  const serialized = await serialize(spec);

  if (!check) {
    mkdirSync(dirname(OUT_PATH), { recursive: true });
    writeFileSync(OUT_PATH, serialized);
    console.log(`OpenAPI spec written to ${OUT_PATH} (${counts(spec)})`);
    return;
  }

  if (!existsSync(OUT_PATH)) {
    console.error(
      `Error: ${OUT_PATH} does not exist. Run 'pnpm sdk:export-spec' first.`,
    );
    process.exit(1);
  }

  const committedRaw = readFileSync(OUT_PATH, "utf8");
  if (committedRaw === serialized) {
    console.log(`OpenAPI spec is up to date (${counts(spec)}).`);
    return;
  }

  reportDrift(spec, JSON.parse(committedRaw) as Spec);
  process.exit(1);
}

main().catch((err: unknown) => {
  console.error("Error: failed to generate the OpenAPI spec.");
  console.error(err);
  process.exit(1);
});
