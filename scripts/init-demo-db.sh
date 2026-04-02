#!/bin/bash
# Provision the colophony_demo database on an existing PostgreSQL cluster.
# Run once (or idempotently) to create the demo database and app_user grants.
#
# Usage:
#   docker compose exec postgres bash /scripts/init-demo-db.sh
#   # or from host:
#   docker compose exec postgres psql -U colophony -c "SELECT 1 FROM pg_database WHERE datname = 'colophony_demo'" | grep -q 1 || \
#     docker compose exec postgres bash /scripts/init-demo-db.sh

set -euo pipefail

PGUSER="${POSTGRES_USER:-colophony}"
DEMO_DB="colophony_demo"
APP_USER="app_user"
APP_PASS="${APP_USER_PASSWORD:-app_user_password}"

echo "=== Provisioning demo database: $DEMO_DB ==="

# Create database if it doesn't exist
psql -U "$PGUSER" -tc "SELECT 1 FROM pg_database WHERE datname = '$DEMO_DB'" | grep -q 1 || {
  echo "Creating database $DEMO_DB..."
  psql -U "$PGUSER" -c "CREATE DATABASE $DEMO_DB OWNER $PGUSER;"
}

# Ensure app_user exists (may already exist from main DB init)
psql -U "$PGUSER" -tc "SELECT 1 FROM pg_roles WHERE rolname = '$APP_USER'" | grep -q 1 || {
  echo "Creating role $APP_USER..."
  psql -U "$PGUSER" -c "CREATE ROLE $APP_USER LOGIN PASSWORD '$APP_PASS' NOBYPASSRLS;"
}

# Grant privileges on demo database
echo "Granting privileges on $DEMO_DB..."
psql -U "$PGUSER" -d "$DEMO_DB" <<SQL
-- Grant usage on public schema
GRANT USAGE ON SCHEMA public TO $APP_USER;

-- Default privileges for future tables/sequences
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO $APP_USER;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT USAGE, SELECT ON SEQUENCES TO $APP_USER;

-- Grant on existing tables (if any)
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO $APP_USER;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO $APP_USER;

-- Functions needed for RLS
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO $APP_USER;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT EXECUTE ON FUNCTIONS TO $APP_USER;
SQL

echo "=== Demo database provisioned ==="
