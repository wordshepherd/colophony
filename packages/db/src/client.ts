import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import * as schema from "./schema/index";

/**
 * Admin pool — superuser connection for migrations, seed, and admin operations.
 * Uses DATABASE_URL (typically the superuser role).
 */
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: parseInt(process.env.DB_POOL_MAX || "10", 10),
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
});

/**
 * Application pool — non-superuser connection for RLS-enforced queries.
 * Uses DATABASE_APP_URL (app_user role, NOSUPERUSER NOBYPASSRLS).
 * Falls back to DATABASE_URL for backwards compatibility in dev.
 */
const appPool = new Pool({
  connectionString: process.env.DATABASE_APP_URL || process.env.DATABASE_URL,
  max: parseInt(process.env.DB_POOL_MAX || "10", 10),
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
});

export const db = drizzle(pool, { schema });
export { pool, appPool };
