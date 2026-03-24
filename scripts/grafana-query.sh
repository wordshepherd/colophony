#!/usr/bin/env bash
# Query Loki for logs or AlertManager for firing alerts.
# Usage: bash scripts/grafana-query.sh <logs|alerts> [OPTIONS]
#
# Examples:
#   bash scripts/grafana-query.sh logs --query '{service="api"} |= "error"' --since 1h
#   bash scripts/grafana-query.sh alerts
set -euo pipefail

# --- Colors ---
BOLD='\033[1m'
GREEN='\033[0;32m'
YELLOW='\033[0;33m'
RED='\033[0;31m'
CYAN='\033[0;36m'
NC='\033[0m'

LOKI_URL="http://localhost:3100"
ALERTMANAGER_URL="http://localhost:9093"
QUERY='{service=~".+"}'
SINCE="1h"
LIMIT=100
JSON_MODE=false
SUBCOMMAND=""

usage() {
  echo "Usage: bash scripts/grafana-query.sh <logs|alerts> [OPTIONS]"
  echo ""
  echo "Subcommands:"
  echo "  logs      Search logs via Loki"
  echo "  alerts    List firing alerts from AlertManager"
  echo ""
  echo "Options (logs):"
  echo "  --query <LogQL>          LogQL query (default: '{service=~\".+\"}')"
  echo "  --since <duration>       Time range: 15m, 1h, 6h, 1d, 7d (default: 1h)"
  echo "  --limit <N>              Max results (default: 100)"
  echo "  --loki-url <url>         Loki URL (default: http://localhost:3100)"
  echo "  --json                   Raw JSON output"
  echo ""
  echo "Options (alerts):"
  echo "  --alertmanager-url <url> AlertManager URL (default: http://localhost:9093)"
  echo "  --json                   Raw JSON output"
  echo ""
  echo "  -h, --help               Show this help"
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

# Convert duration string to seconds
parse_duration() {
  local dur="$1"
  case "$dur" in
    *d) echo $(( ${dur%d} * 86400 )) ;;
    *h) echo $(( ${dur%h} * 3600 )) ;;
    *m) echo $(( ${dur%m} * 60 )) ;;
    *s) echo "${dur%s}" ;;
    *)  echo -e "${RED}ERROR: Invalid duration '${dur}'. Use 15m, 1h, 6h, 1d, 7d${NC}" >&2; exit 1 ;;
  esac
}

# Colorize log level
colorize_level() {
  local level="$1"
  case "$level" in
    error|fatal|panic) echo -e "${RED}${level}${NC}" ;;
    warn|warning)      echo -e "${YELLOW}${level}${NC}" ;;
    info)              echo -e "${CYAN}${level}${NC}" ;;
    debug|trace)       echo "${level}" ;;
    *)                 echo "${level}" ;;
  esac
}

# --- Parse subcommand ---
if [ $# -eq 0 ]; then
  usage
fi

SUBCOMMAND="$1"
shift

case "$SUBCOMMAND" in
  logs|alerts) ;;
  -h|--help) usage ;;
  *) echo "Unknown subcommand: $SUBCOMMAND" >&2; usage ;;
esac

