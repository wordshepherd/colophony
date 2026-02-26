import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { Pool } from 'pg';
import {
  applyMigrationsUpTo,
  applySingleMigration,
} from './helpers/db-setup.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const ADMIN_URL =
  process.env.DATABASE_TEST_URL ??
  'postgresql://test:test@localhost:5433/colophony_test';

let adminPool: Pool;

beforeAll(async () => {
  adminPool = new Pool({
    connectionString: ADMIN_URL,
    max: 3,
    idleTimeoutMillis: 1000,
  });
});

afterAll(async () => {
  await adminPool.end();
});

/**
 * Reset the database to the state after migration 0030 (before enum casts).
 * Creates required roles and applies migrations 0000–0030.
 */
async function resetToMigration0030(): Promise<void> {
  // Drop and recreate schema
  await adminPool.query('DROP SCHEMA IF EXISTS public CASCADE');
  await adminPool.query('CREATE SCHEMA public');
  await adminPool.query('GRANT ALL ON SCHEMA public TO PUBLIC');

  // Create roles needed by migrations
  await adminPool.query(`
    DO $$ BEGIN
      IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'app_user') THEN
        CREATE ROLE app_user LOGIN PASSWORD 'app_password'
          NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS;
      ELSE
        ALTER ROLE app_user NOSUPERUSER NOBYPASSRLS;
      END IF;
    END $$;
  `);
  await adminPool.query(`
    DO $$ BEGIN
      IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'audit_writer') THEN
        CREATE ROLE audit_writer NOLOGIN
          NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS;
      ELSE
        ALTER ROLE audit_writer NOSUPERUSER NOBYPASSRLS;
      END IF;
    END $$;
  `);
  await adminPool.query('GRANT USAGE ON SCHEMA public TO audit_writer');
  await adminPool.query('GRANT USAGE ON SCHEMA public TO app_user');

  await applyMigrationsUpTo(adminPool, '0030_user_key_rotation');
}

/**
 * Helper to check if a column is an enum type.
 */
async function getColumnType(table: string, column: string): Promise<string> {
  const result = await adminPool.query<{ data_type: string; udt_name: string }>(
    `SELECT data_type, udt_name FROM information_schema.columns
     WHERE table_schema = 'public' AND table_name = $1 AND column_name = $2`,
    [table, column],
  );
  if (result.rows.length === 0) return 'MISSING';
  return result.rows[0].data_type === 'USER-DEFINED'
    ? result.rows[0].udt_name
    : result.rows[0].data_type;
}

/**
 * Helper to check if an enum type exists.
 */
async function enumExists(enumName: string): Promise<boolean> {
  const result = await adminPool.query(
    `SELECT 1 FROM pg_type WHERE typname = $1 AND typtype = 'e'`,
    [enumName],
  );
  return result.rows.length > 0;
}

/**
 * Helper to check if a table exists.
 */
