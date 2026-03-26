-- Add org-scoped SELECT policies to manuscripts and manuscript_versions.
-- Editors can read manuscript metadata and extracted content for non-draft
-- submissions in their org. Mirrors the existing files_org_read pattern.
--
-- The manuscripts policy needs manuscript_id from manuscript_versions, but
-- querying manuscript_versions triggers its RLS (which recurses back to
-- manuscripts). We use a SECURITY DEFINER function to break the cycle.
--> statement-breakpoint
CREATE OR REPLACE FUNCTION manuscript_ids_for_org(org uuid)
RETURNS SETOF uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT mv.manuscript_id
  FROM manuscript_versions mv
  JOIN submissions s ON s.manuscript_version_id = mv.id
  WHERE s.organization_id = org
  AND s.status != 'DRAFT';
$$;
--> statement-breakpoint
REVOKE ALL ON FUNCTION manuscript_ids_for_org(uuid) FROM PUBLIC;
--> statement-breakpoint
GRANT EXECUTE ON FUNCTION manuscript_ids_for_org(uuid) TO app_user;
--> statement-breakpoint
CREATE POLICY "manuscripts_org_read" ON "manuscripts" AS PERMISSIVE FOR SELECT TO "app_user"
USING (id IN (SELECT manuscript_ids_for_org(current_org_id())));
--> statement-breakpoint
CREATE POLICY "manuscript_versions_org_read" ON "manuscript_versions" AS PERMISSIVE FOR SELECT TO "app_user"
USING (id IN (
  SELECT s.manuscript_version_id FROM submissions s
  WHERE s.organization_id = current_org_id()
  AND s.manuscript_version_id IS NOT NULL
  AND s.status != 'DRAFT'
));