# --- Parse flags ---
while [ $# -gt 0 ]; do
  case "$1" in
    --query)
      QUERY="${2:?--query requires a value}"
      shift 2
      ;;
    --since)
      SINCE="${2:?--since requires a value}"
      shift 2
      ;;
    --limit)
      LIMIT="${2:?--limit requires a value}"
      shift 2
      ;;
    --loki-url)
      LOKI_URL="${2:?--loki-url requires a value}"
      shift 2
      ;;
    --alertmanager-url)
      ALERTMANAGER_URL="${2:?--alertmanager-url requires a value}"
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
# LOGS
# =============================================================================
if [ "$SUBCOMMAND" = "logs" ]; then
  DURATION_SECS=$(parse_duration "$SINCE")
  NOW=$(date +%s)
  START_NS=$(( (NOW - DURATION_SECS) * 1000000000 ))

  # URL-encode the query
  ENCODED_QUERY=$(printf '%s' "$QUERY" | jq -sRr @uri)

  ENDPOINT="${LOKI_URL%/}/loki/api/v1/query_range?query=${ENCODED_QUERY}&start=${START_NS}&limit=${LIMIT}&direction=backward"

  RESPONSE=$(curl -sf --max-time 30 "$ENDPOINT" 2>/dev/null) || {
    echo -e "${RED}ERROR: Failed to reach Loki at ${LOKI_URL}${NC}" >&2
    echo -e "Is the monitoring stack running? Start with: docker compose --profile monitoring up -d" >&2
    exit 1
  }

  STATUS=$(echo "$RESPONSE" | jq -r '.status // "error"')
  if [ "$STATUS" != "success" ]; then
    echo -e "${RED}ERROR: Loki query failed: $(echo "$RESPONSE" | jq -r '.message // .error // "unknown error"')${NC}" >&2
    exit 1
  fi

  if [ "$JSON_MODE" = true ]; then
    echo "$RESPONSE" | jq .
    exit 0
  fi

  RESULT_COUNT=$(echo "$RESPONSE" | jq '[.data.result[].values[]] | length')
  echo -e "${BOLD}Loki Logs${NC} — query: ${CYAN}${QUERY}${NC} — since: ${SINCE} — ${RESULT_COUNT} entries"
  echo ""

  if [ "$RESULT_COUNT" -eq 0 ]; then
    echo -e "${YELLOW}No log entries found for this query and time range.${NC}"
    exit 0
  fi

  # Extract and format log entries
  echo "$RESPONSE" | jq -r '
    [.data.result[] | .stream as $stream | .values[] |
      { ts: .[0], line: .[1], stream: $stream }
    ] | sort_by(.ts) | reverse | .[] |
    "\(.ts)\t\(.line)"
  ' | while IFS=$'\t' read -r ts line; do
    # Convert nanosecond timestamp to readable format
    ts_sec=${ts:0:10}
    ts_fmt=$(date -d "@${ts_sec}" '+%H:%M:%S' 2>/dev/null || echo "$ts_sec")

    # Try to extract level from JSON log line
    level=$(echo "$line" | jq -r '.level // .severity // empty' 2>/dev/null || true)
    msg=$(echo "$line" | jq -r '.msg // .message // empty' 2>/dev/null || true)

    if [ -n "$msg" ]; then
      level_colored=$(colorize_level "${level:-info}")
      printf "%s  %-7b  %s\n" "$ts_fmt" "$level_colored" "$msg"
    else
      # Plain text log line
      printf "%s  %s\n" "$ts_fmt" "$line"
    fi
  done

  exit 0
fi

# =============================================================================
# ALERTS
# =============================================================================
if [ "$SUBCOMMAND" = "alerts" ]; then
  ENDPOINT="${ALERTMANAGER_URL%/}/api/v2/alerts"

  RESPONSE=$(curl -sf --max-time 10 "$ENDPOINT" 2>/dev/null) || {
    echo -e "${RED}ERROR: Failed to reach AlertManager at ${ALERTMANAGER_URL}${NC}" >&2
    echo -e "Is the monitoring stack running? Start with: docker compose --profile monitoring up -d" >&2
    exit 1
  }

  if [ "$JSON_MODE" = true ]; then
    echo "$RESPONSE" | jq .
    exit 0
  fi

  # Filter to firing alerts (active, not silenced/inhibited)
  FIRING=$(echo "$RESPONSE" | jq '[.[] | select(.status.state == "active")]')
  COUNT=$(echo "$FIRING" | jq 'length')

  echo -e "${BOLD}AlertManager Alerts${NC} — ${ALERTMANAGER_URL}"
  echo ""

  if [ "$COUNT" -eq 0 ]; then
    echo -e "${GREEN}✓ No active alerts${NC}"
    exit 0
  fi

  echo -e "${RED}${COUNT} active alert(s)${NC}"
  echo ""
  printf "%-12s %-30s %-40s %s\n" "Severity" "Alert" "Summary" "Since"
  printf "%-12s %-30s %-40s %s\n" "--------" "-----" "-------" "-----"

  echo "$FIRING" | jq -c '.[]' | while IFS= read -r alert; do
    name=$(echo "$alert" | jq -r '.labels.alertname // "unknown"')
    severity=$(echo "$alert" | jq -r '.labels.severity // "unknown"')
    summary=$(echo "$alert" | jq -r '.annotations.summary // .annotations.description // "—"')
    starts_at=$(echo "$alert" | jq -r '.startsAt // empty')

    # Truncate summary
    if [ ${#summary} -gt 38 ]; then
      summary="${summary:0:35}..."
    fi

    # Format severity with color
    case "$severity" in
      critical) sev_fmt="${RED}${severity}${NC}" ;;
      warning)  sev_fmt="${YELLOW}${severity}${NC}" ;;
      *)        sev_fmt="${severity}" ;;
    esac

    # Format start time
    if [ -n "$starts_at" ]; then
      since_fmt=$(date -d "$starts_at" '+%Y-%m-%d %H:%M' 2>/dev/null || echo "$starts_at")
    else
      since_fmt="—"
    fi

    printf "%-12b %-30s %-40s %s\n" "$sev_fmt" "$name" "$summary" "$since_fmt"
  done

  echo ""
  exit 1  # Non-zero when alerts are firing
fi
