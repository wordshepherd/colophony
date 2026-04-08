#!/bin/bash
# Reset the demo database: drop schema, re-run demo-migrate (migrations + seed).
# Designed to run as a cron job on the VPS.
#
# The demo-migrate service uses the builder Docker target which has source files
# and dev tools (tsx), so it can run both migrations and seed-demo.ts.
#
# Usage:
#   ./scripts/demo-reset.sh                     # from project root
#   0 */4 * * * cd /opt/colophony && ./scripts/demo-reset.sh >> /var/log/demo-reset.log 2>&1

set -euo pipefail

COMPOSE_FILE="${COMPOSE_FILE:-docker-compose.prod.yml}"
ENV_FILE="${ENV_FILE:-.env.staging}"
DEMO_DB="colophony_demo"
PGUSER="${POSTGRES_USER:-colophony}"

echo "=== Demo reset starting at $(date -u '+%Y-%m-%dT%H:%M:%SZ') ==="

# 1. Drop and recreate the public schema (also drop drizzle schema so migrations re-run)
echo "Dropping schemas..."
docker compose -f "$COMPOSE_FILE" --env-file "$ENV_FILE" --profile demo exec -T postgres \
  psql -U "$PGUSER" -d "$DEMO_DB" -c "DROP SCHEMA IF EXISTS drizzle CASCADE; DROP SCHEMA IF EXISTS public CASCADE; CREATE SCHEMA public;"

# 2. Re-grant default privileges (lost when schema is dropped)
echo "Re-granting privileges..."
docker compose -f "$COMPOSE_FILE" --env-file "$ENV_FILE" --profile demo exec -T postgres \
  psql -U "$PGUSER" -d "$DEMO_DB" <<SQL
GRANT USAGE ON SCHEMA public TO app_user;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO app_user;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT USAGE, SELECT ON SEQUENCES TO app_user;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT EXECUTE ON FUNCTIONS TO app_user;
SQL

# 3. Run demo-migrate (migrations + seed via builder image)
echo "Running migrations and seed..."
docker compose -f "$COMPOSE_FILE" --env-file "$ENV_FILE" --profile demo run --rm demo-migrate

echo "=== Demo reset complete at $(date -u '+%Y-%m-%dT%H:%M:%SZ') ==="
