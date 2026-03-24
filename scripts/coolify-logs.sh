#!/usr/bin/env bash
# Tail and search Docker container logs (local or remote via SSH).
# Usage: bash scripts/coolify-logs.sh <tail|search> [OPTIONS]
#
# Examples:
#   bash scripts/coolify-logs.sh tail api
#   bash scripts/coolify-logs.sh tail --all --follow
#   bash scripts/coolify-logs.sh search "error" --since 1h
#   bash scripts/coolify-logs.sh tail api --host staging.example.com
set -euo pipefail

# --- Colors ---
BOLD='\033[1m'
GREEN='\033[0;32m'
YELLOW='\033[0;33m'
RED='\033[0;31m'
CYAN='\033[0;36m'
NC='\033[0m'

SUBCOMMAND=""
SERVICE=""
PATTERN=""
LINES=100
FOLLOW=false
ALL=false
SINCE="1h"
SSH_HOST=""

usage() {
  echo "Usage: bash scripts/coolify-logs.sh <tail|search> [OPTIONS]"
  echo ""
  echo "Subcommands:"
  echo "  tail <service>        Tail container logs for a service"
  echo "  search <pattern>      Search container logs for a pattern"
  echo ""
  echo "Options (tail):"
  echo "  <service>             Service name (api, web, postgres, redis, etc.)"
  echo "  --all                 Tail all colophony containers"
  echo "  --lines <N>           Number of lines to show (default: 100)"
  echo "  --follow, -f          Follow log output"
  echo "  --host <ssh-host>     Run on remote host via SSH"
  echo ""
  echo "Options (search):"
  echo "  <pattern>             Grep pattern to search for"
  echo "  --service <name>      Limit to specific service (default: all)"
  echo "  --since <duration>    Time range: 1h, 6h, 1d (default: 1h)"
  echo "  --host <ssh-host>     Run on remote host via SSH"
  echo ""
  echo "  -h, --help            Show this help"
  exit 1
}

# Run a command locally or via SSH
run_cmd() {
  if [ -n "$SSH_HOST" ]; then
    ssh "$SSH_HOST" "$*"
  else
    eval "$@"
  fi
}

# Resolve a service name to its container name using docker compose
resolve_container() {
  local service="$1"
  local container

  # Try docker compose ps first (works for both local and Coolify deployments)
  container=$(run_cmd "docker compose ps --format '{{.Name}}' --status running 2>/dev/null" | grep -i "$service" | head -1) || true

  if [ -z "$container" ]; then
    # Fall back to docker ps with name filter
    container=$(run_cmd "docker ps --filter 'name=${service}' --filter 'status=running' --format '{{.Names}}'" | head -1) || true
  fi

  if [ -z "$container" ]; then
    echo -e "${RED}ERROR: No running container found for service '${service}'${NC}" >&2
    echo -e "Running containers:" >&2
    run_cmd "docker ps --format '{{.Names}}\t{{.Status}}'" | sed "s/^/  /" >&2
    exit 1
  fi

  echo "$container"
}

# List all colophony-related containers
list_containers() {
  # Get all running containers from the compose project, or fall back to name filter
  local containers
  containers=$(run_cmd "docker compose ps --format '{{.Name}}' --status running 2>/dev/null") || true

  if [ -z "$containers" ]; then
    containers=$(run_cmd "docker ps --filter 'status=running' --format '{{.Names}}'" | grep -i colophony) || true
  fi

  if [ -z "$containers" ]; then
    echo -e "${RED}ERROR: No running containers found${NC}" >&2
    exit 1
  fi

  echo "$containers"
}

# --- Parse subcommand ---
if [ $# -eq 0 ]; then
  usage
fi

SUBCOMMAND="$1"
shift

case "$SUBCOMMAND" in
  tail|search) ;;
  -h|--help) usage ;;
  *) echo "Unknown subcommand: $SUBCOMMAND" >&2; usage ;;
esac

