-- Allow org editors to INSERT new manuscript versions for pieces in their copyedit pipeline
CREATE POLICY manuscript_versions_copyedit_insert ON manuscript_versions
  FOR INSERT TO app_user
  WITH CHECK (
    manuscript_id IN (
      SELECT m.id FROM manuscripts m
      JOIN manuscript_versions mv ON mv.manuscript_id = m.id
      JOIN submissions s ON s.manuscript_version_id = mv.id
      JOIN pipeline_items pi ON pi.submission_id = s.id
      WHERE pi.organization_id = current_org_id()
        AND pi.stage IN ('COPYEDIT_IN_PROGRESS', 'AUTHOR_REVIEW')
    )
  );

--> statement-breakpoint

-- Allow org editors to UPDATE manuscript versions for pieces in their copyedit pipeline
CREATE POLICY manuscript_versions_copyedit_update ON manuscript_versions
  FOR UPDATE TO app_user
  USING (
    manuscript_id IN (
      SELECT m.id FROM manuscripts m
      JOIN manuscript_versions mv ON mv.manuscript_id = m.id
      JOIN submissions s ON s.manuscript_version_id = mv.id
      JOIN pipeline_items pi ON pi.submission_id = s.id
      WHERE pi.organization_id = current_org_id()
        AND pi.stage IN ('COPYEDIT_IN_PROGRESS', 'AUTHOR_REVIEW')
    )
  )
  WITH CHECK (
    manuscript_id IN (
      SELECT m.id FROM manuscripts m
      JOIN manuscript_versions mv ON mv.manuscript_id = m.id
      JOIN submissions s ON s.manuscript_version_id = mv.id
      JOIN pipeline_items pi ON pi.submission_id = s.id
      WHERE pi.organization_id = current_org_id()
        AND pi.stage IN ('COPYEDIT_IN_PROGRESS', 'AUTHOR_REVIEW')
    )
  );
