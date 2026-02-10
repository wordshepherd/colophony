-- ============================================================================
-- ROW LEVEL SECURITY POLICIES
-- Run this after initial Prisma migration
-- ============================================================================

-- Helper functions to get current context
CREATE OR REPLACE FUNCTION current_org_id() RETURNS uuid AS $$
  SELECT NULLIF(current_setting('app.current_org', true), '')::uuid;
$$ LANGUAGE sql STABLE;

CREATE OR REPLACE FUNCTION current_user_id() RETURNS uuid AS $$
  SELECT NULLIF(current_setting('app.user_id', true), '')::uuid;
$$ LANGUAGE sql STABLE;

-- ============================================================================
-- SUBMISSIONS
-- ============================================================================

ALTER TABLE submissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE submissions FORCE ROW LEVEL SECURITY;

-- Allow access only to submissions in the current organization
CREATE POLICY org_isolation ON submissions
  FOR ALL
  USING (organization_id = current_org_id())
  WITH CHECK (organization_id = current_org_id());

-- ============================================================================
-- SUBMISSION FILES
-- ============================================================================

ALTER TABLE submission_files ENABLE ROW LEVEL SECURITY;
ALTER TABLE submission_files FORCE ROW LEVEL SECURITY;

-- Files are accessed via their parent submission's organization
CREATE POLICY org_isolation ON submission_files
  FOR ALL
  USING (
    submission_id IN (
      SELECT id FROM submissions WHERE organization_id = current_org_id()
    )
  )
  WITH CHECK (
    submission_id IN (
      SELECT id FROM submissions WHERE organization_id = current_org_id()
    )
  );

-- ============================================================================
-- SUBMISSION HISTORY
-- ============================================================================

ALTER TABLE submission_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE submission_history FORCE ROW LEVEL SECURITY;

CREATE POLICY org_isolation ON submission_history
  FOR ALL
  USING (
    submission_id IN (
      SELECT id FROM submissions WHERE organization_id = current_org_id()
    )
  )
  WITH CHECK (
    submission_id IN (
      SELECT id FROM submissions WHERE organization_id = current_org_id()
    )
  );

-- ============================================================================
-- PAYMENTS
-- ============================================================================

ALTER TABLE payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE payments FORCE ROW LEVEL SECURITY;

CREATE POLICY org_isolation ON payments
  FOR ALL
  USING (organization_id = current_org_id())
  WITH CHECK (organization_id = current_org_id());

-- ============================================================================
-- AUDIT EVENTS
-- ============================================================================

ALTER TABLE audit_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_events FORCE ROW LEVEL SECURITY;

-- Org-scoped audit events
CREATE POLICY org_isolation ON audit_events
  FOR ALL
  USING (
    organization_id IS NULL OR organization_id = current_org_id()
  )
  WITH CHECK (
    organization_id IS NULL OR organization_id = current_org_id()
  );

-- ============================================================================
-- SUBMISSION PERIODS
-- ============================================================================

ALTER TABLE submission_periods ENABLE ROW LEVEL SECURITY;
ALTER TABLE submission_periods FORCE ROW LEVEL SECURITY;

CREATE POLICY org_isolation ON submission_periods
  FOR ALL
  USING (organization_id = current_org_id())
  WITH CHECK (organization_id = current_org_id());

-- ============================================================================
-- RETENTION POLICIES
-- ============================================================================

ALTER TABLE retention_policies ENABLE ROW LEVEL SECURITY;
ALTER TABLE retention_policies FORCE ROW LEVEL SECURITY;

CREATE POLICY org_isolation ON retention_policies
  FOR ALL
  USING (
    organization_id IS NULL OR organization_id = current_org_id()
  )
  WITH CHECK (
    organization_id IS NULL OR organization_id = current_org_id()
  );

-- ============================================================================
-- USER CONSENTS
-- ============================================================================

ALTER TABLE user_consents ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_consents FORCE ROW LEVEL SECURITY;

CREATE POLICY org_isolation ON user_consents
  FOR ALL
  USING (
    organization_id IS NULL OR organization_id = current_org_id()
  )
  WITH CHECK (
    organization_id IS NULL OR organization_id = current_org_id()
  );

-- ============================================================================
-- ORGANIZATION MEMBERS (special case)
-- ============================================================================

ALTER TABLE organization_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE organization_members FORCE ROW LEVEL SECURITY;

-- Users can see members of their current organization
CREATE POLICY org_isolation ON organization_members
  FOR SELECT
  USING (organization_id = current_org_id());

-- Only admins can modify membership (enforced at application level)
CREATE POLICY org_admin_modify ON organization_members
  FOR ALL
  USING (organization_id = current_org_id())
  WITH CHECK (organization_id = current_org_id());

-- ============================================================================
-- FULL-TEXT SEARCH INDEX
-- ============================================================================

-- Create GIN index for full-text search on submissions
CREATE INDEX IF NOT EXISTS idx_submissions_search
  ON submissions USING GIN(search_vector);

-- Function to update search vector
CREATE OR REPLACE FUNCTION submissions_search_trigger() RETURNS trigger AS $$
BEGIN
  NEW.search_vector := to_tsvector('english',
    COALESCE(NEW.title, '') || ' ' ||
    COALESCE(NEW.content, '') || ' ' ||
    COALESCE(NEW.cover_letter, '')
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to automatically update search vector
DROP TRIGGER IF EXISTS submissions_search_update ON submissions;
CREATE TRIGGER submissions_search_update
  BEFORE INSERT OR UPDATE ON submissions
  FOR EACH ROW EXECUTE FUNCTION submissions_search_trigger();
