#!/usr/bin/env bash
# Common Zitadel admin queries via the Management/Admin API.
# Usage: bash scripts/zitadel-admin.sh <status|users|orgs|sessions> [OPTIONS]
#
# Examples:
#   bash scripts/zitadel-admin.sh status
#   bash scripts/zitadel-admin.sh users --limit 10
#   bash scripts/zitadel-admin.sh orgs --json
#   bash scripts/zitadel-admin.sh sessions
set -euo pipefail

# --- Colors ---
BOLD='\033[1m'
GREEN='\033[0;32m'
YELLOW='\033[0;33m'
RED='\033[0;31m'
CYAN='\033[0;36m'
NC='\033[0m'

AUTHORITY="${ZITADEL_AUTHORITY:-http://localhost:8080}"
TOKEN=""
LIMIT=20
JSON_MODE=false
SUBCOMMAND=""

# Default PAT file location for local dev
PAT_FILE=".docker/zitadel/machinekey/admin.pat"

usage() {
  echo "Usage: bash scripts/zitadel-admin.sh <status|users|orgs|sessions> [OPTIONS]"
  echo ""
  echo "Subcommands:"
  echo "  status     Check Zitadel health"
  echo "  users      List users"
  echo "  orgs       List organizations"
  echo "  sessions   List active sessions"
  echo ""
  echo "Options:"
  echo "  --authority <url>   Zitadel URL (default: \$ZITADEL_AUTHORITY or http://localhost:8080)"
  echo "  --token <token>     Service account PAT (default: \$ZITADEL_SERVICE_TOKEN or .docker/zitadel/machinekey/admin.pat)"
  echo "  --limit <N>         Max results for list commands (default: 20)"
  echo "  --json              Raw JSON output"
  echo "  -h, --help          Show this help"
  exit 1
}

require_deps() {
  for cmd in "$@"; do
    if ! command -v "$cmd" &>/dev/null; then
      echo -e "${RED}ERROR: Required command '${cmd}' not found. Please install it.${NC}" >&2
      exit 1
    fi
  done
}

# Resolve a service token from flags, env, or PAT file
resolve_token() {
  if [ -n "$TOKEN" ]; then
    return
  fi

  if [ -n "${ZITADEL_SERVICE_TOKEN:-}" ]; then
    TOKEN="$ZITADEL_SERVICE_TOKEN"
    return
  fi

  if [ -f "$PAT_FILE" ]; then
    TOKEN=$(cat "$PAT_FILE" | tr -d '[:space:]')
    if [ -n "$TOKEN" ]; then
      return
    fi
  fi

  echo -e "${RED}ERROR: No Zitadel service token found.${NC}" >&2
  echo -e "Provide one via:" >&2
  echo -e "  --token <pat>              Pass directly" >&2
  echo -e "  ZITADEL_SERVICE_TOKEN      Set env var" >&2
  echo -e "  ${PAT_FILE}  Local dev PAT file" >&2
  exit 1
}

# Make an authenticated GET request
zitadel_get() {
  local path="$1"
  curl -sf --max-time 10 \
    -H "Authorization: Bearer ${TOKEN}" \
    -H "Content-Type: application/json" \
    "${AUTHORITY%/}${path}" 2>/dev/null
}

# Make an authenticated POST request
zitadel_post() {
  local path="$1"
  local body="$2"
  curl -sf --max-time 10 \
    -X POST \
    -H "Authorization: Bearer ${TOKEN}" \
    -H "Content-Type: application/json" \
    -d "$body" \
    "${AUTHORITY%/}${path}" 2>/dev/null
}

# --- Parse subcommand ---
if [ $# -eq 0 ]; then
  usage
fi

SUBCOMMAND="$1"
shift

case "$SUBCOMMAND" in
  status|users|orgs|sessions) ;;
  -h|--help) usage ;;
  *) echo "Unknown subcommand: $SUBCOMMAND" >&2; usage ;;
esac

# --- Parse flags ---
while [ $# -gt 0 ]; do
  case "$1" in
    --authority)
      AUTHORITY="${2:?--authority requires a value}"
      shift 2
      ;;
    --token)
      TOKEN="${2:?--token requires a value}"
      shift 2
      ;;
    --limit)
      LIMIT="${2:?--limit requires a value}"
      shift 2
      ;;
    --json)
      JSON_MODE=true
      shift
      ;;
    -h|--help)
      usage
      ;;
    *)
      echo "Unknown option: $1" >&2
      usage
      ;;
  esac
done

require_deps curl jq

# =============================================================================
# STATUS
# =============================================================================
if [ "$SUBCOMMAND" = "status" ]; then
  echo -e "${BOLD}Zitadel Health${NC} — ${AUTHORITY}"
  echo ""

  HEALTH=$(curl -sf --max-time 10 "${AUTHORITY%/}/debug/healthz" 2>/dev/null) && {
    if [ "$JSON_MODE" = true ]; then
      echo "$HEALTH" | jq . 2>/dev/null || echo "$HEALTH"
      exit 0
    fi
    echo -e "${GREEN}✓ Zitadel is healthy${NC}"
    exit 0
  } || {
    if [ "$JSON_MODE" = true ]; then
      echo '{"status":"unreachable"}'
      exit 1
    fi
    echo -e "${RED}❌ Zitadel is unreachable at ${AUTHORITY}${NC}"
    echo -e "Is Zitadel running? Start with: pnpm docker:up" >&2
    exit 1
  }
fi

# --- Remaining commands need a token ---
resolve_token

