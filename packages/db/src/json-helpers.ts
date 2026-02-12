import { sql, type SQL } from "drizzle-orm";
import type { PgColumn } from "drizzle-orm/pg-core";

/**
 * JSONB containment operator: column @> value
 * Checks if JSONB column contains the given value.
 * Works with jsonb_path_ops GIN indexes.
 */
export function jsonbContains(column: PgColumn, value: unknown): SQL {
  return sql`${column} @> ${JSON.stringify(value)}::jsonb`;
}

/**
 * JSONB path access: column -> key
 * Returns JSONB element at the given key.
 */
export function jsonbGet(column: PgColumn, key: string): SQL {
  return sql`${column} -> ${key}`;
}

/**
 * JSONB path access (text): column ->> key
 * Returns text value at the given key.
 */
export function jsonbGetText(column: PgColumn, key: string): SQL {
  return sql`${column} ->> ${key}`;
}

/**
 * Validate and sanitize JSONB path segments.
 * Only allows alphanumeric characters, underscores, and hyphens.
 */
function sanitizePath(path: string[]): string {
  const valid = /^[a-zA-Z0-9_-]+$/;
  for (const segment of path) {
    if (!valid.test(segment)) {
      throw new Error(
        `Invalid JSONB path segment: "${segment}". Only alphanumeric, underscore, and hyphen characters are allowed.`,
      );
    }
  }
  return path.join(",");
}

/**
 * JSONB nested path access: column #> '{path, to, value}'
 * Returns JSONB element at the given path.
 */
export function jsonbGetPath(column: PgColumn, path: string[]): SQL {
  const pathStr = sanitizePath(path);
  return sql`${column} #> ${`{${pathStr}}`}`;
}

/**
 * JSONB nested path access (text): column #>> '{path, to, value}'
 * Returns text value at the given path.
 */
export function jsonbGetPathText(column: PgColumn, path: string[]): SQL {
  const pathStr = sanitizePath(path);
  return sql`${column} #>> ${`{${pathStr}}`}`;
}
