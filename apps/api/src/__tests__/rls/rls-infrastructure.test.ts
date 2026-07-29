import { describe, it, expect, beforeAll } from 'vitest';
import { globalSetup, getAdminPool, getAppPool } from './helpers/db-setup';

const RLS_TABLES = [
  // Core
  'organization_members',
  'organization_invitations',
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
  'identity_migrations',
  'journal_directory',
  'external_submissions',
  'correspondence',
  'writer_profiles',
  // Submissions domain
  'sim_sub_checks',
  'submission_reviewers',
  'submission_discussions',
  'submission_votes',
  // Slate pipeline
  'pipeline_items',
  'pipeline_history',
  'pipeline_comments',
  // Issues
  'issues',
  'issue_sections',
  'issue_items',
  // Publications & contracts
  'publications',
  'contract_templates',
  'contracts',
  // CMS
  'cms_connections',
  // Webhooks
  'webhook_endpoints',
  'webhook_deliveries',
  // Notifications
  'notification_preferences',
  'email_sends',
  'notifications_inbox',
  // Email
  'email_templates',
  // Federation
  'trusted_peers',
  'inbound_transfers',
  // Editor tools
  'saved_queue_presets',
  // User keys (DID document)
  'user_keys',
  // Editor workspace collections
  'workspace_collections',
  'workspace_items',
  // Business Operations
  'contributors',
  'contributor_publications',
  'rights_agreements',
  'payment_transactions',
  // Contests
  'contest_groups',
  'contest_judges',
  'contest_results',
  // Writer Platform
  'simsub_groups',
  'simsub_group_submissions',
  'portfolio_entries',
  'reader_feedback',
];

/** RLS tables where app_user has full DML (excludes audit_events which is SELECT-only + function, journal_directory which is SELECT-only).
 *  Note: init-db.sh sets ALTER DEFAULT PRIVILEGES ... GRANT SELECT, INSERT, UPDATE, DELETE
 *  so all tables created after init get full DML regardless of per-migration GRANT statements. */
const RLS_TABLES_FULL_DML = RLS_TABLES.filter(
  (t) => t !== 'audit_events' && t !== 'journal_directory',
);

/**
 * Tables with no row-level security. On these, cross-tenant isolation depends
 * either on an explicit `WHERE` clause in the service layer or on a table-level
 * `REVOKE` — never on the database's own policy machinery.
 *
 * `expectedAppUserSelect` records which of the two is doing the work, and is
 * asserted below. "No RLS" is only safe when something else is; see
 * `docs/tenant-isolation-audit.md` and the per-site classification there.
 */
const NON_RLS_TABLES: ReadonlyArray<{
  table: string;
  expectedAppUserSelect: boolean;
  why: string;
}> = [
  {
    table: 'organizations',
    expectedAppUserSelect: true,
    why: 'Read before org context exists. Service-layer predicate only.',
  },
  {
    table: 'users',
    expectedAppUserSelect: true,
    why: 'No organization_id column; scoped via org-bearing join partners.',
  },
  {
    table: 'dsar_requests',
    expectedAppUserSelect: true,
    why: 'User-scoped, not org-scoped.',
  },
  {
    table: 'demo_requests',
    expectedAppUserSelect: true,
    why: 'Public intake. KNOWN GAP: no RLS and no REVOKE — it postdates migration 0052, so ALTER DEFAULT PRIVILEGES left app_user full DML. Tracked in docs/backlog.md; flip this to false when the revoke lands.',
  },
  {
    table: 'stripe_webhook_events',
    expectedAppUserSelect: true,
    why: 'Inbound dedup, written pre-auth.',
  },
  {
    table: 'zitadel_webhook_events',
    expectedAppUserSelect: true,
    why: 'Inbound dedup, written pre-auth.',
  },
  {
    table: 'documenso_webhook_events',
    expectedAppUserSelect: true,
    why: 'Inbound dedup, written pre-auth. DELETE revoked by migration 0052.',
  },
  {
    table: 'outbox_events',
    expectedAppUserSelect: true,
    why: 'KNOWN GAP: migration 0022\'s comment claims "SELECT is not granted — only the superuser outbox poller reads/updates events", but app_user holds SELECT, INSERT, UPDATE and DELETE. GRANT is additive and removes nothing; ALTER DEFAULT PRIVILEGES in init-db.sh had already granted full DML — the same additive-GRANT trap already documented for DELETE on the append-only tables. Needs an explicit REVOKE, three-place discipline. Tracked in docs/backlog.md; flip this to false when it lands.',
  },
  // The three tables below are the ones documented as safe without RLS
  // "because of a revoke". They are not. See REVOKES_DO_NOT_SURVIVE below.
  {
    table: 'federation_config',
    expectedAppUserSelect: true,
    why: 'KNOWN GAP: migration 0023 revokes ALL, but the revoke does not survive provisioning. See REVOKES_DO_NOT_SURVIVE.',
  },
  {
    table: 'hub_registered_instances',
    expectedAppUserSelect: true,
    why: 'KNOWN GAP: migration 0029 revokes ALL, but the revoke does not survive provisioning. See REVOKES_DO_NOT_SURVIVE.',
  },
  {
    table: 'hub_fingerprint_index',
    expectedAppUserSelect: true,
    why: 'KNOWN GAP: migration 0029 revokes ALL, but the revoke does not survive provisioning. See REVOKES_DO_NOT_SURVIVE.',
  },
];

