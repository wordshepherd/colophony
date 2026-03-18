-- Revoke DELETE on tables that should be immutable/append-only.
-- ALTER DEFAULT PRIVILEGES in init-db.sh grants full DML (including DELETE)
-- to all future tables. Per-migration GRANTs that omit DELETE are no-ops
-- because PostgreSQL GRANT is additive. Explicit REVOKE is required.

REVOKE DELETE ON "user_keys" FROM app_user;
REVOKE DELETE ON "trusted_peers" FROM app_user;
REVOKE DELETE ON "sim_sub_checks" FROM app_user;
REVOKE DELETE ON "inbound_transfers" FROM app_user;
REVOKE DELETE ON "documenso_webhook_events" FROM app_user;
