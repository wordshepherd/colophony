#!/bin/bash
# Colophony Backup Verification Script
# Lists and verifies WAL-G backups for integrity and WAL chain continuity.
#
# Usage: bash scripts/verify-backup.sh [--json]
# Exit:  0 = healthy, 1 = issues found.
set -e

BOLD='\033[1m'
GREEN='\033[0;32m'
YELLOW='\033[0;33m'
RED='\033[0;31m'
CYAN='\033[0;36m'
NC='\033[0m'

JSON_MODE=false
CONTAINER="${POSTGRES_CONTAINER:-colophony-postgres}"

for arg in "$@"; do
  case "$arg" in
    --json) JSON_MODE=true ;;
    *) echo "Usage: bash scripts/verify-backup.sh [--json]"; exit 1 ;;
  esac
done

# Verify postgres container is running
if ! docker ps --format '{{.Names}}' | grep -q "^${CONTAINER}$"; then
  echo -e "${RED}ERROR:${NC} PostgreSQL container '${CONTAINER}' is not running." >&2
  exit 1
fi

# Verify WAL-G is configured
WALG_PREFIX=$(docker exec "$CONTAINER" sh -c 'echo $WALG_S3_PREFIX' 2>/dev/null || echo "")
if [ -z "$WALG_PREFIX" ]; then
  echo -e "${RED}ERROR:${NC} WALG_S3_PREFIX is not set. Backups are not configured." >&2
  exit 1
fi

ISSUES=0

if $JSON_MODE; then
  # Machine-readable output
  BACKUP_LIST=$(docker exec "$CONTAINER" wal-g backup-list --json 2>/dev/null || echo "[]")
  BACKUP_COUNT=$(echo "$BACKUP_LIST" | grep -c '"backup_name"' || echo "0")

  if [ "$BACKUP_COUNT" -lt 1 ]; then
    echo '{"status":"error","message":"No backups found","backups":[]}'
    exit 1
  fi

  # WAL verification
  WAL_VERIFY=$(docker exec "$CONTAINER" wal-g wal-verify integrity 2>&1 || true)
  WAL_STATUS="ok"
  if echo "$WAL_VERIFY" | grep -qi "error\|gap\|missing"; then
    WAL_STATUS="issues_found"
    ISSUES=1
  fi

  echo "{\"status\":\"${WAL_STATUS}\",\"backup_count\":${BACKUP_COUNT},\"s3_prefix\":\"${WALG_PREFIX}\",\"backups\":${BACKUP_LIST}}"
  exit $ISSUES
fi

# Human-readable output
echo ""
echo -e "${BOLD}=== Colophony Backup Verification ===${NC}"
echo -e "${CYAN}S3 prefix:${NC} $WALG_PREFIX"
echo ""

# List backups
echo -e "${BOLD}Base Backups:${NC}"
BACKUP_OUTPUT=$(docker exec "$CONTAINER" wal-g backup-list 2>/dev/null || echo "")

if [ -z "$BACKUP_OUTPUT" ]; then
  echo -e "  ${RED}No backups found${NC}"
  ISSUES=1
else
  echo "$BACKUP_OUTPUT"
  echo ""

  # Count backups (subtract header line)
  BACKUP_COUNT=$(echo "$BACKUP_OUTPUT" | wc -l)
  BACKUP_COUNT=$((BACKUP_COUNT - 1))
  [ "$BACKUP_COUNT" -lt 0 ] && BACKUP_COUNT=0

  echo -e "${CYAN}Total backups:${NC} $BACKUP_COUNT"

  if [ "$BACKUP_COUNT" -lt 1 ]; then
    echo -e "  ${RED}WARNING: No base backups found${NC}"
    ISSUES=1
  fi
fi

# WAL chain verification
echo ""
echo -e "${BOLD}WAL Chain Verification:${NC}"
WAL_VERIFY=$(docker exec "$CONTAINER" wal-g wal-verify integrity 2>&1 || true)

if echo "$WAL_VERIFY" | grep -qi "error\|gap\|missing"; then
  echo -e "  ${RED}Issues detected in WAL chain:${NC}"
  echo "$WAL_VERIFY" | head -20
  ISSUES=1
else
  echo -e "  ${GREEN}WAL chain is continuous${NC}"
  if $VERBOSE 2>/dev/null; then
    echo "$WAL_VERIFY"
  fi
fi

# Summary
echo ""
if [ "$ISSUES" -eq 0 ]; then
  echo -e "${GREEN}${BOLD}=== Backup verification passed ===${NC}"
  exit 0
else
  echo -e "${RED}${BOLD}=== Backup verification found issues ===${NC}"
  exit 1
fi
