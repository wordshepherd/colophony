#!/usr/bin/env bash
# List recent Sentry issues via the Sentry API.
# Usage: bash scripts/sentry-issues.sh [OPTIONS]
#
# Required env vars: SENTRY_AUTH_TOKEN, SENTRY_ORG, SENTRY_PROJECT
#
# Examples:
#   bash scripts/sentry-issues.sh
#   bash scripts/sentry-issues.sh --limit 20 --resolved
#   bash scripts/sentry-issues.sh --json
set -euo pipefail

# --- Colors ---
BOLD='\033[1m'
GREEN='\033[0;32m'
YELLOW='\033[0;33m'
RED='\033[0;31m'
CYAN='\033[0;36m'
NC='\033[0m'

SENTRY_URL="https://sentry.io"
LIMIT=10
INCLUDE_RESOLVED=false
JSON_MODE=false

usage() {
  echo "Usage: bash scripts/sentry-issues.sh [OPTIONS]"
  echo ""
  echo "List recent Sentry issues for the configured project."
  echo ""
  echo "Required environment variables:"
  echo "  SENTRY_AUTH_TOKEN   Sentry API auth token"
  echo "  SENTRY_ORG          Sentry organization slug"
  echo "  SENTRY_PROJECT      Sentry project slug"
  echo ""
  echo "Options:"
  echo "  --limit <N>         Max issues to show (default: 10)"
  echo "  --resolved          Include resolved issues (default: unresolved only)"
  echo "  --json              Raw JSON output"
  echo "  --url <sentry-url>  Sentry base URL (default: https://sentry.io)"
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

require_env() {
  local var_name="$1"
  if [ -z "${!var_name:-}" ]; then
    echo -e "${RED}ERROR: Required environment variable '${var_name}' is not set.${NC}" >&2
    echo -e "Set it in your .env file or export it: export ${var_name}=your_value" >&2
    exit 1
  fi
}

# Convert ISO timestamp to relative time
relative_time() {
  local iso="$1"
  local ts
  ts=$(date -d "$iso" +%s 2>/dev/null || echo "0")
  local now
  now=$(date +%s)
  local diff=$(( now - ts ))

  if [ "$diff" -lt 60 ]; then
    echo "just now"
  elif [ "$diff" -lt 3600 ]; then
    echo "$((diff / 60))m ago"
  elif [ "$diff" -lt 86400 ]; then
    echo "$((diff / 3600))h ago"
  else
    echo "$((diff / 86400))d ago"
  fi
}

# Colorize severity level
format_level() {
  local level="$1"
  case "$level" in
    fatal|error) echo -e "${RED}${level}${NC}" ;;
    warning)     echo -e "${YELLOW}${level}${NC}" ;;
    info)        echo -e "${CYAN}${level}${NC}" ;;
    *)           echo "$level" ;;
  esac
}

# --- Parse args ---
while [ $# -gt 0 ]; do
  case "$1" in
    --limit)
      LIMIT="${2:?--limit requires a value}"
      shift 2
      ;;
    --resolved)
      INCLUDE_RESOLVED=true
      shift
      ;;
    --json)
      JSON_MODE=true
      shift
      ;;
    --url)
      SENTRY_URL="${2:?--url requires a value}"
      shift 2
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
require_env SENTRY_AUTH_TOKEN
require_env SENTRY_ORG
require_env SENTRY_PROJECT

# --- Build API URL ---
QUERY_PARAM="is:unresolved"
if [ "$INCLUDE_RESOLVED" = true ]; then
  QUERY_PARAM=""
fi

API_URL="${SENTRY_URL%/}/api/0/projects/${SENTRY_ORG}/${SENTRY_PROJECT}/issues/?limit=${LIMIT}&sort=date"
if [ -n "$QUERY_PARAM" ]; then
  ENCODED_QUERY=$(printf '%s' "$QUERY_PARAM" | jq -sRr @uri)
  API_URL="${API_URL}&query=${ENCODED_QUERY}"
fi

# --- Fetch issues ---
RESPONSE=$(curl -sf --max-time 15 \
  -H "Authorization: Bearer ${SENTRY_AUTH_TOKEN}" \
  "$API_URL" 2>/dev/null) || {
  echo -e "${RED}ERROR: Failed to fetch Sentry issues.${NC}" >&2
  echo -e "Check SENTRY_AUTH_TOKEN, SENTRY_ORG, and SENTRY_PROJECT values." >&2
  exit 1
}

# --- JSON mode ---
if [ "$JSON_MODE" = true ]; then
  echo "$RESPONSE" | jq .
  exit 0
fi

# --- Formatted output ---
COUNT=$(echo "$RESPONSE" | jq 'length')

echo -e "${BOLD}Sentry Issues${NC} — ${SENTRY_ORG}/${SENTRY_PROJECT}"
if [ "$INCLUDE_RESOLVED" = false ]; then
  echo -e "Filter: unresolved only"
fi
echo ""

if [ "$COUNT" -eq 0 ]; then
  echo -e "${GREEN}✓ No issues found${NC}"
  exit 0
fi

printf "%-8s  %-50s  %6s  %-10s  %s\n" "Level" "Title" "Count" "Last Seen" "Link"
printf "%-8s  %-50s  %6s  %-10s  %s\n" "-----" "-----" "-----" "---------" "----"

echo "$RESPONSE" | jq -c '.[]' | while IFS= read -r issue; do
  level=$(echo "$issue" | jq -r '.level // "unknown"')
  title=$(echo "$issue" | jq -r '.title // "Untitled"')
  count=$(echo "$issue" | jq -r '.count // "0"')
  last_seen=$(echo "$issue" | jq -r '.lastSeen // empty')
  permalink=$(echo "$issue" | jq -r '.permalink // "—"')

  # Truncate title
  if [ ${#title} -gt 48 ]; then
    title="${title:0:45}..."
  fi

  # Format fields
  level_fmt=$(format_level "$level")
  if [ -n "$last_seen" ]; then
    seen_fmt=$(relative_time "$last_seen")
  else
    seen_fmt="—"
  fi

  printf "%-8b  %-50s  %6s  %-10s  %s\n" "$level_fmt" "$title" "$count" "$seen_fmt" "$permalink"
done

echo ""
echo -e "${CYAN}${COUNT} issue(s) shown${NC}"
exit 0
