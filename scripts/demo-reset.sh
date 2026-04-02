#!/bin/bash
# Reset the demo database: drop schema, migrate, re-seed.
# Designed to run as a cron job on the VPS.
#
# Usage:
#   ./scripts/demo-reset.sh                     # from project root
#   0 */4 * * * cd /opt/colophony && ./scripts/demo-reset.sh >> /var/log/demo-reset.log 2>&1

set -euo pipefail

COMPOSE_FILE="${COMPOSE_FILE:-docker-compose.prod.yml}"
COMPOSE_PROFILES="${COMPOSE_PROFILES:-demo}"
DEMO_DB="colophony_demo"
PGUSER="${POSTGRES_USER:-colophony}"

echo "=== Demo reset starting at $(date -u '+%Y-%m-%dT%H:%M:%SZ') ==="

# 1. Drop and recreate the public schema
echo "Dropping public schema..."
docker compose -f "$COMPOSE_FILE" --profile "$COMPOSE_PROFILES" exec -T postgres \
  psql -U "$PGUSER" -d "$DEMO_DB" -c "DROP SCHEMA IF EXISTS public CASCADE; CREATE SCHEMA public;"

# 2. Re-grant default privileges (lost when schema is dropped)
echo "Re-granting privileges..."
docker compose -f "$COMPOSE_FILE" --profile "$COMPOSE_PROFILES" exec -T postgres \
  psql -U "$PGUSER" -d "$DEMO_DB" <<SQL
GRANT USAGE ON SCHEMA public TO app_user;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO app_user;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT USAGE, SELECT ON SEQUENCES TO app_user;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT EXECUTE ON FUNCTIONS TO app_user;
SQL

# 3. Run migrations
echo "Running migrations..."
docker compose -f "$COMPOSE_FILE" --profile "$COMPOSE_PROFILES" run --rm \
  -e DATABASE_URL="postgresql://${PGUSER}:${POSTGRES_PASSWORD}@postgres:5432/${DEMO_DB}" \
  demo-migrate

# 4. Seed demo data
echo "Seeding demo data..."
docker compose -f "$COMPOSE_FILE" --profile "$COMPOSE_PROFILES" exec -T api-demo \
  node -e "
    process.env.DATABASE_URL = 'postgresql://${PGUSER}:${POSTGRES_PASSWORD}@postgres:5432/${DEMO_DB}';
    import('./dist/packages/db/src/seed-demo.js').then(m => m.default ? m.default() : null);
  " 2>/dev/null || {
    # Fallback: run via the db package directly
    docker compose -f "$COMPOSE_FILE" --profile "$COMPOSE_PROFILES" exec -T api-demo \
      npx tsx --env-file=/dev/null -e "
        process.env.DATABASE_URL = 'postgresql://${PGUSER}:${POSTGRES_PASSWORD}@postgres:5432/${DEMO_DB}';
        require('./packages/db/src/seed-demo.ts');
      " 2>/dev/null || echo "WARNING: Seed command failed — demo data may be empty"
  }

echo "=== Demo reset complete at $(date -u '+%Y-%m-%dT%H:%M:%SZ') ==="
