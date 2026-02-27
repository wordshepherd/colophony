CREATE POLICY "correspondence_org_insert" ON "correspondence"
  AS PERMISSIVE FOR INSERT TO public
  WITH CHECK (
    submission_id IN (
      SELECT id FROM submissions
      WHERE organization_id = current_org_id()
    )
  );
