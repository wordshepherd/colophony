#!/bin/bash
# Colophony Disaster Recovery Restore Script
# Restores PostgreSQL from a WAL-G backup. DESTRUCTIVE — requires --confirm.
#
# Usage: bash scripts/restore-backup.sh [--latest | <backup-name>] [--pitr <timestamp>] [--confirm] [--dry-run]
#
# Examples:
#   bash scripts/restore-backup.sh --latest --confirm
#   bash scripts/restore-backup.sh --latest --pitr "2026-03-19 14:00:00 UTC" --confirm
#   bash scripts/restore-backup.sh base_000000010000000000000005 --confirm
#   bash scripts/restore-backup.sh --latest --dry-run
set -e

BOLD='\033[1m'
GREEN='\033[0;32m'
YELLOW='\033[0;33m'
RED='\033[0;31m'
CYAN='\033[0;36m'
NC='\033[0m'

BACKUP_TARGET=""
PITR_TIMESTAMP=""
CONFIRMED=false
DRY_RUN=false
CONTAINER="${POSTGRES_CONTAINER:-colophony-postgres}"
COMPOSE_FILE="${COMPOSE_FILE:-docker-compose.prod.yml}"
ENV_FILE="${ENV_FILE:-.env.prod}"

# Parse arguments
while [ $# -gt 0 ]; do
  case "$1" in
    --latest) BACKUP_TARGET="LATEST"; shift ;;
    --pitr) PITR_TIMESTAMP="$2"; shift 2 ;;
    --confirm) CONFIRMED=true; shift ;;
    --dry-run) DRY_RUN=true; shift ;;
    --help|-h) echo "Usage: bash scripts/restore-backup.sh [--latest | <backup-name>] [--pitr <timestamp>] [--confirm] [--dry-run]"; exit 0 ;;
    -*) echo "Unknown option: $1"; exit 1 ;;
    *) BACKUP_TARGET="$1"; shift ;;
  esac
done

if [ -z "$BACKUP_TARGET" ]; then
  echo -e "${RED}ERROR:${NC} Specify --latest or a backup name."
  echo "  List available backups: bash scripts/verify-backup.sh"
  exit 1
fi

echo ""
echo -e "${RED}${BOLD}=== Colophony Disaster Recovery Restore ===${NC}"
echo ""
echo -e "${CYAN}Backup target:${NC}  $BACKUP_TARGET"
[ -n "$PITR_TIMESTAMP" ] && echo -e "${CYAN}PITR target:${NC}    $PITR_TIMESTAMP"
echo -e "${CYAN}Container:${NC}      $CONTAINER"
echo -e "${CYAN}Compose file:${NC}   $COMPOSE_FILE"
echo ""

if ! $CONFIRMED && ! $DRY_RUN; then
  echo -e "${RED}${BOLD}WARNING: This is a DESTRUCTIVE operation.${NC}"
  echo "  It will stop all services, replace the database, and restart."
  echo "  Run with --confirm to proceed, or --dry-run to preview."
  exit 1
fi

COMPOSE_CMD="docker compose --env-file $ENV_FILE -f $COMPOSE_FILE"
PGDATA="/var/lib/postgresql/data"

step() { echo ""; echo -e "${BOLD}Step $1: $2${NC}"; }

if $DRY_RUN; then
  echo -e "${YELLOW}DRY RUN — no changes will be made${NC}"
  echo ""
  echo "Would execute:"
  echo "  1. Stop API + Web services"
  echo "  2. Stop PostgreSQL"
  echo "  3. Backup current PGDATA to ${PGDATA}.bak"
  if [ "$BACKUP_TARGET" = "LATEST" ]; then
    echo "  4. wal-g backup-fetch $PGDATA LATEST"
  else
    echo "  4. wal-g backup-fetch $PGDATA $BACKUP_TARGET"
  fi
  if [ -n "$PITR_TIMESTAMP" ]; then
    echo "  5. Configure PITR recovery_target_time='$PITR_TIMESTAMP'"
  fi
  echo "  6. Start PostgreSQL (recovery)"
  echo "  7. Health check + RLS verification"
  echo "  8. Start API + Web"
  echo ""
  echo "Current backups:"
  docker exec "$CONTAINER" wal-g backup-list 2>/dev/null || echo "  (container not running or no backups)"
  exit 0
