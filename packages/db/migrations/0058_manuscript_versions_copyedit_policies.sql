-- Allow org editors to INSERT/UPDATE manuscript versions for pieces
-- in their copyedit pipeline. Uses a SECURITY DEFINER function to
-- avoid RLS recursion (manuscript_versions references itself via the
-- submissions → pipeline_items join path).
--> statement-breakpoint
CREATE OR REPLACE FUNCTION manuscript_ids_in_copyedit(org uuid)
RETURNS SETOF uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT DISTINCT mv.manuscript_id
  FROM manuscript_versions mv
  JOIN submissions s ON s.manuscript_version_id = mv.id
  JOIN pipeline_items pi ON pi.submission_id = s.id
  WHERE pi.organization_id = org
    AND pi.stage IN ('COPYEDIT_IN_PROGRESS', 'AUTHOR_REVIEW');
$$;
--> statement-breakpoint
REVOKE ALL ON FUNCTION manuscript_ids_in_copyedit(uuid) FROM PUBLIC;
--> statement-breakpoint
GRANT EXECUTE ON FUNCTION manuscript_ids_in_copyedit(uuid) TO app_user;
--> statement-breakpoint
CREATE POLICY manuscript_versions_copyedit_insert ON manuscript_versions
  FOR INSERT TO app_user
  WITH CHECK (
    manuscript_id IN (SELECT manuscript_ids_in_copyedit(current_org_id()))
  );
--> statement-breakpoint
CREATE POLICY manuscript_versions_copyedit_update ON manuscript_versions
  FOR UPDATE TO app_user
  USING (
    manuscript_id IN (SELECT manuscript_ids_in_copyedit(current_org_id()))
  )
  WITH CHECK (
    manuscript_id IN (SELECT manuscript_ids_in_copyedit(current_org_id()))
  );