# =============================================================================
# USERS
# =============================================================================
if [ "$SUBCOMMAND" = "users" ]; then
  RESPONSE=$(zitadel_post "/v2/users" "{\"queries\":[],\"limit\":${LIMIT}}") || {
    echo -e "${RED}ERROR: Failed to list users from ${AUTHORITY}${NC}" >&2
    exit 1
  }

  if [ "$JSON_MODE" = true ]; then
    echo "$RESPONSE" | jq .
    exit 0
  fi

  echo -e "${BOLD}Zitadel Users${NC} — ${AUTHORITY}"
  echo ""

  COUNT=$(echo "$RESPONSE" | jq '.result | length // 0')
  if [ "$COUNT" -eq 0 ]; then
    echo -e "${YELLOW}No users found.${NC}"
    exit 0
  fi

  printf "%-26s  %-30s  %-30s  %-10s\n" "User ID" "Username" "Email" "State"
  printf "%-26s  %-30s  %-30s  %-10s\n" "-------" "--------" "-----" "-----"

  echo "$RESPONSE" | jq -c '.result[]' | while IFS= read -r user; do
    id=$(echo "$user" | jq -r '.userId // .id // "—"')
    username=$(echo "$user" | jq -r '.preferredLoginName // .username // "—"')
    email=$(echo "$user" | jq -r '.human.email.email // .email // "—"')
    state=$(echo "$user" | jq -r '.state // "—"')

    # Truncate fields
    [ ${#username} -gt 28 ] && username="${username:0:25}..."
    [ ${#email} -gt 28 ] && email="${email:0:25}..."

    printf "%-26s  %-30s  %-30s  %-10s\n" "$id" "$username" "$email" "$state"
  done

  echo ""
  echo -e "${CYAN}${COUNT} user(s)${NC}"
  exit 0
fi

# =============================================================================
# ORGS
# =============================================================================
if [ "$SUBCOMMAND" = "orgs" ]; then
  RESPONSE=$(zitadel_post "/admin/v1/orgs/_search" "{\"queries\":[],\"limit\":${LIMIT}}") || {
    echo -e "${RED}ERROR: Failed to list orgs from ${AUTHORITY}${NC}" >&2
    exit 1
  }

  if [ "$JSON_MODE" = true ]; then
    echo "$RESPONSE" | jq .
    exit 0
  fi

  echo -e "${BOLD}Zitadel Organizations${NC} — ${AUTHORITY}"
  echo ""

  COUNT=$(echo "$RESPONSE" | jq '.result | length // 0')
  if [ "$COUNT" -eq 0 ]; then
    echo -e "${YELLOW}No organizations found.${NC}"
    exit 0
  fi

  printf "%-26s  %-30s  %-10s  %s\n" "Org ID" "Name" "State" "Primary Domain"
  printf "%-26s  %-30s  %-10s  %s\n" "------" "----" "-----" "--------------"

  echo "$RESPONSE" | jq -c '.result[]' | while IFS= read -r org; do
    id=$(echo "$org" | jq -r '.id // "—"')
    name=$(echo "$org" | jq -r '.name // "—"')
    state=$(echo "$org" | jq -r '.state // "—"')
    domain=$(echo "$org" | jq -r '.primaryDomain // "—"')

    [ ${#name} -gt 28 ] && name="${name:0:25}..."

    printf "%-26s  %-30s  %-10s  %s\n" "$id" "$name" "$state" "$domain"
  done

  echo ""
  echo -e "${CYAN}${COUNT} organization(s)${NC}"
  exit 0
fi

# =============================================================================
# SESSIONS
# =============================================================================
if [ "$SUBCOMMAND" = "sessions" ]; then
  RESPONSE=$(zitadel_post "/v2/sessions/search" "{\"queries\":[],\"limit\":${LIMIT}}") || {
    echo -e "${RED}ERROR: Failed to list sessions from ${AUTHORITY}${NC}" >&2
    exit 1
  }

  if [ "$JSON_MODE" = true ]; then
    echo "$RESPONSE" | jq .
    exit 0
  fi

  echo -e "${BOLD}Zitadel Sessions${NC} — ${AUTHORITY}"
  echo ""

  COUNT=$(echo "$RESPONSE" | jq '.sessions | length // 0')
  if [ "$COUNT" -eq 0 ]; then
    echo -e "${YELLOW}No active sessions found.${NC}"
    exit 0
  fi

  printf "%-26s  %-30s  %-22s  %s\n" "Session ID" "User" "Created" "Expiry"
  printf "%-26s  %-30s  %-22s  %s\n" "----------" "----" "-------" "------"

  echo "$RESPONSE" | jq -c '.sessions[]' | while IFS= read -r session; do
    sid=$(echo "$session" | jq -r '.id // "—"')
    user=$(echo "$session" | jq -r '.factors.user.loginName // .factors.user.displayName // "—"')
    created=$(echo "$session" | jq -r '.creationDate // empty')
    expiry=$(echo "$session" | jq -r '.expirationDate // "—"')

    [ ${#user} -gt 28 ] && user="${user:0:25}..."

    if [ -n "$created" ]; then
      created_fmt=$(date -d "$created" '+%Y-%m-%d %H:%M' 2>/dev/null || echo "$created")
    else
      created_fmt="—"
    fi

    if [ "$expiry" != "—" ] && [ -n "$expiry" ]; then
      expiry_fmt=$(date -d "$expiry" '+%Y-%m-%d %H:%M' 2>/dev/null || echo "$expiry")
    else
      expiry_fmt="—"
    fi

    printf "%-26s  %-30s  %-22s  %s\n" "$sid" "$user" "$created_fmt" "$expiry_fmt"
  done

  echo ""
  echo -e "${CYAN}${COUNT} session(s)${NC}"
  exit 0
fi