/**
 * REVOKES_DO_NOT_SURVIVE — the finding this file's privilege assertion exposed.
 *
 * `federation_config`, `hub_registered_instances` and `hub_fingerprint_index` are
 * documented as safe despite having no RLS, on the grounds that migration
 * `0029_hub_tables.sql:67` explicitly does `REVOKE ALL … FROM app_user`.
 * Measured, `app_user` holds SELECT, INSERT, UPDATE and DELETE on all three, in
 * both the test database and the dev database.
 *
 * The revokes are real; they are undone afterwards, in every provisioning path:
 *
 *   - `scripts/init-prod.sh` — Step 1 runs the migrations (applying the revokes),
 *     then Step 2 issues `GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN
 *     SCHEMA public TO app_user` and re-revokes only the seven tables from
 *     migrations 0052 and 0054. These three are not among them.
 *   - `helpers/db-setup.ts` — same shape: blanket grant after migrations, then
 *     re-revokes `audit_events` and `journal_directory` only. Its own comments
 *     ("the broad GRANT above re-grants it — must revoke after") show the hazard
 *     was known; the list was just incomplete.
 *   - `pnpm db:reset` — uses `drizzle-kit push`, which syncs schema and never
 *     executes migration SQL, so the revoke statements do not run at all.
 *
 * Consequence for P2.1: the design doc's `service_principals` recommendation is
 * "no RLS **plus** REVOKE ALL, reads via SECURITY DEFINER", justified by the hub
 * precedent being safe. Copying that pattern as written would leave the table of
 * hashed cross-org credentials fully readable by `app_user` — precisely the
 * instance-wide credential enumeration the recommendation exists to prevent.
 *
 * The expectations above therefore encode measured reality, not intent, so the
 * gap is visible rather than assumed away. Flip each to `false` when a fix lands
 * in all three places. Tracked in docs/backlog.md.
 *
 * NOT YET VERIFIED ON STAGING OR PRODUCTION — the reasoning above is a reading of
 * `init-prod.sh` plus measurement of two local databases. Confirm against the
 * deployed database before deciding severity.
 */

const NON_RLS_TABLE_NAMES = NON_RLS_TABLES.map((t) => t.table);

