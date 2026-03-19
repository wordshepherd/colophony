#!/bin/bash
# Colophony Credential Rotation Script
# Usage: bash scripts/rotate-secrets.sh [--all | credential...] [--dry-run]
#
# Supported credentials:
#   postgres-password    ALTER ROLE colophony + update .env.prod
#   app-user-password    ALTER ROLE app_user + update .env.prod
#   redis-password       Update .env.prod (restart applies it)
#   minio-credentials    Update MINIO_ROOT_USER + MINIO_ROOT_PASSWORD in .env.prod
#   tus-hook-secret      Update .env.prod
#
# Flags:
#   --all       Rotate all self-managed credentials
#   --dry-run   Preview changes without applying them
#
# After rotation, restart affected services:
#   docker compose --env-file .env.prod -f docker-compose.prod.yml restart
set -e

BOLD='\033[1m'
GREEN='\033[0;32m'
YELLOW='\033[0;33m'
RED='\033[0;31m'
CYAN='\033[0;36m'
NC='\033[0m'

ENV_FILE=".env.prod"
DRY_RUN=false
CREDENTIALS=()

ALL_CREDENTIALS=(
  postgres-password
  app-user-password
  redis-password
  minio-credentials
  tus-hook-secret
)

# --- Argument parsing ---

usage() {
  echo "Usage: bash scripts/rotate-secrets.sh [--all | credential...] [--dry-run]"
  echo ""
  echo "Credentials: ${ALL_CREDENTIALS[*]}"
  echo "Flags: --all (all credentials), --dry-run (preview only)"
  exit 1
}

if [ $# -eq 0 ]; then
  usage
fi

while [ $# -gt 0 ]; do
  case "$1" in
    --dry-run)
      DRY_RUN=true
      shift
      ;;
    --all)
      CREDENTIALS=("${ALL_CREDENTIALS[@]}")
      shift
      ;;
    --help|-h)
      usage
      ;;
    -*)
      echo -e "${RED}ERROR: Unknown flag: $1${NC}"
      usage
      ;;
    *)
      # Validate credential name
      valid=false
      for c in "${ALL_CREDENTIALS[@]}"; do
        if [ "$1" = "$c" ]; then
          valid=true
          break
        fi
      done
      if [ "$valid" = false ]; then
        echo -e "${RED}ERROR: Unknown credential: $1${NC}"
        echo "Valid credentials: ${ALL_CREDENTIALS[*]}"
        exit 1
      fi
      CREDENTIALS+=("$1")
      shift
      ;;
  esac
done

