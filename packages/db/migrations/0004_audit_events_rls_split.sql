-- 0004: Split audit_events RLS policy into separate SELECT and INSERT policies
--
-- Previously a single "for all" policy allowed NULL-org rows to be visible
-- to any tenant context. Auth failure events (with NULL organization_id)
-- could expose IP addresses, user agents, and Zitadel user IDs cross-tenant.
--
-- New policies:
--   SELECT: strict tenant isolation (only org-scoped rows visible)
--   INSERT: allow NULL-org inserts (for auth failure logging without org context)

DROP POLICY IF EXISTS "audit_events_org_isolation" ON "audit_events";--> statement-breakpoint
CREATE POLICY "audit_events_org_isolation_select" ON "audit_events" AS PERMISSIVE FOR SELECT TO public USING (organization_id = current_org_id());--> statement-breakpoint
CREATE POLICY "audit_events_org_isolation_insert" ON "audit_events" AS PERMISSIVE FOR INSERT TO public WITH CHECK (organization_id IS NULL OR organization_id = current_org_id());
