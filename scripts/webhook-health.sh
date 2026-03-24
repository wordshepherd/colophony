#!/usr/bin/env bash
# Check webhook provider health via the /webhooks/health endpoint.
# Usage: bash scripts/webhook-health.sh [--url <base-url>] [--json] [--quiet]
#
# Exit:  0 = all healthy, 1 = at least one stale/unknown or request failed.
set -euo pipefail

# --- Colors ---
BOLD='\033[1m'
GREEN='\033[0;32m'
YELLOW='\033[0;33m'
RED='\033[0;31m'
CYAN='\033[0;36m'
NC='\033[0m'

BASE_URL="http://localhost:4000"
JSON_MODE=false
QUIET_MODE=false

usage() {
  echo "Usage: bash scripts/webhook-health.sh [OPTIONS]"
  echo ""
  echo "Query the /webhooks/health endpoint and display provider status."
  echo ""
  echo "Options:"
  echo "  --url <base-url>  API base URL (default: http://localhost:4000)"
  echo "  --json            Output raw JSON response"
  echo "  --quiet           No output — exit code only"
  echo "  -h, --help        Show this help"
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

# Convert seconds to human-readable relative time
human_time() {
  local secs=$1
  if [ "$secs" -lt 60 ]; then
    echo "${secs}s ago"
  elif [ "$secs" -lt 3600 ]; then
    echo "$((secs / 60))m ago"
  elif [ "$secs" -lt 86400 ]; then
    local h=$((secs / 3600))
    local m=$(( (secs % 3600) / 60 ))
    if [ "$m" -gt 0 ]; then
      echo "${h}h ${m}m ago"
    else
      echo "${h}h ago"
    fi
  else
    local d=$((secs / 86400))
    local h=$(( (secs % 86400) / 3600 ))
    if [ "$h" -gt 0 ]; then
      echo "${d}d ${h}h ago"
    else
      echo "${d}d ago"
    fi
  fi
}

# --- Parse args ---
while [ $# -gt 0 ]; do
  case "$1" in
    --url)
      BASE_URL="${2:?--url requires a value}"
      shift 2
      ;;
    --json)
      JSON_MODE=true
      shift
      ;;
    --quiet)
      QUIET_MODE=true
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

# --- Fetch health data ---
ENDPOINT="${BASE_URL%/}/webhooks/health"
RESPONSE=$(curl -sf --max-time 10 "$ENDPOINT" 2>/dev/null) || {
  if [ "$QUIET_MODE" = true ]; then
    exit 1
  fi
  echo -e "${RED}ERROR: Failed to reach ${ENDPOINT}${NC}" >&2
  exit 1
}

# --- JSON mode ---
if [ "$JSON_MODE" = true ]; then
  echo "$RESPONSE" | jq .
  # Exit 1 if any non-healthy provider
  HAS_ISSUES=$(echo "$RESPONSE" | jq -r '[.providers[] | select(.status != "healthy")] | length')
  [ "$HAS_ISSUES" -gt 0 ] && exit 1
  exit 0
fi

# --- Quiet mode ---
if [ "$QUIET_MODE" = true ]; then
  HAS_ISSUES=$(echo "$RESPONSE" | jq -r '[.providers[] | select(.status != "healthy")] | length')
  [ "$HAS_ISSUES" -gt 0 ] && exit 1
  exit 0
fi

# --- Formatted output ---
echo -e "${BOLD}Webhook Health${NC} — ${ENDPOINT}"
echo ""
printf "%-14s %-14s %-22s %s\n" "Provider" "Status" "Last Event" "Freshness"
printf "%-14s %-14s %-22s %s\n" "--------" "------" "----------" "---------"

HAS_ISSUES=0
echo "$RESPONSE" | jq -c '.providers[]' | while IFS= read -r provider; do
  name=$(echo "$provider" | jq -r '.provider')
  status=$(echo "$provider" | jq -r '.status')
  last_at=$(echo "$provider" | jq -r '.lastReceivedAt // empty')
  freshness=$(echo "$provider" | jq -r '.freshnessSeconds // empty')

  # Format status with color
  case "$status" in
    healthy)  status_fmt="${GREEN}✓ healthy${NC}"  ;;
    stale)    status_fmt="${YELLOW}⚠ stale${NC}"    ;;
    *)        status_fmt="${RED}❌ unknown${NC}"    ;;
  esac

  # Format last event timestamp
  if [ -n "$last_at" ] && [ "$last_at" != "null" ]; then
    last_fmt=$(date -d "$last_at" '+%Y-%m-%d %H:%M' 2>/dev/null || echo "$last_at")
  else
    last_fmt="—"
  fi

  # Format freshness
  if [ -n "$freshness" ] && [ "$freshness" != "null" ]; then
    fresh_int=${freshness%.*}
    fresh_fmt=$(human_time "$fresh_int")
  else
    fresh_fmt="—"
  fi

  printf "%-14s %-14b %-22s %s\n" "$name" "$status_fmt" "$last_fmt" "$fresh_fmt"

  if [ "$status" != "healthy" ]; then
    # Signal issues via temp file (subshell limitation)
    echo 1 > /tmp/.webhook-health-issues
  fi
done

echo ""

# Check for issues (written by subshell)
if [ -f /tmp/.webhook-health-issues ]; then
  rm -f /tmp/.webhook-health-issues
  exit 1
fi
exit 0
