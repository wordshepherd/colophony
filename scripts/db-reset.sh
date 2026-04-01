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
  DROP SCHEMA IF EXISTS public CASCADE;
  CREATE SCHEMA public;
  GRANT ALL ON SCHEMA public TO $DB_USER;
  GRANT ALL ON SCHEMA public TO PUBLIC;
  GRANT USAGE ON SCHEMA public TO app_user;
  GRANT USAGE ON SCHEMA public TO audit_writer;
"

echo "Pushing schema via drizzle-kit (bypasses migrate() silent no-op)..."
pnpm --filter @colophony/db push

echo "Restoring app_user DML permissions..."
docker exec "$CONTAINER" psql -U "$DB_USER" -d "$DB_NAME" -c "
  GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO app_user;
  GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO app_user;
  ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO app_user;
  ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT USAGE, SELECT ON SEQUENCES TO app_user;
"

echo "Restoring restricted table permissions..."
docker exec "$CONTAINER" psql -U "$DB_USER" -d "$DB_NAME" <<-'EOSQL'
  DO $$ DECLARE tbl TEXT;
  BEGIN
    FOREACH tbl IN ARRAY ARRAY['user_keys','trusted_peers','sim_sub_checks','inbound_transfers','documenso_webhook_events']
    LOOP
      IF EXISTS (SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace WHERE n.nspname = 'public' AND c.relname = tbl) THEN
        EXECUTE format('REVOKE DELETE ON %I FROM app_user', tbl);
      END IF;
    END LOOP;
    FOREACH tbl IN ARRAY ARRAY['journal_directory','audit_events']
    LOOP
      IF EXISTS (SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace WHERE n.nspname = 'public' AND c.relname = tbl) THEN
        EXECUTE format('REVOKE INSERT, UPDATE, DELETE ON %I FROM app_user', tbl);
      END IF;
    END LOOP;
  END $$;
EOSQL

echo "Database reset complete. Zitadel database preserved."
