#!/bin/bash
set -e

if [ "$ALLOW_DB_RESET" != "true" ]; then
  echo "ERROR: Set ALLOW_DB_RESET=true to reset the database" >&2
  echo "Usage: ALLOW_DB_RESET=true bash scripts/db-reset.sh" >&2
  exit 1
fi

echo "Stopping PostgreSQL container and removing volume..."
docker compose down -v postgres

echo "Starting PostgreSQL container..."
docker compose up -d postgres

echo "Waiting for PostgreSQL to initialize..."
sleep 5

echo "Running migrations..."
pnpm --filter @colophony/db migrate

echo "Verifying migration state..."
pnpm --filter @colophony/db verify

echo "Database reset complete."
