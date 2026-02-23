/**
 * Post-migration FK constraint verification and repair script.
 *
 * Drizzle `migrate()` has a known bug (ORM 0.44+ / journal v7) where it
 * silently records a migration as applied without executing the DDL on
 * existing databases. This script detects FK constraint drift introduced
 * by migration 0015 (gdpr_fk_constraints) and optionally repairs it.
 *
 * Usage:
 *   pnpm db:verify          # Check mode (default) — report mismatches, exit 1 if any
 *   pnpm db:verify:repair   # Repair mode — fix mismatches, then verify
 */

import { Pool } from "pg";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface FkExpectation {
  table: string;
  column: string;
  referencedTable: string;
  deleteRule: string;
  constraintName: string;
}

interface NullableExpectation {
  table: string;
  column: string;
  nullable: boolean;
}

interface Mismatch {
  type: "fk_delete_rule" | "nullable";
  table: string;
  column: string;
  expected: string;
  actual: string;
  repairStatements: string[];
}

// ---------------------------------------------------------------------------
// Expected state from migration 0015 (gdpr_fk_constraints)
// ---------------------------------------------------------------------------

const EXPECTED_FK_CONSTRAINTS: FkExpectation[] = [
  {
    table: "audit_events",
    column: "organization_id",
    referencedTable: "organizations",
    deleteRule: "SET NULL",
    constraintName: "audit_events_organization_id_organizations_id_fk",
  },
  {
    table: "audit_events",
    column: "actor_id",
    referencedTable: "users",
    deleteRule: "SET NULL",
    constraintName: "audit_events_actor_id_users_id_fk",
  },
  {
    table: "dsar_requests",
    column: "user_id",
    referencedTable: "users",
    deleteRule: "CASCADE",
    constraintName: "dsar_requests_user_id_users_id_fk",
  },
  {
    table: "submissions",
    column: "submitter_id",
    referencedTable: "users",
    deleteRule: "SET NULL",
    constraintName: "submissions_submitter_id_users_id_fk",
  },
  {
    table: "manuscripts",
    column: "owner_id",
    referencedTable: "users",
    deleteRule: "CASCADE",
    constraintName: "manuscripts_owner_id_users_id_fk",
  },
  {
    table: "api_keys",
    column: "created_by",
    referencedTable: "users",
    deleteRule: "SET NULL",
    constraintName: "api_keys_created_by_users_id_fk",
  },
  {
    table: "form_definitions",
    column: "created_by",
    referencedTable: "users",
    deleteRule: "SET NULL",
    constraintName: "form_definitions_created_by_users_id_fk",
  },
  {
    table: "embed_tokens",
    column: "created_by",
    referencedTable: "users",
    deleteRule: "SET NULL",
    constraintName: "embed_tokens_created_by_users_id_fk",
  },
  {
    table: "payments",
    column: "organization_id",
    referencedTable: "organizations",
    deleteRule: "SET NULL",
    constraintName: "payments_organization_id_organizations_id_fk",
  },
];

const EXPECTED_NULLABLE: NullableExpectation[] = [
  { table: "submissions", column: "submitter_id", nullable: true },
  { table: "api_keys", column: "created_by", nullable: true },
  { table: "form_definitions", column: "created_by", nullable: true },
  { table: "embed_tokens", column: "created_by", nullable: true },
  { table: "payments", column: "organization_id", nullable: true },
];

// ---------------------------------------------------------------------------
// Checks
// ---------------------------------------------------------------------------

async function checkFkConstraints(pool: Pool): Promise<Mismatch[]> {
  const mismatches: Mismatch[] = [];

  for (const expected of EXPECTED_FK_CONSTRAINTS) {
    const result = await pool.query<{ delete_rule: string }>(
      `SELECT rc.delete_rule
       FROM information_schema.referential_constraints rc
       JOIN information_schema.table_constraints tc
         ON rc.constraint_name = tc.constraint_name
         AND rc.constraint_schema = tc.constraint_schema
       WHERE tc.constraint_schema = 'public'
         AND rc.constraint_name = $1`,
      [expected.constraintName],
    );

    const actual = result.rows[0]?.delete_rule ?? "MISSING";

    if (actual !== expected.deleteRule) {
      const refColumn = expected.column === "organization_id" ? "id" : "id";
      mismatches.push({
        type: "fk_delete_rule",
        table: expected.table,
        column: expected.column,
        expected: expected.deleteRule,
        actual,
        repairStatements: [
          `ALTER TABLE "${expected.table}" DROP CONSTRAINT IF EXISTS "${expected.constraintName}"`,
          `ALTER TABLE "${expected.table}" ADD CONSTRAINT "${expected.constraintName}" FOREIGN KEY ("${expected.column}") REFERENCES "public"."${expected.referencedTable}"("${refColumn}") ON DELETE ${expected.deleteRule} ON UPDATE NO ACTION`,
        ],
      });
    }
  }

  return mismatches;
}

