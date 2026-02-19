// Schema — tables, enums, relations
export * from "./schema/index";

// Client
export { db, pool, appPool } from "./client";

// RLS context helper
export { withRls, type DrizzleDb } from "./context";

// Type aliases
export * from "./types";

// JSONB helpers
export {
  jsonbContains,
  jsonbGet,
  jsonbGetText,
  jsonbGetPath,
  jsonbGetPathText,
} from "./json-helpers";

// Re-export commonly used drizzle-orm utilities
export {
  eq,
  ne,
  gt,
  gte,
  lt,
  lte,
  and,
  or,
  not,
  isNull,
  sql,
} from "drizzle-orm";
