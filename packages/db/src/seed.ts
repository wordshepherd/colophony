/**
 * Seed script stub.
 *
 * Runs as the superuser (DATABASE_URL) so RLS does not apply.
 * Full seed data will be added once the API layer is in place.
 *
 * Usage: pnpm --filter @colophony/db seed
 */

import { pool } from "./client";

async function main() {
  console.log("Seeding database...");

  // TODO: Add seed data here once the API layer exists.
  // Use db.insert(...).values(...) with the Drizzle schema.

  console.log("Seed complete.");
}

main()
  .catch((e) => {
    console.error("Seed failed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await pool.end();
  });
