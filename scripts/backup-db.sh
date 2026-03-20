#!/bin/bash
# Colophony Manual Backup Script
# Triggers a full WAL-G base backup of the production PostgreSQL database.
#
# Usage: bash scripts/backup-db.sh [--dry-run]
set -e

BOLD='\033[1m'
GREEN='\033[0;32m'
YELLOW='\033[0;33m'
RED='\033[0;31m'
CYAN='\033[0;36m'
NC='\033[0m'

DRY_RUN=false
CONTAINER="${POSTGRES_CONTAINER:-colophony-postgres}"

for arg in "$@"; do
  case "$arg" in
    --dry-run) DRY_RUN=true ;;
    *) echo "Usage: bash scripts/backup-db.sh [--dry-run]"; exit 1 ;;
  esac
done

echo ""
echo -e "${BOLD}=== Colophony Manual Backup ===${NC}"
echo ""

# Verify postgres container is running
if ! docker ps --format '{{.Names}}' | grep -q "^${CONTAINER}$"; then
  echo -e "${RED}ERROR:${NC} PostgreSQL container '${CONTAINER}' is not running."
  echo "  Start it with: docker compose --env-file .env.prod -f docker-compose.prod.yml up -d postgres"
  exit 1
fi

# Verify WAL-G is configured
WALG_PREFIX=$(docker exec "$CONTAINER" sh -c 'echo $WALG_S3_PREFIX' 2>/dev/null || echo "")
if [ -z "$WALG_PREFIX" ]; then
  echo -e "${RED}ERROR:${NC} WALG_S3_PREFIX is not set in the postgres container."
  echo "  Configure BACKUP_S3_PREFIX in .env.prod and restart the postgres service."
  exit 1
fi

echo -e "${CYAN}Container:${NC}  $CONTAINER"
echo -e "${CYAN}S3 prefix:${NC}  $WALG_PREFIX"
echo ""

if $DRY_RUN; then
  echo -e "${YELLOW}DRY RUN:${NC} Would execute: wal-g backup-push /var/lib/postgresql/data"
  echo ""
  echo "Current backups:"
  docker exec "$CONTAINER" wal-g backup-list 2>/dev/null || echo "  (no backups found)"
  exit 0
fi

echo -e "${BOLD}Pushing full base backup...${NC}"
docker exec "$CONTAINER" wal-g backup-push /var/lib/postgresql/data

echo ""
echo -e "${GREEN}Backup complete.${NC} Current backups:"
echo ""
docker exec "$CONTAINER" wal-g backup-list

echo ""
echo -e "${GREEN}${BOLD}=== Backup finished ===${NC}"