async function tableExists(tableName: string): Promise<boolean> {
  const result = await adminPool.query(
    `SELECT 1 FROM information_schema.tables
     WHERE table_schema = 'public' AND table_name = $1`,
    [tableName],
  );
  return result.rows.length > 0;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('Migration 0031 enum casts — happy path', () => {
  beforeEach(async () => {
    await resetToMigration0030();
  }, 30_000);

  it('applies cleanly with valid varchar data', async () => {
    // Insert valid rows matching the target enum values
    const orgId = (
      await adminPool.query<{ id: string }>(
        `INSERT INTO organizations (name, slug) VALUES ('test-org', 'test-org') RETURNING id`,
      )
    ).rows[0].id;

    const userId = (
      await adminPool.query<{ id: string }>(
        `INSERT INTO users (zitadel_user_id, email) VALUES ('z-test', 'test@example.com') RETURNING id`,
      )
    ).rows[0].id;

    // identity_migrations.direction = 'outbound'
    await adminPool.query(
      `INSERT INTO identity_migrations (user_id, organization_id, direction, peer_domain, status)
       VALUES ($1, $2, 'outbound', 'peer.example.com', 'PENDING')`,
      [userId, orgId],
    );

    // hub_registered_instances.status = 'active'
    await adminPool.query(
      `INSERT INTO hub_registered_instances (domain, instance_url, public_key, key_id, status)
       VALUES ('hub.example.com', 'https://hub.example.com', 'pk-test', 'hub.example.com#main', 'active')`,
    );

    // trusted_peers.initiated_by = 'local'
    await adminPool.query(
      `INSERT INTO trusted_peers (organization_id, domain, instance_url, public_key, key_id, initiated_by)
       VALUES ($1, 'trusted.example.com', 'https://trusted.example.com', 'pk-test', 'trusted.example.com#main', 'local')`,
      [orgId],
    );

    // Apply migration 0031
    await applySingleMigration(adminPool, '0031_federation_cleanup');

    // Assert columns are now enum types
    expect(await getColumnType('identity_migrations', 'direction')).toBe(
      'IdentityMigrationDirection',
    );
    expect(await getColumnType('hub_registered_instances', 'status')).toBe(
      'HubInstanceStatus',
    );
    expect(await getColumnType('trusted_peers', 'initiated_by')).toBe(
      'TrustInitiator',
    );

    // Assert inbound_transfers table was created
    expect(await tableExists('inbound_transfers')).toBe(true);
  });

  it('applies cleanly with empty tables', async () => {
    // No data — just apply migration 0031
    await applySingleMigration(adminPool, '0031_federation_cleanup');

    // Assert enum types exist
    expect(await enumExists('IdentityMigrationDirection')).toBe(true);
    expect(await enumExists('HubInstanceStatus')).toBe(true);
    expect(await enumExists('TrustInitiator')).toBe(true);
    expect(await enumExists('InboundTransferStatus')).toBe(true);

    // Assert columns are now enum types
    expect(await getColumnType('identity_migrations', 'direction')).toBe(
      'IdentityMigrationDirection',
    );
    expect(await getColumnType('hub_registered_instances', 'status')).toBe(
      'HubInstanceStatus',
    );
    expect(await getColumnType('trusted_peers', 'initiated_by')).toBe(
      'TrustInitiator',
    );

    // Assert inbound_transfers table was created
    expect(await tableExists('inbound_transfers')).toBe(true);
  });
});

describe('Migration 0031 enum casts — dirty data', () => {
  beforeEach(async () => {
    await resetToMigration0030();
  }, 30_000);

  it('rejects invalid value in identity_migrations.direction', async () => {
    const orgId = (
      await adminPool.query<{ id: string }>(
        `INSERT INTO organizations (name, slug) VALUES ('test-org', 'test-org') RETURNING id`,
      )
    ).rows[0].id;

    const userId = (
      await adminPool.query<{ id: string }>(
        `INSERT INTO users (zitadel_user_id, email) VALUES ('z-test', 'test@example.com') RETURNING id`,
      )
    ).rows[0].id;

    // Insert invalid direction value (must fit varchar(10))
    await adminPool.query(
      `INSERT INTO identity_migrations (user_id, organization_id, direction, peer_domain, status)
       VALUES ($1, $2, 'bad', 'peer.example.com', 'PENDING')`,
      [userId, orgId],
    );

    await expect(
      applySingleMigration(adminPool, '0031_federation_cleanup'),
    ).rejects.toThrow();
  });

  it('rejects case-mismatched value in hub_registered_instances.status', async () => {
    // Insert 'Active' (capital A) — enum expects 'active'
    await adminPool.query(
      `INSERT INTO hub_registered_instances (domain, instance_url, public_key, key_id, status)
       VALUES ('hub.example.com', 'https://hub.example.com', 'pk-test', 'hub.example.com#main', 'Active')`,
    );

    await expect(
      applySingleMigration(adminPool, '0031_federation_cleanup'),
    ).rejects.toThrow();
  });

  it('rejects invalid value in trusted_peers.initiated_by', async () => {
    const orgId = (
      await adminPool.query<{ id: string }>(
        `INSERT INTO organizations (name, slug) VALUES ('test-org', 'test-org') RETURNING id`,
      )
    ).rows[0].id;

    await adminPool.query(
      `INSERT INTO trusted_peers (organization_id, domain, instance_url, public_key, key_id, initiated_by)
       VALUES ($1, 'trusted.example.com', 'https://trusted.example.com', 'pk-test', 'trusted.example.com#main', 'UNKNOWN')`,
      [orgId],
    );

    await expect(
      applySingleMigration(adminPool, '0031_federation_cleanup'),
    ).rejects.toThrow();
  });
});

describe('Migration 0031 partial failure', () => {
  beforeEach(async () => {
    await resetToMigration0030();
  }, 30_000);

  it('documents partial state after mid-migration failure', async () => {
    // Drizzle-specific behavior: migration statements are applied individually,
    // NOT wrapped in a transaction. Other ORMs (e.g., Knex, Flyway) may wrap
    // each migration file in a transaction, producing all-or-nothing semantics.
    //
    // Insert dirty data in hub_registered_instances (enum cast #2).
    // The enum CREATEs succeed, identity_migrations ALTER succeeds (empty),
    // but hub_registered_instances ALTER fails on invalid data.
    await adminPool.query(
      `INSERT INTO hub_registered_instances (domain, instance_url, public_key, key_id, status)
       VALUES ('hub.example.com', 'https://hub.example.com', 'pk-test', 'hub.example.com#main', 'Active')`,
    );

    // Attempt migration — expect failure
    await expect(
      applySingleMigration(adminPool, '0031_federation_cleanup'),
    ).rejects.toThrow();

    // Document partial state: Drizzle applies statements individually (not transactionally)
    // Enum types created before the failing ALTER should exist
    expect(await enumExists('IdentityMigrationDirection')).toBe(true);
    expect(await enumExists('HubInstanceStatus')).toBe(true);
    expect(await enumExists('TrustInitiator')).toBe(true);
    expect(await enumExists('InboundTransferStatus')).toBe(true);

    // identity_migrations.direction was converted (it runs before hub)
    expect(await getColumnType('identity_migrations', 'direction')).toBe(
      'IdentityMigrationDirection',
    );

    // hub_registered_instances.status failed — still varchar
    expect(await getColumnType('hub_registered_instances', 'status')).toBe(
      'character varying',
    );

    // trusted_peers.initiated_by — not yet reached
    expect(await getColumnType('trusted_peers', 'initiated_by')).toBe(
      'character varying',
    );

    // inbound_transfers table was not created (comes after failing ALTER)
    expect(await tableExists('inbound_transfers')).toBe(false);
  });
});
