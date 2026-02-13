#!/bin/sh
# Production initialization script
# Runs Prisma migrations, applies RLS policies, and grants permissions
# Designed to be idempotent — safe to run multiple times
set -e

echo "=== Colophony Production Initialization ==="

# Validate required environment variables
if [ -z "$DATABASE_URL" ]; then
  echo "ERROR: DATABASE_URL is required (superuser connection for migrations)"
  exit 1
fi

if [ -z "$APP_DATABASE_URL" ]; then
  echo "WARNING: APP_DATABASE_URL not set, skipping RLS verification"
fi

# Step 1: Run Prisma migrations (idempotent by design)
echo ""
echo "Step 1: Running Prisma migrations..."
./packages/db/node_modules/.bin/prisma migrate deploy --schema ./prisma/schema.prisma
echo "Migrations complete."

# Step 2: Apply RLS policies
# Uses DO $$ blocks and IF NOT EXISTS for idempotency
echo ""
echo "Step 2: Applying RLS policies..."

psql "$DATABASE_URL" <<-'EOSQL'
-- Helper functions (CREATE OR REPLACE is idempotent)
CREATE OR REPLACE FUNCTION current_org_id() RETURNS uuid AS $$
  SELECT NULLIF(current_setting('app.current_org', true), '')::uuid;
$$ LANGUAGE sql STABLE;

CREATE OR REPLACE FUNCTION current_user_id() RETURNS uuid AS $$
  SELECT NULLIF(current_setting('app.user_id', true), '')::uuid;
$$ LANGUAGE sql STABLE;

-- Enable RLS on all tenant tables (idempotent)
ALTER TABLE submissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE submissions FORCE ROW LEVEL SECURITY;

ALTER TABLE submission_files ENABLE ROW LEVEL SECURITY;
ALTER TABLE submission_files FORCE ROW LEVEL SECURITY;

ALTER TABLE submission_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE submission_history FORCE ROW LEVEL SECURITY;

ALTER TABLE payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE payments FORCE ROW LEVEL SECURITY;

ALTER TABLE audit_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_events FORCE ROW LEVEL SECURITY;

ALTER TABLE submission_periods ENABLE ROW LEVEL SECURITY;
ALTER TABLE submission_periods FORCE ROW LEVEL SECURITY;

ALTER TABLE retention_policies ENABLE ROW LEVEL SECURITY;
ALTER TABLE retention_policies FORCE ROW LEVEL SECURITY;

ALTER TABLE user_consents ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_consents FORCE ROW LEVEL SECURITY;

ALTER TABLE organization_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE organization_members FORCE ROW LEVEL SECURITY;

-- Create RLS policies (use DO blocks with IF NOT EXISTS pattern)
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'submissions' AND policyname = 'org_isolation') THEN
    CREATE POLICY org_isolation ON submissions
      FOR ALL USING (organization_id = current_org_id())
      WITH CHECK (organization_id = current_org_id());
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'submission_files' AND policyname = 'org_isolation') THEN
    CREATE POLICY org_isolation ON submission_files
      FOR ALL
      USING (submission_id IN (SELECT id FROM submissions WHERE organization_id = current_org_id()))
      WITH CHECK (submission_id IN (SELECT id FROM submissions WHERE organization_id = current_org_id()));
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'submission_history' AND policyname = 'org_isolation') THEN
    CREATE POLICY org_isolation ON submission_history
      FOR ALL
      USING (submission_id IN (SELECT id FROM submissions WHERE organization_id = current_org_id()))
      WITH CHECK (submission_id IN (SELECT id FROM submissions WHERE organization_id = current_org_id()));
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'payments' AND policyname = 'org_isolation') THEN
    CREATE POLICY org_isolation ON payments
      FOR ALL USING (organization_id = current_org_id())
      WITH CHECK (organization_id = current_org_id());
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'audit_events' AND policyname = 'org_isolation') THEN
    CREATE POLICY org_isolation ON audit_events
      FOR ALL
      USING (organization_id IS NULL OR organization_id = current_org_id())
      WITH CHECK (organization_id IS NULL OR organization_id = current_org_id());
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'submission_periods' AND policyname = 'org_isolation') THEN
    CREATE POLICY org_isolation ON submission_periods
      FOR ALL USING (organization_id = current_org_id())
      WITH CHECK (organization_id = current_org_id());
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'retention_policies' AND policyname = 'org_isolation') THEN
    CREATE POLICY org_isolation ON retention_policies
      FOR ALL
      USING (organization_id IS NULL OR organization_id = current_org_id())
      WITH CHECK (organization_id IS NULL OR organization_id = current_org_id());
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'user_consents' AND policyname = 'org_isolation') THEN
    CREATE POLICY org_isolation ON user_consents
      FOR ALL
      USING (organization_id IS NULL OR organization_id = current_org_id())
      WITH CHECK (organization_id IS NULL OR organization_id = current_org_id());
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'organization_members' AND policyname = 'org_isolation') THEN
    CREATE POLICY org_isolation ON organization_members
      FOR SELECT USING (organization_id = current_org_id());
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'organization_members' AND policyname = 'org_admin_modify') THEN
    CREATE POLICY org_admin_modify ON organization_members
      FOR ALL USING (organization_id = current_org_id())
      WITH CHECK (organization_id = current_org_id());
  END IF;
END $$;

-- Full-text search index and trigger
CREATE INDEX IF NOT EXISTS idx_submissions_search ON submissions USING GIN(search_vector);

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

DROP TRIGGER IF EXISTS submissions_search_update ON submissions;
CREATE TRIGGER submissions_search_update
  BEFORE INSERT OR UPDATE ON submissions
  FOR EACH ROW EXECUTE FUNCTION submissions_search_trigger();
EOSQL

echo "RLS policies applied."

# Step 3: Grant permissions to app_user (GRANT is idempotent)
echo ""
echo "Step 3: Granting permissions to app_user..."

psql "$DATABASE_URL" <<-'EOSQL'
GRANT USAGE ON SCHEMA public TO app_user;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO app_user;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO app_user;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO app_user;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT USAGE, SELECT ON SEQUENCES TO app_user;
GRANT EXECUTE ON FUNCTION current_org_id() TO app_user;
GRANT EXECUTE ON FUNCTION current_user_id() TO app_user;
EOSQL

echo "Permissions granted."

# Step 4: Verify RLS enforcement
echo ""
echo "Step 4: Verifying RLS enforcement..."

psql "$DATABASE_URL" -t -A -c "
SELECT relname, relrowsecurity, relforcerowsecurity
FROM pg_class
WHERE relname IN (
  'submissions', 'submission_files', 'submission_history',
  'payments', 'audit_events', 'submission_periods',
  'retention_policies', 'user_consents', 'organization_members'
)
ORDER BY relname;
" | while IFS='|' read -r table rls force; do
  if [ "$rls" = "t" ] && [ "$force" = "t" ]; then
    echo "  $table: RLS enabled + forced"
  else
    echo "  ERROR: $table: rls=$rls force=$force"
    exit 1
  fi
done

# Verify app_user is not superuser
APP_USER_SUPER=$(psql "$DATABASE_URL" -t -A -c "SELECT usesuper FROM pg_user WHERE usename = 'app_user';")
if [ "$APP_USER_SUPER" = "f" ]; then
  echo "  app_user: NOT superuser (correct)"
else
  echo "  ERROR: app_user is superuser! RLS will be bypassed!"
  exit 1
fi

echo ""
echo "=== Production initialization complete ==="
