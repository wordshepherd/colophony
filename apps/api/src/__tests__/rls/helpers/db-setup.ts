import { Pool } from 'pg';
import { type NodePgDatabase } from 'drizzle-orm/node-postgres';
import fs from 'node:fs';
import path from 'node:path';

export type DrizzleDb = NodePgDatabase<Record<string, never>>;

const migrationsFolder = path.resolve(
  __dirname,
  '../../../../../../packages/db/migrations',
);

const ADMIN_URL =
  process.env.DATABASE_TEST_URL ??
  'postgresql://test:test@localhost:5433/prospector_test';
const APP_URL =
  process.env.DATABASE_APP_URL ??
  'postgresql://app_user:app_password@localhost:5433/prospector_test';

let adminPool: Pool | null = null;
let appPool: Pool | null = null;
let isSetUp = false;

export function getAdminPool(): Pool {
  if (!adminPool) {
    adminPool = new Pool({
      connectionString: ADMIN_URL,
      max: 5,
      idleTimeoutMillis: 1000,
    });
  }
  return adminPool;
}

export function getAppPool(): Pool {
  if (!appPool) {
    appPool = new Pool({
      connectionString: APP_URL,
      max: 5,
      idleTimeoutMillis: 1000,
    });
  }
  return appPool;
}

/**
 * Apply migration SQL files in order.
 * Reads the Drizzle journal to get the correct order, then executes
 * each SQL file statement-by-statement (split on --> statement-breakpoint).
 */
async function applyMigrations(pool: Pool): Promise<void> {
  const journalPath = path.join(migrationsFolder, 'meta', '_journal.json');
  const journal = JSON.parse(fs.readFileSync(journalPath, 'utf8')) as {
    entries: Array<{ tag: string }>;
  };

  for (const entry of journal.entries) {
    const sqlPath = path.join(migrationsFolder, `${entry.tag}.sql`);
    const sql = fs.readFileSync(sqlPath, 'utf8');

    // Split on Drizzle's statement breakpoint marker
    const statements = sql
      .split('--> statement-breakpoint')
      .map((s) => s.trim())
      .filter((s) => s.length > 0);

    for (const statement of statements) {
      await pool.query(statement);
    }
  }
}

export async function globalSetup(): Promise<void> {
  if (isSetUp) return;

  const admin = getAdminPool();

  // Create app_user role (portable — works in CI and locally)
  await admin.query(`
    DO $$ BEGIN
      IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'app_user') THEN
        CREATE ROLE app_user LOGIN PASSWORD 'app_password'
          NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS;
      ELSE
        ALTER ROLE app_user NOSUPERUSER NOBYPASSRLS;
      END IF;
    END $$;
  `);

  // Reset schema
  await admin.query('DROP SCHEMA IF EXISTS public CASCADE');
  await admin.query('CREATE SCHEMA public');
  await admin.query('GRANT ALL ON SCHEMA public TO PUBLIC');
  await admin.query('GRANT USAGE ON SCHEMA public TO app_user');

  // Apply migrations by reading SQL files directly
  await applyMigrations(admin);

  // Grant DML permissions to app_user
  await admin.query(
    'GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO app_user',
  );
  await admin.query(
    'GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO app_user',
  );
  await admin.query(
    'ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO app_user',
  );
  await admin.query(
    'ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT USAGE, SELECT ON SEQUENCES TO app_user',
  );

  // Verify app_user is NOSUPERUSER and NOBYPASSRLS
  const { rows } = await admin.query<{
    usesuper: boolean;
    rolbypassrls: boolean;
  }>(`
    SELECT u.usesuper, r.rolbypassrls
    FROM pg_user u
    JOIN pg_roles r ON u.usename = r.rolname
    WHERE u.usename = 'app_user'
  `);

  if (rows.length === 0) throw new Error('app_user role not found after setup');
  if (rows[0].usesuper) throw new Error('app_user must not be superuser');
  if (rows[0].rolbypassrls) throw new Error('app_user must not bypass RLS');

  isSetUp = true;
}

export async function globalTeardown(): Promise<void> {
  await Promise.allSettled([adminPool?.end(), appPool?.end()]);
  adminPool = null;
  appPool = null;
  isSetUp = false;
}

// Automatic cleanup when the process exits (singleFork mode shares pools)
process.on('beforeExit', () => {
  void globalTeardown();
});
