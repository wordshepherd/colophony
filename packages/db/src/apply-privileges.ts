/**
 * Apply the canonical app_user privilege manifest.
 *
 * Runs after `drizzle-kit migrate` so that a bare `pnpm db:migrate` leaves a
 * correct database. The blanket `GRANT ... ON ALL TABLES` that every
 * provisioning path issues is additive and silently reverses the REVOKEs in the
 * migrations, so the manifest has to be applied last. See privileges.sql.
 *
 * Deliberately uses the `pg` driver rather than shelling out to `psql`: this
 * runs in ten CI jobs and in the deploy container, and requiring a psql binary
 * in all of them is an avoidable dependency.
 */
import fs from "node:fs";
import path from "node:path";
import { Pool } from "pg";
import { buildSslConfig } from "./ssl.js";

// This package builds to CommonJS, so `import.meta` is unavailable. Both `src/`
// and `dist/` sit one level under packages/db, so `../` reaches the manifest
// whether this runs through tsx or from a build.
const manifestPath = path.resolve(__dirname, "../privileges.sql");

async function main(): Promise<void> {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    console.error(
      "DATABASE_URL is not set. Privileges must be applied through the " +
        "superuser connection, not DATABASE_APP_URL.",
    );
    process.exit(1);
  }

  const sql = fs.readFileSync(manifestPath, "utf8");
  const pool = new Pool({ connectionString, ssl: buildSslConfig(), max: 1 });

  try {
    await pool.query(sql);
    console.log("✅ Applied app_user privilege manifest (privileges.sql)");
  } finally {
    await pool.end();
  }
}

main().catch((err: unknown) => {
  console.error("Failed to apply privilege manifest:", err);
  process.exit(1);
});