fi

# Step 1: Stop application services
step 1 "Stopping API and Web services..."
$COMPOSE_CMD stop api web 2>/dev/null || true

# Step 2: Stop PostgreSQL
step 2 "Stopping PostgreSQL..."
# Get current PGDATA backup before stopping
docker exec "$CONTAINER" sh -c "cp -r $PGDATA ${PGDATA}.pre-restore-$(date +%Y%m%d%H%M%S)" 2>/dev/null || true
$COMPOSE_CMD stop postgres

# Step 3: Restore from backup
step 3 "Restoring from WAL-G backup..."

# Start postgres container in recovery mode (no server, just filesystem access)
$COMPOSE_CMD run --rm --no-deps -u postgres --entrypoint sh postgres -c "
  set -e
  # Source env vars
  . /env.sh 2>/dev/null || true

  # Clear existing data
  rm -rf ${PGDATA}/*

  # Fetch backup
  if [ '$BACKUP_TARGET' = 'LATEST' ]; then
    echo 'Fetching LATEST backup...'
    wal-g backup-fetch $PGDATA LATEST
  else
    echo 'Fetching backup: $BACKUP_TARGET'
    wal-g backup-fetch $PGDATA '$BACKUP_TARGET'
  fi
  echo 'Backup fetched successfully.'

  # Configure PITR if requested
  if [ -n '$PITR_TIMESTAMP' ]; then
    echo \"Configuring PITR target: $PITR_TIMESTAMP\"
    cat >> ${PGDATA}/postgresql.auto.conf <<PITR
restore_command = 'wal-g wal-fetch %f %p'
recovery_target_time = '$PITR_TIMESTAMP'
recovery_target_action = 'promote'
PITR
    touch ${PGDATA}/recovery.signal
  else
    # Full restore — recover all available WAL
    cat >> ${PGDATA}/postgresql.auto.conf <<FULL
restore_command = 'wal-g wal-fetch %f %p'
recovery_target_action = 'promote'
FULL
    touch ${PGDATA}/recovery.signal
  fi
"

# Step 4: Start PostgreSQL (will enter recovery)
step 4 "Starting PostgreSQL (recovery mode)..."
$COMPOSE_CMD up -d postgres

# Wait for postgres to become healthy
echo "  Waiting for PostgreSQL to complete recovery..."
RETRIES=0
MAX_RETRIES=60
while [ $RETRIES -lt $MAX_RETRIES ]; do
  if $COMPOSE_CMD exec postgres pg_isready -U "${POSTGRES_USER:-colophony}" >/dev/null 2>&1; then
    echo -e "  ${GREEN}PostgreSQL is ready.${NC}"
    break
  fi
  RETRIES=$((RETRIES + 1))
  sleep 5
done

if [ $RETRIES -eq $MAX_RETRIES ]; then
  echo -e "  ${RED}ERROR: PostgreSQL did not become ready after $((MAX_RETRIES * 5)) seconds.${NC}"
  echo "  Check logs: $COMPOSE_CMD logs postgres"
  exit 1
fi

# Step 5: Verify RLS
step 5 "Verifying RLS enforcement..."
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
if [ -f "$SCRIPT_DIR/verify-rls.sh" ]; then
  bash "$SCRIPT_DIR/verify-rls.sh" --structural-only || {
    echo -e "  ${YELLOW}WARNING: RLS verification failed after restore. Review before starting app.${NC}"
  }
else
  echo -e "  ${YELLOW}WARNING: verify-rls.sh not found, skipping RLS check${NC}"
fi

# Step 6: Start application services
step 6 "Starting API and Web services..."
$COMPOSE_CMD up -d api web

echo ""
echo -e "${GREEN}${BOLD}=== Restore complete ===${NC}"
echo ""
echo "Post-restore checklist:"
echo "  1. Verify application health: curl http://localhost/health"
echo "  2. Verify data integrity: spot-check recent records"
echo "  3. Check backup schedule: docker exec $CONTAINER crontab -l -u postgres"
if [ -n "$PITR_TIMESTAMP" ]; then
  echo "  4. PITR was used — verify the recovery stopped at the expected point"
fi