/** Drizzle's own bookkeeping — not application data, classified by neither list. */
const MIGRATION_BOOKKEEPING_TABLES = ['__drizzle_migrations'];

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
        [NON_RLS_TABLE_NAMES],
      );

      for (const row of rows) {
        expect(
          row.relforcerowsecurity,
          `${row.relname} should NOT have FORCE RLS`,
        ).toBe(false);
      }
    });

    /**
     * "No RLS" is a decision to use table privileges instead. This asserts that
     * decision was actually made rather than defaulted into — `init-db.sh` sets
     * `ALTER DEFAULT PRIVILEGES ... GRANT SELECT, INSERT, UPDATE, DELETE`, so a
     * new table is fully readable by `app_user` unless a migration revokes it.
     */
    it('should match the recorded app_user SELECT privilege on each non-RLS table', async () => {
      const admin = getAdminPool();
      for (const { table, expectedAppUserSelect, why } of NON_RLS_TABLES) {
        const { rows } = await admin.query<{ has_priv: boolean }>(
          `SELECT has_table_privilege('app_user', $1, 'SELECT') as has_priv`,
          [table],
        );
        expect(
          rows[0].has_priv,
          `${table}: expected app_user SELECT = ${expectedAppUserSelect}. ${why}`,
        ).toBe(expectedAppUserSelect);
      }
    });
  });

  /**
   * The gate.
   *
   * Every other assertion in this file iterates one of the two lists, so a table
   * absent from both is checked by nothing and passes silently. That is how
   * `hub_fingerprint_index`, `documenso_webhook_events`, `demo_requests` and
   * `hub_registered_instances` sat unclassified — and `demo_requests` shipped
   * with neither RLS nor a revoke.
   *
   * Same argument as `src/trpc/guard-coverage.spec.ts` (P0.4) makes for the tRPC
   * boundary: the policy needs a mechanism, not a note.
   */
  describe('Table classification is exhaustive', () => {
    it('classifies every table in the public schema as either RLS or non-RLS', async () => {
      const admin = getAdminPool();
      const { rows } = await admin.query<{ tablename: string }>(
        `SELECT tablename FROM pg_tables WHERE schemaname = 'public'`,
      );

      const actual = rows
        .map((r) => r.tablename)
        .filter((t) => !MIGRATION_BOOKKEEPING_TABLES.includes(t));
      const classified = new Set([...RLS_TABLES, ...NON_RLS_TABLE_NAMES]);

      const unclassified = actual.filter((t) => !classified.has(t)).sort();
      expect(
        unclassified,
        `Unclassified table(s). Add each to RLS_TABLES (with enableRLS() + pgPolicy in the schema) ` +
          `or to NON_RLS_TABLES with its compensating privilege, and record the read paths in ` +
          `docs/tenant-isolation-audit.md.`,
      ).toEqual([]);
    });

    it('has no stale entries — every classified table exists', async () => {
      const admin = getAdminPool();
      const { rows } = await admin.query<{ tablename: string }>(
        `SELECT tablename FROM pg_tables WHERE schemaname = 'public'`,
      );
      const actual = new Set(rows.map((r) => r.tablename));

      const missing = [...RLS_TABLES, ...NON_RLS_TABLE_NAMES]
        .filter((t) => !actual.has(t))
        .sort();
      expect(
        missing,
        'Classified table(s) that no longer exist — remove them from the lists.',
      ).toEqual([]);
    });

    it('classifies each table exactly once', () => {
      const overlap = RLS_TABLES.filter((t) =>
        NON_RLS_TABLE_NAMES.includes(t),
      ).sort();
      expect(overlap, 'Table(s) in both lists.').toEqual([]);
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

    it('should have full DML permissions on RLS tables with full access', async () => {
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

    it('should have SELECT-only on journal_directory (writes via superuser)', async () => {
      const admin = getAdminPool();

      // SELECT: yes
      const { rows: selRows } = await admin.query<{ has_priv: boolean }>(
        `SELECT has_table_privilege('app_user', 'journal_directory', 'SELECT') as has_priv`,
      );
      expect(selRows[0].has_priv).toBe(true);

      // INSERT: no
      const { rows: insRows } = await admin.query<{ has_priv: boolean }>(
        `SELECT has_table_privilege('app_user', 'journal_directory', 'INSERT') as has_priv`,
      );
      expect(insRows[0].has_priv).toBe(false);

      // UPDATE: no
      const { rows: updRows } = await admin.query<{ has_priv: boolean }>(
        `SELECT has_table_privilege('app_user', 'journal_directory', 'UPDATE') as has_priv`,
      );
      expect(updRows[0].has_priv).toBe(false);

      // DELETE: no
      const { rows: delRows } = await admin.query<{ has_priv: boolean }>(
        `SELECT has_table_privilege('app_user', 'journal_directory', 'DELETE') as has_priv`,
      );
      expect(delRows[0].has_priv).toBe(false);
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

    it('org-scoped tables have policies referencing org context', async () => {
      const admin = getAdminPool();

      // Tables excluded from the org-policy check:
      // - Nullable org policies (tested separately): audit_events, retention_policies, user_consents
      // - User-scoped (current_user_id()): manuscripts, manuscript_versions, files,
      //   external_submissions, correspondence, writer_profiles, identity_migrations,
      //   journal_directory, user_keys, simsub_groups, simsub_group_submissions,
      //   portfolio_entries
      // - Subquery-based: sim_sub_checks, piece_transfers
      const orgPolicyExceptions = new Set([
        'audit_events',
        'retention_policies',
        'user_consents',
        'manuscripts',
        'manuscript_versions',
        'files',
        'external_submissions',
        'correspondence',
        'writer_profiles',
        'identity_migrations',
        'journal_directory',
        'sim_sub_checks',
        'piece_transfers',
        'user_keys',
        'simsub_groups',
        'simsub_group_submissions',
        'portfolio_entries',
      ]);

      const orgScopedTables = RLS_TABLES.filter(
        (t) => !orgPolicyExceptions.has(t),
      );

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
        [orgScopedTables],
      );

      const tableMap = new Map<string, typeof rows>();
      for (const row of rows) {
        if (!tableMap.has(row.tablename)) tableMap.set(row.tablename, []);
        tableMap.get(row.tablename)!.push(row);
      }

      for (const table of orgScopedTables) {
        const policies = tableMap.get(table) ?? [];
        const hasOrgPolicy = policies.some(
          (p) =>
            p.qual.includes('current_org_id()') ||
            p.qual.includes("current_setting('app.current_org"),
        );
        expect(
          hasOrgPolicy,
          `${table} should have at least one policy referencing current_org_id() or current_setting('app.current_org')`,
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
