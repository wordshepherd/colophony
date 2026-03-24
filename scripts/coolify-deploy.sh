#!/usr/bin/env bash
# Trigger a Coolify deployment from CLI, mirroring the GitHub Actions deploy workflow.
# Usage: bash scripts/coolify-deploy.sh [OPTIONS]
#
# Environment variables (group-specific webhooks):
#   COOLIFY_WEBHOOK_DATA        Webhook URL for data group (postgres, pgbouncer, redis, minio)
#   COOLIFY_WEBHOOK_APP         Webhook URL for app group (api, web)
#   COOLIFY_WEBHOOK_GATEWAY     Webhook URL for gateway group (nginx)
#   COOLIFY_WEBHOOK_UPLOADS     Webhook URL for uploads group (tusd, clamav)
#   COOLIFY_WEBHOOK_MONITORING  Webhook URL for monitoring group (prometheus, grafana, etc.)
#   COOLIFY_API_TOKEN           Bearer token for Coolify API (required)
#
# Legacy (deprecated):
#   COOLIFY_WEBHOOK_URL         Single webhook URL — used when no group-specific vars are set
#
# Examples:
#   bash scripts/coolify-deploy.sh                          # Deploy all groups
#   bash scripts/coolify-deploy.sh --group app              # Deploy app group only
#   bash scripts/coolify-deploy.sh --group app --yes        # Skip confirmation
#   bash scripts/coolify-deploy.sh --group all --no-wait    # Fire and forget
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
DEPLOY_GROUP="all"

# Polling config (matches deploy.yml)
POLL_ATTEMPTS=10
POLL_INTERVAL=15
INITIAL_WAIT=30

# Valid groups
VALID_GROUPS="data app gateway uploads monitoring all"

usage() {
  echo "Usage: bash scripts/coolify-deploy.sh [OPTIONS]"
  echo ""
  echo "Trigger a Coolify staging deployment and verify it succeeds."
  echo ""
  echo "Required environment variables:"
  echo "  COOLIFY_API_TOKEN           Bearer token for Coolify API"
  echo "  COOLIFY_WEBHOOK_<GROUP>     Webhook URL per group (DATA, APP, GATEWAY, UPLOADS, MONITORING)"
  echo ""
  echo "Options:"
  echo "  --group <name>        Deploy group: data, app, gateway, uploads, monitoring, all (default: all)"
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

# Deploy a single group by calling its Coolify webhook
deploy_group() {
  local name="$1"
  local url_var="COOLIFY_WEBHOOK_${name^^}"
  local url="${!url_var:-}"

  if [ -z "$url" ]; then
    echo -e "${YELLOW}⚠ Skipping ${name} (${url_var} not set)${NC}"
    return 0
  fi

  echo -e "${CYAN}Deploying ${name}...${NC}"

  local http_code
  http_code=$(curl -s -o /tmp/coolify-response.txt -w "%{http_code}" \
    --max-time 30 \
    -X GET \
    -H "Authorization: Bearer ${COOLIFY_API_TOKEN}" \
    "${url}" \
    2>/tmp/coolify-error.txt) || true

  local body
  body=$(cat /tmp/coolify-response.txt 2>/dev/null || true)
  rm -f /tmp/coolify-response.txt /tmp/coolify-error.txt

  if [ "$http_code" = "200" ] || [ "$http_code" = "201" ]; then
    echo -e "${GREEN}✓ ${name} deployment triggered (HTTP ${http_code})${NC}"
  else
    echo -e "${RED}❌ Failed to trigger ${name} deployment (HTTP ${http_code})${NC}" >&2
    if [ -n "$body" ]; then
      echo -e "Response: ${body}" >&2
    fi
    return 1
  fi
}

# --- Parse args ---
while [ $# -gt 0 ]; do
  case "$1" in
    --group)
      DEPLOY_GROUP="${2:?--group requires a value}"
      # Validate group name
      if ! echo "$VALID_GROUPS" | grep -qw "$DEPLOY_GROUP"; then
        echo -e "${RED}ERROR: Invalid group '${DEPLOY_GROUP}'. Valid: ${VALID_GROUPS}${NC}" >&2
        exit 1
      fi
      shift 2
      ;;
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
require_env COOLIFY_API_TOKEN

# --- Legacy backward compatibility ---
if [ -n "${COOLIFY_WEBHOOK_URL:-}" ] && [ -z "${COOLIFY_WEBHOOK_APP:-}" ]; then
  echo -e "${YELLOW}⚠ COOLIFY_WEBHOOK_URL is deprecated. Use COOLIFY_WEBHOOK_<GROUP> instead.${NC}"
  echo -e "${YELLOW}  Treating COOLIFY_WEBHOOK_URL as the app group webhook.${NC}"
  export COOLIFY_WEBHOOK_APP="${COOLIFY_WEBHOOK_URL}"
fi

# --- Confirm deployment ---
echo -e "${BOLD}Coolify Deployment${NC}"
echo ""
echo -e "  ${CYAN}•${NC} Group: ${DEPLOY_GROUP}"
echo -e "  ${CYAN}•${NC} Wait for health: $([ "$NO_WAIT" = true ] && echo "no" || echo "yes")"
if [ -n "$HEALTH_URL" ]; then
  echo -e "  ${CYAN}•${NC} Health URL: ${HEALTH_URL}"
fi
echo ""

confirm "Trigger deployment?"

# --- Deploy groups in dependency order ---
DEPLOYED_ANY=false

if [ "$DEPLOY_GROUP" = "all" ] || [ "$DEPLOY_GROUP" = "data" ]; then
  deploy_group "data" && DEPLOYED_ANY=true
  # Wait for data services to become healthy before deploying dependents
  if [ "$DEPLOY_GROUP" = "all" ] && [ -n "${COOLIFY_WEBHOOK_DATA:-}" ]; then
    echo -e "Waiting ${INITIAL_WAIT}s for data services to start..."
    sleep "$INITIAL_WAIT"
  fi
fi

if [ "$DEPLOY_GROUP" = "all" ] || [ "$DEPLOY_GROUP" = "app" ]; then
  deploy_group "app" && DEPLOYED_ANY=true
fi

if [ "$DEPLOY_GROUP" = "all" ] || [ "$DEPLOY_GROUP" = "uploads" ]; then
  deploy_group "uploads" && DEPLOYED_ANY=true
fi

if [ "$DEPLOY_GROUP" = "all" ] || [ "$DEPLOY_GROUP" = "gateway" ]; then
  deploy_group "gateway" && DEPLOYED_ANY=true
fi

if [ "$DEPLOY_GROUP" = "all" ] || [ "$DEPLOY_GROUP" = "monitoring" ]; then
  deploy_group "monitoring" && DEPLOYED_ANY=true
fi

if [ "$DEPLOYED_ANY" = false ]; then
  echo -e "${YELLOW}⚠ No groups deployed (no webhook URLs configured for '${DEPLOY_GROUP}')${NC}"
  exit 0
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

# Wait for non-data deploys to start
if [ "$DEPLOY_GROUP" != "data" ]; then
  echo -e "\nWaiting ${INITIAL_WAIT}s for deployment to start..."
  sleep "$INITIAL_WAIT"
fi

# --- Health check polling (uses /ready to verify DB connectivity) ---
echo -e "Polling ${HEALTH_URL}/ready (${POLL_ATTEMPTS} attempts, ${POLL_INTERVAL}s apart)..."

for i in $(seq 1 "$POLL_ATTEMPTS"); do
  if curl -sf --max-time 10 "${HEALTH_URL%/}/ready" > /dev/null 2>&1; then
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
