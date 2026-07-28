-- Drop the retired `payments:read` API key scope from existing keys.
--
-- The scope was declared in `apiKeyScopeSchema` but never enforced anywhere;
-- every payment-adjacent guard uses `payment-transactions:read` / `:write`
-- instead. Removing it from the enum leaves stale rows behind, so strip it
-- from the stored `scopes` arrays in the same change.
--
-- Cross-tenant by design: this must reach every organisation's keys, so it
-- carries no `organization_id` predicate. `api_keys` has FORCE ROW LEVEL
-- SECURITY, so this only works because migrations connect as the superuser
-- role over the direct `DATABASE_URL`, bypassing both RLS and PgBouncer.
--
-- Idempotent: re-running matches nothing. A key whose only scope was
-- `payments:read` is left with an empty array — it was already inert, since
-- the scope gated nothing.

UPDATE api_keys
SET    scopes = scopes - 'payments:read'
WHERE  scopes @> '["payments:read"]'::jsonb;
