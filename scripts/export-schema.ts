#!/usr/bin/env tsx
/**
 * Export the GraphQL SDL schema from the Pothos builder.
 *
 * Usage:
 *   pnpm sdk:export-schema
 *   npx tsx scripts/export-schema.ts
 *
 * Output: sdks/schema.graphql
 */

import { writeFileSync, mkdirSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { printSchema } from "graphql";
import { schema } from "../apps/api/src/graphql/schema.js";

const sdl = printSchema(schema);

const outPath = resolve(
  dirname(new URL(import.meta.url).pathname),
  "../sdks/schema.graphql",
);
mkdirSync(dirname(outPath), { recursive: true });
writeFileSync(outPath, sdl + "\n");
console.log(`GraphQL schema written to ${outPath}`);
