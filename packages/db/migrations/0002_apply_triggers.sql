-- 0002: Apply triggers and FORCE ROW LEVEL SECURITY
-- Runs after all tables are created

-- FORCE ROW LEVEL SECURITY on all RLS-enabled tables
-- (Drizzle only generates ENABLE, not FORCE)
ALTER TABLE "organization_members" FORCE ROW LEVEL SECURITY;
ALTER TABLE "submission_periods" FORCE ROW LEVEL SECURITY;
ALTER TABLE "submissions" FORCE ROW LEVEL SECURITY;
ALTER TABLE "submission_files" FORCE ROW LEVEL SECURITY;
ALTER TABLE "submission_history" FORCE ROW LEVEL SECURITY;
ALTER TABLE "payments" FORCE ROW LEVEL SECURITY;
ALTER TABLE "audit_events" FORCE ROW LEVEL SECURITY;
ALTER TABLE "retention_policies" FORCE ROW LEVEL SECURITY;
ALTER TABLE "user_consents" FORCE ROW LEVEL SECURITY;

-- Dynamic updatedAt triggers for all tables with updated_at column
DO $$
DECLARE r RECORD;
BEGIN
  FOR r IN
    SELECT table_name
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND column_name = 'updated_at'
  LOOP
    EXECUTE format(
      'DROP TRIGGER IF EXISTS trg_%I_set_updated_at ON %I;
       CREATE TRIGGER trg_%I_set_updated_at
         BEFORE UPDATE ON %I
         FOR EACH ROW EXECUTE FUNCTION set_updated_at();',
      r.table_name, r.table_name, r.table_name, r.table_name
    );
  END LOOP;
END $$;

-- FTS trigger on submissions
DROP TRIGGER IF EXISTS trg_submissions_search_update ON submissions;
CREATE TRIGGER trg_submissions_search_update
  BEFORE INSERT OR UPDATE ON submissions
  FOR EACH ROW EXECUTE FUNCTION submissions_search_trigger();
