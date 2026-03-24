#!/usr/bin/env bash
# Trigger a Coolify deployment from CLI, mirroring the GitHub Actions deploy workflow.
# Usage: bash scripts/coolify-deploy.sh [OPTIONS]
#
# Required env vars: COOLIFY_WEBHOOK_URL, COOLIFY_API_TOKEN
#
# Examples:
#   bash scripts/coolify-deploy.sh                    # Deploy with confirmation
#   bash scripts/coolify-deploy.sh --yes               # Skip confirmation
#   bash scripts/coolify-deploy.sh --no-wait           # Fire and forget
#   bash scripts/coolify-deploy.sh --health-url https://staging.example.com
set -euo pipefail

# --- Colors ---
BOLD='\033[1m'
GREEN='\033[0;32m'
YELLOW='\033[0;33m'
RED='\033[0;31m'
CYAN='\033[0;36m'
NC='\033[0m'

NO_WAIT=false
SKIP_CONFIRM=false
HEALTH_URL=""
SKIP_SMOKE=false
OIDC_ISSUER=""

# Polling config (matches deploy.yml)
POLL_ATTEMPTS=10
POLL_INTERVAL=15
INITIAL_WAIT=30

usage() {
  echo "Usage: bash scripts/coolify-deploy.sh [OPTIONS]"
  echo ""
  echo "Trigger a Coolify staging deployment and verify it succeeds."
  echo ""
  echo "Required environment variables:"
  echo "  COOLIFY_WEBHOOK_URL   Coolify deployment webhook URL"
  echo "  COOLIFY_API_TOKEN     Bearer token for Coolify API"
  echo ""
  echo "Options:"
  echo "  --yes, -y             Skip confirmation prompt"
  echo "  --no-wait             Fire and forget (no health check)"
  echo "  --health-url <url>    URL to poll for health (e.g., https://staging.example.com)"
  echo "  --skip-smoke          Skip smoke test after deploy"
  echo "  --oidc-issuer <url>   Zitadel issuer URL (passed to smoke-test.sh)"
  echo "  -h, --help            Show this help"
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

confirm() {
  local message="$1"
  if [ "$SKIP_CONFIRM" = true ]; then
    return 0
  fi
  echo -en "$message [y/N] "
  read -r answer
  case "$answer" in
    [yY]|[yY][eE][sS]) return 0 ;;
    *) echo -e "${YELLOW}Aborted.${NC}"; exit 0 ;;
  esac
}

# --- Parse args ---
while [ $# -gt 0 ]; do
  case "$1" in
    --yes|-y)
      SKIP_CONFIRM=true
      shift
      ;;
    --no-wait)
      NO_WAIT=true
      shift
      ;;
    --health-url)
      HEALTH_URL="${2:?--health-url requires a value}"
      shift 2
      ;;
    --skip-smoke)
      SKIP_SMOKE=true
      shift
      ;;
    --oidc-issuer)
      OIDC_ISSUER="${2:-}"
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

require_deps curl
require_env COOLIFY_WEBHOOK_URL
require_env COOLIFY_API_TOKEN

# --- Confirm deployment ---
echo -e "${BOLD}Coolify Deployment${NC}"
echo ""
echo -e "  ${CYAN}•${NC} Webhook: ${COOLIFY_WEBHOOK_URL:0:60}..."
echo -e "  ${CYAN}•${NC} Wait for health: $([ "$NO_WAIT" = true ] && echo "no" || echo "yes")"
if [ -n "$HEALTH_URL" ]; then
  echo -e "  ${CYAN}•${NC} Health URL: ${HEALTH_URL}"
fi
echo ""

confirm "Trigger deployment?"

# --- Trigger deployment ---
# Mirrors deploy.yml: GET request with Bearer token
echo -e "${CYAN}Triggering deployment...${NC}"

HTTP_CODE=$(curl -s -o /tmp/coolify-response.txt -w "%{http_code}" \
  --max-time 30 \
  -X GET \
  -H "Authorization: Bearer ${COOLIFY_API_TOKEN}" \
  "${COOLIFY_WEBHOOK_URL}" \
  2>/tmp/coolify-error.txt) || true

BODY=$(cat /tmp/coolify-response.txt 2>/dev/null || true)
rm -f /tmp/coolify-response.txt /tmp/coolify-error.txt

if [ "$HTTP_CODE" = "200" ] || [ "$HTTP_CODE" = "201" ]; then
  echo -e "${GREEN}✓ Deployment triggered (HTTP ${HTTP_CODE})${NC}"
else
  echo -e "${RED}❌ Failed to trigger deployment (HTTP ${HTTP_CODE})${NC}" >&2
  if [ -n "$BODY" ]; then
    echo -e "Response: ${BODY}" >&2
  fi
  exit 1
fi

# --- No-wait mode ---
if [ "$NO_WAIT" = true ]; then
  echo -e "\n${YELLOW}--no-wait: Skipping health check. Deployment is in progress.${NC}"
  exit 0
fi

# --- Wait for deployment ---
if [ -z "$HEALTH_URL" ]; then
  echo -e "\n${YELLOW}⚠ No --health-url provided. Cannot verify deployment.${NC}"
  echo -e "Use --health-url <url> to enable post-deploy verification."
  exit 0
fi

echo -e "\nWaiting ${INITIAL_WAIT}s for deployment to start..."
sleep "$INITIAL_WAIT"

# --- Health check polling ---
echo -e "Polling ${HEALTH_URL}/health (${POLL_ATTEMPTS} attempts, ${POLL_INTERVAL}s apart)..."

for i in $(seq 1 "$POLL_ATTEMPTS"); do
  if curl -sf --max-time 10 "${HEALTH_URL%/}/health" > /dev/null 2>&1; then
    echo -e "\n${GREEN}✓ Deployment is healthy${NC}"

    # Run smoke tests
    if [ "$SKIP_SMOKE" = true ]; then
      echo -e "${YELLOW}Smoke tests skipped (--skip-smoke)${NC}"
    else
      SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
      SMOKE_SCRIPT="${SCRIPT_DIR}/smoke-test.sh"
      if [ -f "$SMOKE_SCRIPT" ]; then
        echo -e "\n${BOLD}Running smoke tests...${NC}"
        SMOKE_ARGS=("${HEALTH_URL%/}")
        if [ -n "$OIDC_ISSUER" ]; then
          SMOKE_ARGS+=(--oidc-issuer "$OIDC_ISSUER")
        fi
        bash "$SMOKE_SCRIPT" "${SMOKE_ARGS[@]}"
      else
        echo -e "${YELLOW}⚠ smoke-test.sh not found at ${SMOKE_SCRIPT}${NC}"
      fi
    fi

    exit 0
  fi
  echo -e "  Attempt ${i}/${POLL_ATTEMPTS} — waiting..."
  sleep "$POLL_INTERVAL"
done

echo -e "\n${RED}❌ Health check failed after ${POLL_ATTEMPTS} attempts${NC}" >&2
exit 1
