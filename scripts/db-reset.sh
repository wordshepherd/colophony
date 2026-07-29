#!/bin/bash
set -e

if [ "$ALLOW_DB_RESET" != "true" ]; then
  echo "ERROR: Set ALLOW_DB_RESET=true to reset the database" >&2
  echo "Usage: ALLOW_DB_RESET=true bash scripts/db-reset.sh" >&2
  exit 1
fi

CONTAINER="colophony-postgres"
DB_USER="colophony"
DB_NAME="colophony"

# Check that postgres container is running
if ! docker compose ps --format '{{.Name}}' | grep -q "$CONTAINER"; then
  echo "ERROR: PostgreSQL container is not running. Start it with: pnpm docker:up" >&2
  exit 1
fi

echo "Dropping and recreating public schema (Zitadel database preserved)..."
docker exec "$CONTAINER" psql -U "$DB_USER" -d "$DB_NAME" -c "
  DROP SCHEMA IF EXISTS drizzle CASCADE;
  DROP SCHEMA IF EXISTS public CASCADE;
  CREATE SCHEMA public;
  GRANT ALL ON SCHEMA public TO $DB_USER;
  GRANT ALL ON SCHEMA public TO PUBLIC;
  GRANT USAGE ON SCHEMA public TO app_user;
  GRANT USAGE ON SCHEMA public TO audit_writer;
"

echo "Running migrations from clean state (includes SQL functions, triggers, extensions)..."
pnpm --filter @colophony/db migrate

# Verify tables actually exist after migration.
TABLE_COUNT=$(docker exec "$CONTAINER" psql -U "$DB_USER" -d "$DB_NAME" -tAc \
  "SELECT count(*) FROM pg_tables WHERE schemaname = 'public';")

if [ "$TABLE_COUNT" -eq 0 ]; then
  echo "ERROR: migrate() produced no tables. This is a Drizzle bug — check packages/db/drizzle.config.ts." >&2
  exit 1
fi

echo "Restoring app_user DML permissions..."
docker exec "$CONTAINER" psql -U "$DB_USER" -d "$DB_NAME" -c "
  GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO app_user;
  GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO app_user;
  ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO app_user;
  ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT USAGE, SELECT ON SEQUENCES TO app_user;
"

# Restrict what the blanket GRANT above just handed out. This must run AFTER it:
# GRANT is additive, so it reverses the REVOKEs the migrations applied.
# packages/db/privileges.sql is the canonical list; do not add REVOKEs here.
echo "Restoring restricted table permissions..."
docker exec -i "$CONTAINER" psql -U "$DB_USER" -d "$DB_NAME" -v ON_ERROR_STOP=1 -f - \
  < "$(dirname "$0")/../packages/db/privileges.sql"

echo "Database reset complete. Zitadel database preserved."
