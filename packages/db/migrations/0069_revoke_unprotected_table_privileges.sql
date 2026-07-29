-- Restore the app_user REVOKEs that provisioning undoes.
--
-- Migrations 0023 and 0029 already revoke these; the blanket
-- GRANT ... ON ALL TABLES that every provisioning path issues afterwards
-- silently reverses them, because GRANT is additive. This migration re-applies
-- them for databases that are migrated without running packages/db/privileges.sql.
--
-- packages/db/privileges.sql is the canonical list and is applied as the last
-- privilege step in every provisioning path. Change it there, not here.

-- Instance-level, no RLS, reached only through the superuser pool.
-- federation_config holds the instance signing private key.
REVOKE ALL ON "federation_config" FROM app_user;
REVOKE ALL ON "hub_registered_instances" FROM app_user;
REVOKE ALL ON "hub_fingerprint_index" FROM app_user;

-- Public intake, written through the superuser pool. Postdates migration 0052,
-- so it never had a REVOKE at all.
REVOKE ALL ON "demo_requests" FROM app_user;

-- Transactional outbox: app_user INSERTs inside the producer's own RLS
-- transaction; the superuser poller reads, updates and retries. This is what
-- migration 0022's comment claimed but could not achieve with GRANT alone.
REVOKE SELECT, UPDATE, DELETE ON "outbox_events" FROM app_user;
