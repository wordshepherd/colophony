#!/bin/sh
# Production initialization script
# Runs Drizzle migrations, grants permissions, and verifies RLS
# Designed to be idempotent — safe to run multiple times
set -eo pipefail

echo "=== Colophony Production Initialization ==="

# Validate required environment variables
if [ -z "$DATABASE_URL" ]; then
  echo "ERROR: DATABASE_URL is required (superuser connection for migrations)"
  exit 1
fi

if [ -z "$DATABASE_APP_URL" ]; then
  echo "WARNING: DATABASE_APP_URL not set, skipping RLS verification"
fi

# Block default/placeholder credentials in production
for url_var in DATABASE_URL DATABASE_APP_URL; do
  eval url_val=\$$url_var
  if [ -n "$url_val" ]; then
    case "$url_val" in
      *app_password*|*CHANGE_ME*)
        echo "ERROR: $url_var contains a default/placeholder password."
        echo "  Generate a strong password: openssl rand -base64 48"
        exit 1
        ;;
    esac
  fi
done

# Step 1: Run Drizzle migrations (idempotent — tracks applied migrations in journal)
echo ""
echo "Step 1: Running Drizzle migrations..."
pnpm --filter @colophony/db migrate
echo "Migrations complete."

# Step 1.5: Enable pg_stat_statements (idempotent — only if preloaded)
echo ""
echo "Step 1.5: Enabling pg_stat_statements..."
psql "$DATABASE_URL" -c "
DO \$\$
BEGIN
    IF current_setting('shared_preload_libraries', true) LIKE '%pg_stat_statements%' THEN
        CREATE EXTENSION IF NOT EXISTS pg_stat_statements;
        RAISE NOTICE 'pg_stat_statements extension enabled';
    ELSE
        RAISE NOTICE 'pg_stat_statements not in shared_preload_libraries — skipping';
    END IF;
END
\$\$;"
echo "pg_stat_statements check complete."

# Step 2: Grant permissions to app_user (GRANT is idempotent)
# Drizzle migrations handle schema, RLS policies, helper functions, indexes, and triggers.
# Role grants are NOT in migrations — they must be applied here.
echo ""
echo "Step 2: Granting permissions to app_user..."

psql "$DATABASE_URL" <<-'EOSQL'
GRANT USAGE ON SCHEMA public TO app_user;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO app_user;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO app_user;
-- NOTE: This grants full DML (including DELETE) to ALL future tables.
-- Tables that should be append-only/immutable need explicit REVOKE below.
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO app_user;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT USAGE, SELECT ON SEQUENCES TO app_user;
GRANT EXECUTE ON FUNCTION current_org_id() TO app_user;
GRANT EXECUTE ON FUNCTION current_user_id() TO app_user;

-- Revoke DELETE on append-only/immutable tables.
-- ALTER DEFAULT PRIVILEGES grants full DML to all tables; these tables
-- need explicit REVOKE to enforce immutability. Keep in sync with
-- migration 0052_revoke_delete_restricted_tables.sql.
REVOKE DELETE ON "user_keys" FROM app_user;
REVOKE DELETE ON "trusted_peers" FROM app_user;
REVOKE DELETE ON "sim_sub_checks" FROM app_user;
REVOKE DELETE ON "inbound_transfers" FROM app_user;
REVOKE DELETE ON "documenso_webhook_events" FROM app_user;
EOSQL

echo "Permissions granted."

# Step 3: Verify RLS enforcement
# Query pg_class dynamically for all tables with RLS enabled — no hardcoded list needed.
echo ""
echo "Step 3: Verifying RLS enforcement..."

RLS_FAIL=0
psql "$DATABASE_URL" -t -A -c "
SELECT c.relname, c.relrowsecurity, c.relforcerowsecurity
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public'
  AND c.relkind = 'r'
  AND c.relrowsecurity = true
ORDER BY c.relname;
" | while IFS='|' read -r table rls force; do
  if [ "$rls" = "t" ] && [ "$force" = "t" ]; then
    echo "  $table: RLS enabled + forced"
  else
    echo "  ERROR: $table: rls=$rls force=$force (expected both true)"
    exit 1
  fi
done

# Check that at least some tables have RLS (catch empty result = migrations didn't apply)
RLS_COUNT=$(psql "$DATABASE_URL" -t -A -c "
SELECT count(*)
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public'
  AND c.relkind = 'r'
  AND c.relrowsecurity = true;
")
if [ "$RLS_COUNT" -lt 1 ]; then
  echo "  ERROR: No tables have RLS enabled — migrations may not have applied correctly"
  exit 1
fi
echo "  $RLS_COUNT tables with RLS verified."

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
