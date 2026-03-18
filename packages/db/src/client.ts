import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import * as schema from "./schema/index";
import { buildSslConfig } from "./ssl.js";

const ssl = buildSslConfig();

/**
 * Admin pool — superuser connection for migrations, seed, and admin operations.
 * Uses DATABASE_URL (typically the superuser role).
 */
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: parseInt(process.env.DB_ADMIN_POOL_MAX || "5", 10),
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
  ssl,
});

/**
 * Application pool — non-superuser connection for RLS-enforced queries.
 * Uses DATABASE_APP_URL (app_user role, NOSUPERUSER NOBYPASSRLS).
 * Falls back to DATABASE_URL for backwards compatibility in dev.
 */
if (!process.env.DATABASE_APP_URL && process.env.NODE_ENV !== "test") {
  console.warn(
    "[SECURITY WARNING] DATABASE_APP_URL is not set — appPool is using DATABASE_URL (superuser). " +
      "RLS policies will be bypassed. Set DATABASE_APP_URL to a non-superuser connection string.",
  );
}

const appPool = new Pool({
  connectionString: process.env.DATABASE_APP_URL || process.env.DATABASE_URL,
  max: parseInt(process.env.DB_APP_POOL_MAX || "20", 10),
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
  ssl,
});

export const db = drizzle(pool, { schema });
export { pool, appPool };
