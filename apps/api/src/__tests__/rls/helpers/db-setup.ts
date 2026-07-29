import { Client, Pool } from 'pg';
import { type NodePgDatabase } from 'drizzle-orm/node-postgres';
import fs from 'node:fs';
import path from 'node:path';

export type DrizzleDb = NodePgDatabase<Record<string, never>>;

const migrationsFolder = path.resolve(
  __dirname,
  '../../../../../../packages/db/migrations',
);

/** Canonical app_user privileges — the same file every provisioning path applies. */
const privilegesManifest = path.resolve(
  __dirname,
  '../../../../../../packages/db/privileges.sql',
);

const ADMIN_URL =
  process.env.DATABASE_TEST_URL ??
  'postgresql://test:test@localhost:5433/colophony_test';
const APP_URL =
  process.env.DATABASE_APP_URL ??
  'postgresql://app_user:app_password@localhost:5433/colophony_test';

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

  // Before anything else: the connection `@colophony/db` uses for its superuser
  // pool must actually be a superuser. This runs first because everything below
  // needs those privileges, and failing here names the cause — left to fail on
  // its own, a demoted DATABASE_URL surfaces as `permission denied to alter
  // role` from the CREATE ROLE block a few lines down. The app_user half of the
  // same check waits until the end, since that role does not exist yet on a
  // fresh database.
  await assertModulePoolRole(MODULE_POOL_CHECKS.admin);

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

  // Create audit_writer role (for insert_audit_event SECURITY DEFINER function)
  // NOLOGIN: only used as function owner, never for direct connections
  await admin.query(`
    DO $$ BEGIN
      IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'audit_writer') THEN
        CREATE ROLE audit_writer NOLOGIN
          NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS;
      ELSE
        ALTER ROLE audit_writer NOSUPERUSER NOBYPASSRLS;
      END IF;
    END $$;
  `);
  await admin.query('GRANT USAGE ON SCHEMA public TO audit_writer');

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

  // Restrict what the blanket GRANT above just handed out. This must run AFTER
  // it: GRANT is additive, so it reverses the REVOKEs the migrations applied.
  // Applying the same manifest the deployed environments use is what keeps this
  // database's privileges identical to staging's — rls-infrastructure.test.ts
  // asserts the resulting matrix, so a divergence here would make that suite
  // pin local state rather than deployed state.
  await admin.query(fs.readFileSync(privilegesManifest, 'utf8'));

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

  // The mirror of the check above, and it is load-bearing for a different set of
  // suites. `api-key-service.test.ts` and the admin-pool cases in
  // `organization-service.test.ts` prove that an explicit WHERE clause isolates
  // tenants *without* RLS — which only means anything if this connection really
  // does bypass RLS. ADMIN_URL comes straight from DATABASE_TEST_URL, so pointing
  // it at a non-superuser would make those suites pass under RLS and assert
  // nothing, while still reporting green.
  const { rows: adminRoles } = await admin.query<{
    rolsuper: boolean;
    rolbypassrls: boolean;
  }>(
    'SELECT rolsuper, rolbypassrls FROM pg_roles WHERE rolname = current_user',
  );

  if (adminRoles.length === 0) {
    throw new Error('admin role not found after setup');
  }
  if (!adminRoles[0].rolsuper && !adminRoles[0].rolbypassrls) {
    throw new Error(
      'admin pool must bypass RLS (needs rolsuper or rolbypassrls) — ' +
        'predicate-only suites are meaningless without it',
    );
  }

  // The app_user half of the module-pool check (the superuser half ran at the
  // top). Deferred to here because globalSetup is what CREATEs the role.
  await assertModulePoolRole(MODULE_POOL_CHECKS.app);

  isSetUp = true;
}

interface ModulePoolCheck {
  variable: 'DATABASE_URL' | 'DATABASE_APP_URL';
  role: string;
  mustBypassRls: boolean;
  consequence: string;
}

/**
 * The two connections `@colophony/db` builds its pools from.
 *
 * The assertions elsewhere in globalSetup cover THIS file's pools
 * (`DATABASE_TEST_URL` / `DATABASE_APP_URL`). The code under test uses `db`,
 * `pool` and `appPool` from packages/db/src/client.ts, which read `DATABASE_URL`
 * and `DATABASE_APP_URL` — a different pair, and it was the `DATABASE_URL` half
 * that had collapsed onto app_user in every suite except queues.
 * `assert-pool-separation.ts` proves the two strings differ; only a connection
 * proves they are different roles.
 */