async function checkNullable(pool: Pool): Promise<Mismatch[]> {
  const mismatches: Mismatch[] = [];

  for (const expected of EXPECTED_NULLABLE) {
    const result = await pool.query<{ is_nullable: string }>(
      `SELECT is_nullable
       FROM information_schema.columns
       WHERE table_schema = 'public'
         AND table_name = $1
         AND column_name = $2`,
      [expected.table, expected.column],
    );

    const actual = result.rows[0]?.is_nullable ?? "MISSING";
    const expectedValue = expected.nullable ? "YES" : "NO";

    if (actual !== expectedValue) {
      const alterAction = expected.nullable ? "DROP NOT NULL" : "SET NOT NULL";
      mismatches.push({
        type: "nullable",
        table: expected.table,
        column: expected.column,
        expected: expectedValue,
        actual,
        repairStatements: [
          `ALTER TABLE "${expected.table}" ALTER COLUMN "${expected.column}" ${alterAction}`,
        ],
      });
    }
  }

  return mismatches;
}

// ---------------------------------------------------------------------------
// Repair
// ---------------------------------------------------------------------------

async function repair(pool: Pool, mismatches: Mismatch[]): Promise<void> {
  for (const mismatch of mismatches) {
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      for (const stmt of mismatch.repairStatements) {
        console.log(`  Executing: ${stmt}`);
        await client.query(stmt);
      }
      await client.query("COMMIT");
      console.log(
        `  Fixed: ${mismatch.table}.${mismatch.column} (${mismatch.type})`,
      );
    } catch (err) {
      await client.query("ROLLBACK");
      throw new Error(
        `Failed to repair ${mismatch.table}.${mismatch.column}: ${err instanceof Error ? err.message : String(err)}`,
      );
    } finally {
      client.release();
    }
  }
}

// ---------------------------------------------------------------------------
// Reporting
// ---------------------------------------------------------------------------

function reportMismatches(mismatches: Mismatch[]): void {
  console.log(`\nFound ${mismatches.length} mismatch(es):\n`);
  for (const m of mismatches) {
    const label = m.type === "fk_delete_rule" ? "FK delete rule" : "nullable";
    console.log(
      `  ${m.table}.${m.column} — ${label}: expected ${m.expected}, got ${m.actual}`,
    );
  }
  console.log();
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main(): Promise<void> {
  const mode = process.argv.includes("--repair") ? "repair" : "check";

  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    console.error("ERROR: DATABASE_URL environment variable is required");
    process.exit(2);
  }

  const pool = new Pool({ connectionString: databaseUrl });

  try {
    // Verify connectivity
    await pool.query("SELECT 1");
  } catch (err) {
    console.error(
      `ERROR: Cannot connect to database: ${err instanceof Error ? err.message : String(err)}`,
    );
    process.exit(2);
  }

  try {
    console.log("Checking FK constraints (migration 0015)...");
    const fkMismatches = await checkFkConstraints(pool);

    console.log("Checking nullable columns (migration 0015)...");
    const nullMismatches = await checkNullable(pool);

    const allMismatches = [...fkMismatches, ...nullMismatches];

    if (allMismatches.length === 0) {
      console.log("\nAll migration 0015 checks passed.");
      process.exit(0);
    }

    reportMismatches(allMismatches);

    if (mode === "check") {
      console.log("Run with --repair to fix these mismatches.");
      process.exit(1);
    }

    // Repair mode — fix nullable columns first (FK constraints may depend on them)
    const nullFirst = [
      ...allMismatches.filter((m) => m.type === "nullable"),
      ...allMismatches.filter((m) => m.type === "fk_delete_rule"),
    ];

    console.log("Repairing mismatches...\n");
    await repair(pool, nullFirst);

    // Verify after repair
    console.log("\nVerifying repair...");
    const postFk = await checkFkConstraints(pool);
    const postNull = await checkNullable(pool);
    const postAll = [...postFk, ...postNull];

    if (postAll.length > 0) {
      reportMismatches(postAll);
      console.error("ERROR: Some mismatches remain after repair.");
      process.exit(1);
    }

    console.log("All migration 0015 checks passed after repair.");
    process.exit(0);
  } finally {
    await pool.end();
  }
}

main();