if [ ${#CREDENTIALS[@]} -eq 0 ]; then
  echo -e "${RED}ERROR: No credentials specified. Use --all or name specific credentials.${NC}"
  usage
fi

# --- Validation ---

echo -e "${BOLD}======================================${NC}"
echo -e "${BOLD}  Colophony Credential Rotation${NC}"
echo -e "${BOLD}======================================${NC}"
echo ""

if [ "$DRY_RUN" = true ]; then
  echo -e "${YELLOW}DRY RUN — no changes will be made${NC}"
  echo ""
fi

if [ ! -f "$ENV_FILE" ]; then
  echo -e "${RED}ERROR: ${ENV_FILE} not found.${NC}"
  echo "This script must be run from the project root."
  exit 1
fi

if ! command -v openssl &> /dev/null; then
  echo -e "${RED}ERROR: openssl is not installed (needed for secret generation).${NC}"
  exit 1
fi

echo -e "${BOLD}Credentials to rotate:${NC}"
for cred in "${CREDENTIALS[@]}"; do
  echo -e "  ${CYAN}•${NC} $cred"
done
echo ""

# --- Backup ---

BACKUP="${ENV_FILE}.backup.$(date +%Y%m%d%H%M%S)"

if [ "$DRY_RUN" = false ]; then
  cp "$ENV_FILE" "$BACKUP"
  chmod 600 "$BACKUP"
  echo -e "${GREEN}Backup created:${NC} $BACKUP"
else
  echo -e "${YELLOW}Would create backup:${NC} $BACKUP"
fi
echo ""

# --- Helper functions ---

generate_password() {
  openssl rand -base64 48 | tr -d '=/+' | head -c 48
}

generate_hex() {
  openssl rand -hex "$1"
}

update_env_var() {
  local var_name="$1"
  local new_value="$2"

  if [ "$DRY_RUN" = true ]; then
    echo -e "  ${YELLOW}Would update${NC} ${var_name}=${new_value:0:8}..."
    return
  fi

  # Use | as delimiter — base64 passwords won't contain |
  if grep -q "^${var_name}=" "$ENV_FILE"; then
    sed -i "s|^${var_name}=.*|${var_name}=${new_value}|" "$ENV_FILE"
    echo -e "  ${GREEN}Updated${NC} ${var_name}"
  else
    echo -e "  ${RED}WARNING: ${var_name} not found in ${ENV_FILE} — skipped${NC}"
  fi
}

alter_role() {
  local role_name="$1"
  local new_password="$2"

  if [ "$DRY_RUN" = true ]; then
    echo -e "  ${YELLOW}Would run:${NC} ALTER ROLE ${role_name} PASSWORD '***'"
    return
  fi

  # Check container is running (not just exists) — docker inspect succeeds for stopped containers
  local container_status
  container_status=$(docker inspect --format='{{.State.Running}}' colophony-postgres 2>/dev/null || echo "false")

  if [ "$container_status" != "true" ]; then
    echo -e "  ${RED}WARNING: colophony-postgres container not running — skipping ALTER ROLE${NC}"
    echo -e "  ${YELLOW}Password updated in ${ENV_FILE}. Run ALTER ROLE manually after starting the container.${NC}"
    return
  fi

  # Read POSTGRES_USER and POSTGRES_DB from .env.prod (respect overrides)
  local pg_user pg_db
  pg_user=$(grep "^POSTGRES_USER=" "$ENV_FILE" 2>/dev/null | cut -d= -f2)
  pg_user=${pg_user:-colophony}
  pg_db=$(grep "^POSTGRES_DB=" "$ENV_FILE" 2>/dev/null | cut -d= -f2)
  pg_db=${pg_db:-colophony}

  docker exec colophony-postgres psql -U "$pg_user" -d "$pg_db" -c \
    "ALTER ROLE ${role_name} WITH PASSWORD '${new_password}';" > /dev/null 2>&1

  echo -e "  ${GREEN}ALTER ROLE ${role_name}${NC} applied"
}

# --- Rotation ---

ROTATED=()
NEEDS_RESTART=()

for cred in "${CREDENTIALS[@]}"; do
  echo -e "${BOLD}Rotating: ${cred}${NC}"

  case "$cred" in
    postgres-password)
      NEW_PASS=$(generate_password)
      alter_role "colophony" "$NEW_PASS"
      update_env_var "POSTGRES_PASSWORD" "$NEW_PASS"
      ROTATED+=("postgres-password")
      NEEDS_RESTART+=(pgbouncer api migrate)
      ;;

    app-user-password)
      NEW_PASS=$(generate_password)
      alter_role "app_user" "$NEW_PASS"
      update_env_var "APP_USER_PASSWORD" "$NEW_PASS"
      ROTATED+=("app-user-password")
      NEEDS_RESTART+=(pgbouncer api)
      ;;

    redis-password)
      NEW_PASS=$(generate_password)
      update_env_var "REDIS_PASSWORD" "$NEW_PASS"
      ROTATED+=("redis-password")
      NEEDS_RESTART+=(redis api)
      ;;

    minio-credentials)
      NEW_USER=$(generate_hex 16)
      NEW_PASS=$(generate_password)
      update_env_var "MINIO_ROOT_USER" "$NEW_USER"
      update_env_var "MINIO_ROOT_PASSWORD" "$NEW_PASS"
      ROTATED+=("minio-credentials")
      NEEDS_RESTART+=(minio minio-setup api tusd)
      ;;

    tus-hook-secret)
      NEW_SECRET=$(generate_hex 32)
      update_env_var "TUS_HOOK_SECRET" "$NEW_SECRET"
      ROTATED+=("tus-hook-secret")
      NEEDS_RESTART+=(api tusd)
      ;;
  esac

  echo ""
done

# --- Summary ---

echo -e "${BOLD}======================================${NC}"
echo -e "${BOLD}  Rotation Summary${NC}"
echo -e "${BOLD}======================================${NC}"
echo ""

echo -e "${BOLD}Rotated:${NC}"
for cred in "${ROTATED[@]}"; do
  echo -e "  ${GREEN}✓${NC} $cred"
done
echo ""

if [ "$DRY_RUN" = false ]; then
  echo -e "${BOLD}Backup:${NC} $BACKUP"
  echo ""
fi

# Deduplicate restart list
UNIQUE_RESTART=($(printf '%s\n' "${NEEDS_RESTART[@]}" | sort -u))

echo -e "${BOLD}Restart required:${NC}"
echo -e "  ${CYAN}docker compose --env-file .env.prod -f docker-compose.prod.yml restart ${UNIQUE_RESTART[*]}${NC}"
echo ""

if [ "$DRY_RUN" = true ]; then
  echo -e "${YELLOW}DRY RUN complete — no changes were made.${NC}"
else
  echo -e "${YELLOW}NOTE: Containers have NOT been restarted.${NC}"
  echo "Run the restart command above to apply the new credentials."
  echo ""
  echo "Verify health after restart:"
  echo -e "  ${CYAN}docker compose --env-file .env.prod -f docker-compose.prod.yml ps${NC}"
fi
