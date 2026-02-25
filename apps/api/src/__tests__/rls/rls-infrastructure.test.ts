import { describe, it, expect, beforeAll } from 'vitest';
import { globalSetup, getAdminPool, getAppPool } from './helpers/db-setup';

const RLS_TABLES = [
  'organization_members',
  'form_definitions',
  'form_fields',
  'form_pages',
  'submission_periods',
  'submissions',
  'submission_history',
  'payments',
  'audit_events',
  'retention_policies',
  'user_consents',
  'api_keys',
  'manuscripts',
  'manuscript_versions',
  'files',
  'embed_tokens',
  'piece_transfers',
];

/** RLS tables where app_user has full DML (excludes audit_events which is SELECT-only + function). */
const RLS_TABLES_FULL_DML = RLS_TABLES.filter((t) => t !== 'audit_events');

const NON_RLS_TABLES = [
  'organizations',
  'users',
  'dsar_requests',
  'stripe_webhook_events',
  'outbox_events',
  'zitadel_webhook_events',
  'federation_config',
];

describe('RLS Infrastructure', () => {
  beforeAll(async () => {
    await globalSetup();
  });

  // No teardown — pools are shared across test files (singleFork mode)

  describe('Row-level security enabled', () => {
    it('should have relrowsecurity = true on all RLS tables', async () => {
      const admin = getAdminPool();
      const { rows } = await admin.query<{
        relname: string;
        relrowsecurity: boolean;
      }>(
        `
        SELECT relname, relrowsecurity
        FROM pg_class
        WHERE relname = ANY($1)
      `,
        [RLS_TABLES],
      );

      expect(rows).toHaveLength(RLS_TABLES.length);
      for (const row of rows) {
        expect(
          row.relrowsecurity,
          `${row.relname} should have RLS enabled`,
        ).toBe(true);
      }
    });

    it('should have relforcerowsecurity = true on all RLS tables', async () => {
      const admin = getAdminPool();
      const { rows } = await admin.query<{
        relname: string;
        relforcerowsecurity: boolean;
      }>(
        `
        SELECT relname, relforcerowsecurity
        FROM pg_class
        WHERE relname = ANY($1)
      `,
        [RLS_TABLES],
      );

      expect(rows).toHaveLength(RLS_TABLES.length);
      for (const row of rows) {
        expect(
          row.relforcerowsecurity,
          `${row.relname} should have FORCE RLS`,
        ).toBe(true);
      }
    });
  });

  describe('Non-RLS tables', () => {
    it('should NOT have FORCE RLS on non-RLS tables', async () => {
      const admin = getAdminPool();
      const { rows } = await admin.query<{
        relname: string;
        relforcerowsecurity: boolean;
      }>(
        `
        SELECT relname, relforcerowsecurity
        FROM pg_class
        WHERE relname = ANY($1)
      `,
        [NON_RLS_TABLES],
      );

      for (const row of rows) {
        expect(
          row.relforcerowsecurity,
          `${row.relname} should NOT have FORCE RLS`,
        ).toBe(false);
      }
    });
  });

  describe('app_user role', () => {
    it('should be NOSUPERUSER', async () => {
      const admin = getAdminPool();
      const { rows } = await admin.query<{ usesuper: boolean }>(
        "SELECT usesuper FROM pg_user WHERE usename = 'app_user'",
      );
      expect(rows).toHaveLength(1);
      expect(rows[0].usesuper).toBe(false);
    });

    it('should be NOBYPASSRLS', async () => {
      const admin = getAdminPool();
      const { rows } = await admin.query<{ rolbypassrls: boolean }>(
        "SELECT rolbypassrls FROM pg_roles WHERE rolname = 'app_user'",
      );
      expect(rows).toHaveLength(1);
      expect(rows[0].rolbypassrls).toBe(false);
    });

    it('should have full DML permissions on RLS tables (except audit_events)', async () => {
      const admin = getAdminPool();
      for (const table of RLS_TABLES_FULL_DML) {
        const { rows } = await admin.query<{ has_priv: boolean }>(
          `
          SELECT has_table_privilege('app_user', $1, 'SELECT, INSERT, UPDATE, DELETE') as has_priv
        `,
          [table],
        );
        expect(rows[0].has_priv, `app_user should have DML on ${table}`).toBe(
          true,
        );
      }
    });

    it('should have SELECT-only on audit_events (INSERT via function)', async () => {
      const admin = getAdminPool();

      // SELECT: yes
      const { rows: selRows } = await admin.query<{ has_priv: boolean }>(
        `SELECT has_table_privilege('app_user', 'audit_events', 'SELECT') as has_priv`,
      );
      expect(selRows[0].has_priv).toBe(true);

      // INSERT: no
      const { rows: insRows } = await admin.query<{ has_priv: boolean }>(
        `SELECT has_table_privilege('app_user', 'audit_events', 'INSERT') as has_priv`,
      );
      expect(insRows[0].has_priv).toBe(false);

      // UPDATE: no
      const { rows: updRows } = await admin.query<{ has_priv: boolean }>(
        `SELECT has_table_privilege('app_user', 'audit_events', 'UPDATE') as has_priv`,
      );
      expect(updRows[0].has_priv).toBe(false);

      // DELETE: no
      const { rows: delRows } = await admin.query<{ has_priv: boolean }>(
        `SELECT has_table_privilege('app_user', 'audit_events', 'DELETE') as has_priv`,
      );
      expect(delRows[0].has_priv).toBe(false);

      // EXECUTE on insert_audit_event: yes
      const { rows: execRows } = await admin.query<{ has_priv: boolean }>(
        `SELECT has_function_privilege(
          'app_user',
          'insert_audit_event(varchar, varchar, uuid, uuid, uuid, text, text, varchar, text, varchar, varchar, varchar)',
          'EXECUTE'
        ) as has_priv`,
      );
      expect(execRows[0].has_priv).toBe(true);
    });
  });

  describe('RLS context functions', () => {
    it('current_org_id() returns NULL without context', async () => {
      const app = getAppPool();
      const client = await app.connect();
      try {
        const { rows } = await client.query(
          'SELECT current_org_id() as org_id',
        );
        expect(rows[0].org_id).toBeNull();
      } finally {
        client.release();
      }
    });

    it('current_org_id() returns UUID when set', async () => {
      const app = getAppPool();
      const client = await app.connect();
      try {
        await client.query('BEGIN');
        const testId = 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11';
        await client.query("SELECT set_config('app.current_org', $1, true)", [
          testId,
        ]);
        const { rows } = await client.query(
          'SELECT current_org_id() as org_id',
        );
        expect(rows[0].org_id).toBe(testId);
        await client.query('ROLLBACK');
      } finally {
        client.release();
      }
    });

    it('current_user_id() returns NULL without context', async () => {
      const app = getAppPool();
      const client = await app.connect();
      try {
        const { rows } = await client.query(
          'SELECT current_user_id() as user_id',
        );
        expect(rows[0].user_id).toBeNull();
      } finally {
        client.release();
      }
    });

    it('current_user_id() returns UUID when set', async () => {
      const app = getAppPool();
      const client = await app.connect();
      try {
        await client.query('BEGIN');
        const testId = 'b0eebc99-9c0b-4ef8-bb6d-6bb9bd380a22';
        await client.query("SELECT set_config('app.user_id', $1, true)", [
          testId,
        ]);
        const { rows } = await client.query(
          'SELECT current_user_id() as user_id',
        );
        expect(rows[0].user_id).toBe(testId);
        await client.query('ROLLBACK');
      } finally {
        client.release();
      }
    });
  });

  describe('RLS policies exist', () => {
    it('should have policies on each RLS table', async () => {
      const admin = getAdminPool();
      const { rows } = await admin.query<{
        tablename: string;
        policyname: string;
      }>(
        `
        SELECT tablename, policyname
        FROM pg_policies
        WHERE schemaname = 'public'
          AND tablename = ANY($1)
        ORDER BY tablename, policyname
      `,
        [RLS_TABLES],
      );

      const tablesWithPolicies = new Set(rows.map((r) => r.tablename));
      for (const table of RLS_TABLES) {
        expect(
          tablesWithPolicies.has(table),
          `${table} should have at least one policy`,
        ).toBe(true);
      }
    });

    it('direct isolation policies reference current_org_id()', async () => {
      const admin = getAdminPool();
      const directTables = [
        'submissions',
        'submission_periods',
        'payments',
        'form_definitions',
      ];
      const { rows } = await admin.query<{
        tablename: string;
        policyname: string;
        qual: string;
      }>(
        `
        SELECT tablename, policyname, qual
        FROM pg_policies
        WHERE schemaname = 'public'
          AND tablename = ANY($1)
      `,
        [directTables],
      );

      // Each direct table should have at least one policy referencing current_org_id().
      // Some tables (e.g., submissions) also have user-scoped policies (submitter_read)
      // that reference current_user_id() instead — those are excluded from this check.
      const tableMap = new Map<string, typeof rows>();
      for (const row of rows) {
        if (!tableMap.has(row.tablename)) tableMap.set(row.tablename, []);
        tableMap.get(row.tablename)!.push(row);
      }

      for (const table of directTables) {
        const policies = tableMap.get(table) ?? [];
        const hasOrgPolicy = policies.some((p) =>
          p.qual.includes('current_org_id()'),
        );
        expect(
          hasOrgPolicy,
          `${table} should have at least one policy referencing current_org_id()`,
        ).toBe(true);
      }
    });

    it('organization_members has separate SELECT and ALL policies', async () => {
      const admin = getAdminPool();
      const { rows } = await admin.query<{
        policyname: string;
        cmd: string;
      }>(
        `
        SELECT policyname, cmd
        FROM pg_policies
        WHERE schemaname = 'public'
          AND tablename = 'organization_members'
        ORDER BY policyname
      `,
      );

      const cmds = rows.map((r) => r.cmd);
      expect(cmds).toContain('SELECT');
      expect(cmds).toContain('ALL');
    });

    it('nullable policies include IS NULL check', async () => {
      const admin = getAdminPool();
      const nullableTables = [
        'audit_events',
        'retention_policies',
        'user_consents',
      ];
      const { rows } = await admin.query<{
        tablename: string;
        policyname: string;
        qual: string | null;
        with_check: string | null;
      }>(
        `
        SELECT tablename, policyname, qual, with_check
        FROM pg_policies
        WHERE schemaname = 'public'
          AND tablename = ANY($1)
      `,
        [nullableTables],
      );

      // Group by table — at least one policy per table must contain IS NULL
      // in either its USING (qual) or WITH CHECK clause.
      // Split policies (e.g. audit_events) have IS NULL only in WITH CHECK.
      const tableMap = new Map<string, typeof rows>();
      for (const row of rows) {
        if (!tableMap.has(row.tablename)) tableMap.set(row.tablename, []);
        tableMap.get(row.tablename)!.push(row);
      }

      for (const table of nullableTables) {
        const policies = tableMap.get(table) ?? [];
        const hasNullCheck = policies.some(
          (p) =>
            (p.qual && p.qual.includes('IS NULL')) ||
            (p.with_check && p.with_check.includes('IS NULL')),
        );
        expect(
          hasNullCheck,
          `${table} should have at least one policy with IS NULL check`,
        ).toBe(true);
      }
    });
  });
});