# --- Parse args ---
# First positional arg after subcommand
if [ $# -gt 0 ] && [[ ! "$1" =~ ^-- ]]; then
  if [ "$SUBCOMMAND" = "tail" ]; then
    SERVICE="$1"
  else
    PATTERN="$1"
  fi
  shift
fi

while [ $# -gt 0 ]; do
  case "$1" in
    --all)
      ALL=true
      shift
      ;;
    --lines)
      LINES="${2:?--lines requires a value}"
      shift 2
      ;;
    --follow|-f)
      FOLLOW=true
      shift
      ;;
    --service)
      SERVICE="${2:?--service requires a value}"
      shift 2
      ;;
    --since)
      SINCE="${2:?--since requires a value}"
      shift 2
      ;;
    --host)
      SSH_HOST="${2:?--host requires a value}"
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

# =============================================================================
# TAIL
# =============================================================================
if [ "$SUBCOMMAND" = "tail" ]; then
  if [ "$ALL" = true ]; then
    echo -e "${BOLD}Tailing all containers${NC} (last ${LINES} lines)"
    FOLLOW_FLAG=""
    if [ "$FOLLOW" = true ]; then
      FOLLOW_FLAG="--follow"
    fi
    run_cmd "docker compose logs --tail ${LINES} ${FOLLOW_FLAG} 2>/dev/null" || {
      # Fall back to iterating containers
      CONTAINERS=$(list_containers)
      for c in $CONTAINERS; do
        echo -e "\n${CYAN}=== ${c} ===${NC}"
        run_cmd "docker logs --tail ${LINES} ${FOLLOW_FLAG} ${c} 2>&1" || true
      done
    }
    exit 0
  fi

  if [ -z "$SERVICE" ]; then
    echo -e "${RED}ERROR: Specify a service name or use --all${NC}" >&2
    echo ""
    echo "Available services:"
    list_containers | sed "s/^/  ${CYAN}•${NC} /"
    exit 1
  fi

  CONTAINER=$(resolve_container "$SERVICE")
  echo -e "${BOLD}Tailing${NC} ${CYAN}${CONTAINER}${NC} (last ${LINES} lines)"

  DOCKER_FLAGS="--tail ${LINES}"
  if [ "$FOLLOW" = true ]; then
    DOCKER_FLAGS="${DOCKER_FLAGS} --follow"
  fi

  run_cmd "docker logs ${DOCKER_FLAGS} ${CONTAINER} 2>&1"
  exit 0
fi

# =============================================================================
# SEARCH
# =============================================================================
if [ "$SUBCOMMAND" = "search" ]; then
  if [ -z "$PATTERN" ]; then
    echo -e "${RED}ERROR: Specify a search pattern${NC}" >&2
    echo "  Usage: bash scripts/coolify-logs.sh search \"error\" [--service api] [--since 1h]"
    exit 1
  fi

  if [ -n "$SERVICE" ]; then
    CONTAINER=$(resolve_container "$SERVICE")
    echo -e "${BOLD}Searching${NC} ${CYAN}${CONTAINER}${NC} for '${PATTERN}' (since ${SINCE})"
    echo ""
    run_cmd "docker logs --since ${SINCE} ${CONTAINER} 2>&1" | grep --color=always -i "$PATTERN" || {
      echo -e "${YELLOW}No matches found.${NC}"
    }
  else
    echo -e "${BOLD}Searching all containers${NC} for '${PATTERN}' (since ${SINCE})"
    echo ""
    CONTAINERS=$(list_containers)
    FOUND=false
    for c in $CONTAINERS; do
      MATCHES=$(run_cmd "docker logs --since ${SINCE} ${c} 2>&1" | grep --color=always -i "$PATTERN" || true)
      if [ -n "$MATCHES" ]; then
        echo -e "${CYAN}=== ${c} ===${NC}"
        echo "$MATCHES"
        echo ""
        FOUND=true
      fi
    done
    if [ "$FOUND" = false ]; then
      echo -e "${YELLOW}No matches found in any container.${NC}"
    fi
  fi

  exit 0
fi
