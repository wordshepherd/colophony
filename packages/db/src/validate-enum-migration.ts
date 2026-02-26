/**
 * Pre-flight enum migration validator.
 *
 * Checks that varchar columns contain only values compatible with their
 * target enum types before running ALTER COLUMN ... USING casts.
 *
 * Usage:
 *   pnpm db:validate-enums   # Check mode — report mismatches, exit 1 if any
 *
 * Pattern reference: verify-migrations.ts
 */

import { Pool } from "pg";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface EnumCastCheck {
  table: string;
  column: string;
  enumName: string;
  enumValues: string[];
}

interface EnumCastMismatch {
  table: string;
  column: string;
  enumName: string;
  invalidValues: Array<{ value: string; count: number }>;
}

// ---------------------------------------------------------------------------
// Checks for migration 0031 (federation_cleanup)
// ---------------------------------------------------------------------------

const MIGRATION_0031_CHECKS: EnumCastCheck[] = [
  {
    table: "identity_migrations",
    column: "direction",
    enumName: "IdentityMigrationDirection",
    enumValues: ["outbound", "inbound"],
  },
  {
    table: "hub_registered_instances",
    column: "status",
    enumName: "HubInstanceStatus",
    enumValues: ["active", "suspended", "revoked"],
  },
  {
    table: "trusted_peers",
    column: "initiated_by",
    enumName: "TrustInitiator",
    enumValues: ["local", "remote"],
  },
];

// ---------------------------------------------------------------------------
// Core check function
// ---------------------------------------------------------------------------

async function checkEnumCompatibility(
  pool: Pool,
  checks: EnumCastCheck[],
): Promise<EnumCastMismatch[]> {
  const mismatches: EnumCastMismatch[] = [];

  for (const check of checks) {
    // Check if the table exists (may have been dropped or not yet created)
    const tableResult = await pool.query(
      `SELECT 1 FROM information_schema.tables
       WHERE table_schema = 'public' AND table_name = $1`,
      [check.table],
    );
    if (tableResult.rows.length === 0) continue;

    // Check if the column still exists and is a varchar type
    const colResult = await pool.query<{ data_type: string }>(
      `SELECT data_type FROM information_schema.columns
       WHERE table_schema = 'public' AND table_name = $1 AND column_name = $2`,
      [check.table, check.column],
    );
    if (colResult.rows.length === 0) continue;

    // Skip if already converted to enum (USER-DEFINED)
    if (colResult.rows[0].data_type === "USER-DEFINED") continue;

    // Query for values not in the target enum set
    // Table/column names are from hardcoded checks (not user input), safe to interpolate
    const placeholders = check.enumValues.map((_, i) => `$${i + 1}`).join(", ");

    const result = await pool.query<{ value: string; count: string }>(
      `SELECT "${check.column}" AS value, COUNT(*) AS count
       FROM "${check.table}"
       WHERE "${check.column}" IS NOT NULL
         AND "${check.column}" NOT IN (${placeholders})
       GROUP BY "${check.column}"`,
      check.enumValues,
    );

    if (result.rows.length > 0) {
      mismatches.push({
        table: check.table,
        column: check.column,
        enumName: check.enumName,
        invalidValues: result.rows.map((r) => ({
          value: r.value,
          count: Number(r.count),
        })),
      });
    }
  }

  return mismatches;
}

// ---------------------------------------------------------------------------
// Reporting
// ---------------------------------------------------------------------------

function reportMismatches(mismatches: EnumCastMismatch[]): void {
  console.error(`\nFound ${mismatches.length} incompatible column(s):\n`);
  for (const m of mismatches) {
    console.error(`  ${m.table}.${m.column} → ${m.enumName}`);
    for (const v of m.invalidValues) {
      console.error(
        `    '${v.value}' (${v.count} row${v.count === 1 ? "" : "s"})`,
      );
    }
  }
  console.error("\nFix these values before applying the enum migration.\n");
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main(): Promise<void> {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    console.error("ERROR: DATABASE_URL environment variable is required");
    process.exit(2);
  }

  const pool = new Pool({ connectionString: databaseUrl });

  try {
    await pool.query("SELECT 1");
  } catch (err) {
    console.error(
      `ERROR: Cannot connect to database: ${err instanceof Error ? err.message : String(err)}`,
    );
    process.exit(2);
  }

  try {
    console.log("Checking enum compatibility for migration 0031...");
    const mismatches = await checkEnumCompatibility(
      pool,
      MIGRATION_0031_CHECKS,
    );

    if (mismatches.length === 0) {
      console.log("All enum cast checks passed — safe to apply migration.");
      process.exit(0);
    }

    reportMismatches(mismatches);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

main();
