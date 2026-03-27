-- 0060: Expand Role enum with PRODUCTION + BUSINESS_OPS, convert single role to roles array
--
-- PRODUCTION — gates slate/production pipeline (issue assembly, copyedit, proofs).
-- BUSINESS_OPS — forward declaration (no procedures check it yet).
-- Multi-role: users can hold multiple roles simultaneously via roles[] array.

-- Step 1: Expand the Role enum
-- NOTE: ALTER TYPE ... ADD VALUE cannot run inside a transaction that has
-- already performed writes. Each ADD VALUE must be its own statement.
ALTER TYPE "Role" ADD VALUE IF NOT EXISTS 'PRODUCTION';
--> statement-breakpoint
ALTER TYPE "Role" ADD VALUE IF NOT EXISTS 'BUSINESS_OPS';

--> statement-breakpoint

-- Step 2: Add roles array column with default, populate from single role, drop old column
ALTER TABLE "organization_members"
  ADD COLUMN "roles" "Role"[] NOT NULL DEFAULT ARRAY['READER']::"Role"[];

--> statement-breakpoint

UPDATE "organization_members" SET "roles" = ARRAY["role"];

--> statement-breakpoint

ALTER TABLE "organization_members" DROP COLUMN "role";

--> statement-breakpoint

-- Step 3: Recreate SECURITY DEFINER function with new return type (roles text[])
-- PostgreSQL cannot change return type with CREATE OR REPLACE — must DROP first.
-- Same hardening as original (0005_membership_helpers.sql):
--   - SET search_path prevents hijacking
--   - REVOKE FROM PUBLIC + explicit GRANT to app_user
--   - STABLE volatility (read-only)
DROP FUNCTION IF EXISTS list_user_organizations(uuid);

--> statement-breakpoint

CREATE FUNCTION list_user_organizations(p_user_id uuid)
RETURNS TABLE(organization_id uuid, roles text[], organization_name varchar, slug varchar)
AS $$
  SELECT om.organization_id,
         (SELECT array_agg(r::text ORDER BY r) FROM unnest(om.roles) AS r) AS roles,
         o.name, o.slug
  FROM public.organization_members om
  JOIN public.organizations o ON o.id = om.organization_id
  WHERE om.user_id = p_user_id
  ORDER BY o.name;
$$ LANGUAGE sql STABLE SECURITY DEFINER
   SET search_path = pg_catalog, public;

--> statement-breakpoint

-- Re-apply hardening (CREATE OR REPLACE resets grants)
REVOKE EXECUTE ON FUNCTION list_user_organizations(uuid) FROM PUBLIC;

--> statement-breakpoint

GRANT EXECUTE ON FUNCTION list_user_organizations(uuid) TO app_user;
