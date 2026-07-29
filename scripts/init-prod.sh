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
EOSQL

# Restrict what the blanket GRANT above just handed out. This must run AFTER it:
# GRANT is additive, so it reverses any REVOKE that ran earlier — including the
# ones in the migrations applied in Step 1. packages/db/privileges.sql is the
# canonical list; do not add REVOKEs here.
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f /app/packages/db/privileges.sql

echo "Permissions granted."

# Step 3: Verify RLS enforcement
echo ""
echo "Step 3: Verifying RLS enforcement..."

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
if [ -f "$SCRIPT_DIR/verify-rls.sh" ]; then
  bash "$SCRIPT_DIR/verify-rls.sh" --structural-only
else
  echo "WARNING: verify-rls.sh not found, falling back to basic check"
  # Minimal fallback: app_user superuser check only
  APP_USER_SUPER=$(psql "$DATABASE_URL" -t -A -c "SELECT usesuper FROM pg_user WHERE usename = 'app_user';")
  if [ "$APP_USER_SUPER" = "f" ]; then
    echo "  app_user: NOT superuser (correct)"
  else
    echo "  ERROR: app_user is superuser! RLS will be bypassed!"
    exit 1
  fi
fi

# Step 4 (optional): Seed staging demo data
# Set SEED_STAGING=true in .env.staging to populate rich demo/QA data.
# Idempotent — safe to run on every deploy.
if [ "${SEED_STAGING:-}" = "true" ]; then
  echo ""
  echo "Step 4: Seeding staging demo data..."
  node /app/packages/db/dist/seed-staging.js
  echo "Staging seed complete."
fi

echo ""
echo "=== Production initialization complete ==="