const MODULE_POOL_CHECKS: Record<'admin' | 'app', ModulePoolCheck> = {
  admin: {
    variable: 'DATABASE_URL',
    role: 'superuser',
    mustBypassRls: true,
    consequence:
      'the superuser paths (hooks/auth.ts, hooks/org-context.ts, the webhook ' +
      'handlers, outbox-poller.worker, public.routes) run under RLS instead of ' +
      'bypassing it, and are never exercised as written',
  },
  app: {
    variable: 'DATABASE_APP_URL',
    role: 'app_user',
    mustBypassRls: false,
    consequence:
      'every withRls() call bypasses the policies it is meant to prove, so the ' +
      'RLS suites assert nothing while still reporting green',
  },
};

/**
 * Verify one of those connections resolves to the role it is supposed to.
 *
 * Uses a throwaway `Client` rather than importing `{ pool, appPool }` from the
 * package. Those singletons carry `idleTimeoutMillis: 30000`, and only six of
 * the thirty-six integration test files call `globalTeardown()` — so importing
 * them here would leave sockets open in most files and stall vitest's exit for
 * half a minute apiece. A client opened and ended in the same function checks
 * the identical connection string and outlives nothing.
 */
async function assertModulePoolRole(check: ModulePoolCheck): Promise<void> {
  const url = process.env[check.variable];
  if (!url) {
    throw new Error(`${check.variable} is not set — cannot verify its role`);
  }

  const client = new Client({ connectionString: url });
  try {
    await client.connect();
    const { rows } = await client.query<{
      rolsuper: boolean;
      rolbypassrls: boolean;
    }>(
      'SELECT rolsuper, rolbypassrls FROM pg_roles WHERE rolname = current_user',
    );

    if (rows.length === 0) {
      throw new Error(`${check.variable} role not found in pg_roles`);
    }

    const bypassesRls = rows[0].rolsuper || rows[0].rolbypassrls;
    if (bypassesRls !== check.mustBypassRls) {
      throw new Error(
        `${check.variable} must point at a ${check.role} connection ` +
          `(rolsuper/rolbypassrls ${check.mustBypassRls ? 'set' : 'unset'}), ` +
          `but it does not. As configured, ${check.consequence}.`,
      );
    }
  } finally {
    await client.end();
  }
}

export async function globalTeardown(): Promise<void> {
  await Promise.allSettled([adminPool?.end(), appPool?.end()]);
  adminPool = null;
  appPool = null;
  isSetUp = false;
}

/**
 * Apply migrations from 0000 through the given tag (inclusive).
 * Uses the same statement-splitting pattern as globalSetup().
 */
export async function applyMigrationsUpTo(
  pool: Pool,
  upToTag: string,
): Promise<void> {
  const journalPath = path.join(migrationsFolder, 'meta', '_journal.json');
  const journal = JSON.parse(fs.readFileSync(journalPath, 'utf8')) as {
    entries: Array<{ tag: string }>;
  };

  for (const entry of journal.entries) {
    const sqlPath = path.join(migrationsFolder, `${entry.tag}.sql`);
    const sql = fs.readFileSync(sqlPath, 'utf8');

    const statements = sql
      .split('--> statement-breakpoint')
      .map((s) => s.trim())
      .filter((s) => s.length > 0);

    for (const statement of statements) {
      await pool.query(statement);
    }

    if (entry.tag === upToTag) break;
  }
}

/**
 * Apply a single migration by tag.
 * Throws if any statement fails (useful for testing dirty-data scenarios).
 */
export async function applySingleMigration(
  pool: Pool,
  tag: string,
): Promise<void> {
  const sqlPath = path.join(migrationsFolder, `${tag}.sql`);
  const sql = fs.readFileSync(sqlPath, 'utf8');

  const statements = sql
    .split('--> statement-breakpoint')
    .map((s) => s.trim())
    .filter((s) => s.length > 0);

  for (const statement of statements) {
    await pool.query(statement);
  }
}

// Automatic cleanup when the process exits (singleFork mode shares pools)
process.on('beforeExit', () => {
  void globalTeardown();
});
