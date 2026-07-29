-- Canonical app_user table privileges.
--
-- THIS IS THE ONLY PLACE TO CHANGE app_user's table privileges. Every
-- provisioning path applies this file as its last privilege step. Adding a
-- REVOKE anywhere else will be silently undone; adding one only to a migration
-- will be undone too (see below).
--
-- Why this file exists
-- --------------------
-- Every provisioning path issues a blanket
--
--   GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO app_user
--
-- plus ALTER DEFAULT PRIVILEGES for tables created later. GRANT is additive and
-- removes nothing, so it silently reverses any REVOKE that ran earlier —
-- including the REVOKEs in migrations 0023 and 0029. Those migrations do run;
-- their effect is then erased by the grant that follows. Anything needing less
-- than full DML must therefore be revoked AFTER the blanket grant, which is what
-- every caller of this file does.
--
-- Omitting RLS on a table is a decision to use table privileges instead. This
-- file is where that decision is recorded and enforced;
-- apps/api/src/__tests__/rls/rls-infrastructure.test.ts asserts the resulting
-- privilege matrix per table and fails CI on drift.
--
-- Safe to run at any point: each statement is guarded on table existence, so it
-- may run before migrations (init-db.sh) or after (everywhere else). Idempotent
-- — revoking an absent privilege is a no-op.
--
-- Anything that CREATES tables must apply this afterwards, not just anything
-- that grants. `ALTER DEFAULT PRIVILEGES` gives every newly created table full
-- DML, so `drizzle-kit push` reopens these tables even though it issues no
-- GRANT of its own — which is why `db:push` chains `pnpm privileges` too.

DO $$
DECLARE
  spec RECORD;
BEGIN
  FOR spec IN
    SELECT * FROM (VALUES
      -- Append-only tables: DELETE withheld (migration 0052).
      ('user_keys',                'DELETE'),
      ('trusted_peers',            'DELETE'),
      ('sim_sub_checks',           'DELETE'),
      ('inbound_transfers',        'DELETE'),
      ('documenso_webhook_events', 'DELETE'),

      -- SELECT-only tables (migration 0054).
      -- journal_directory: writes via the superuser pool.
      -- audit_events: writes via insert_audit_event() SECURITY DEFINER.
      ('journal_directory',        'INSERT, UPDATE, DELETE'),
      ('audit_events',             'INSERT, UPDATE, DELETE'),

      -- Instance-level tables with no RLS, reached only through the superuser
      -- pool (`db` in packages/db/src/client.ts). federation_config holds the
      -- instance signing private key and hub attestation token, so app_user
      -- having SELECT here is a credential exposure, not a tenancy question.
      -- Migrations 0023 and 0029 intended this; the blanket grant undid it.
      ('federation_config',        'ALL'),
      ('hub_registered_instances', 'ALL'),
      ('hub_fingerprint_index',    'ALL'),

      -- Public intake, written through the superuser pool
      -- (apps/api/src/routes/public.routes.ts). Postdates migration 0052, so it
      -- never had a REVOKE at all.
      ('demo_requests',            'ALL'),

      -- Transactional outbox. app_user INSERTs inside the producer's own RLS
      -- transaction; the superuser poller reads, updates and retries. This is
      -- what migration 0022's comment claimed but could not achieve with GRANT.
      -- NB: enqueueOutboxEvent must never gain a .returning() — RETURNING reads
      -- the row back via SELECT, which this revoke withholds. Same trap as
      -- audit_events, whose INSERT policy is likewise stricter than it looks.
      ('outbox_events',            'SELECT, UPDATE, DELETE')
    ) AS t(tbl, privs)
  LOOP
    IF EXISTS (
      SELECT 1
      FROM pg_class c
      JOIN pg_namespace n ON n.oid = c.relnamespace
      WHERE n.nspname = 'public' AND c.relname = spec.tbl
    ) THEN
      EXECUTE format('REVOKE %s ON public.%I FROM app_user', spec.privs, spec.tbl);
    END IF;
  END LOOP;
END
$$;
