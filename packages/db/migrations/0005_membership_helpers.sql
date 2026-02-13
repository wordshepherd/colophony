-- 0005: SECURITY DEFINER function for cross-tenant organization listing
--
-- list_user_organizations() queries organization_members across ALL orgs for a
-- given user. This is a fundamentally cross-tenant query — no single SET LOCAL
-- can satisfy it. SECURITY DEFINER executes as the function owner (the admin
-- role that runs migrations), which is a superuser and therefore bypasses
-- FORCE ROW LEVEL SECURITY on organization_members.
--
-- Hardened per PostgreSQL best practices:
--   - SET search_path prevents search_path hijacking
--   - REVOKE FROM PUBLIC + explicit GRANT to app_user only
--   - STABLE volatility (read-only, no side effects)

CREATE OR REPLACE FUNCTION list_user_organizations(p_user_id uuid)
RETURNS TABLE(organization_id uuid, role text, organization_name varchar, slug varchar)
AS $$
  SELECT om.organization_id, om.role::text, o.name, o.slug
  FROM public.organization_members om
  JOIN public.organizations o ON o.id = om.organization_id
  WHERE om.user_id = p_user_id
  ORDER BY o.name;
$$ LANGUAGE sql STABLE SECURITY DEFINER
   SET search_path = pg_catalog, public;

--> statement-breakpoint

-- Hardening: revoke default public access, grant only to app_user
REVOKE EXECUTE ON FUNCTION list_user_organizations(uuid) FROM PUBLIC;

--> statement-breakpoint

GRANT EXECUTE ON FUNCTION list_user_organizations(uuid) TO app_user;
