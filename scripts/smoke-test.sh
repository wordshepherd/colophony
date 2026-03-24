#!/usr/bin/env bash
# Post-deployment smoke test for Colophony staging.
# Usage: bash scripts/smoke-test.sh <base-url> [OPTIONS]
#   Options:
#     --skip-tls            Skip TLS certificate check
#     --skip-grafana        Skip Grafana health check
#     --skip-webhooks       Skip webhook freshness check
#     --oidc-issuer <url>   Zitadel issuer URL for OIDC discovery check
set -euo pipefail

# --- Colors ---
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[0;33m'
NC='\033[0m'

pass() { echo -e "${GREEN}✓ $1${NC}"; }
fail() { echo -e "${RED}✗ $1${NC}"; FAILURES=$((FAILURES + 1)); }
warn() { echo -e "${YELLOW}⚠ $1${NC}"; }

FAILURES=0
SKIP_TLS=false
SKIP_GRAFANA=false
SKIP_WEBHOOKS=false
OIDC_ISSUER=""

# --- Parse args ---
if [ $# -lt 1 ]; then
  echo "Usage: bash scripts/smoke-test.sh <base-url> [OPTIONS]"
  echo "  Options:"
  echo "    --skip-tls            Skip TLS certificate check"
  echo "    --skip-grafana        Skip Grafana health check"
  echo "    --skip-webhooks       Skip webhook freshness check"
  echo "    --oidc-issuer <url>   Zitadel issuer URL for OIDC discovery check"
  exit 1
fi

BASE_URL="${1%/}"  # strip trailing slash
shift
while [ $# -gt 0 ]; do
  case "$1" in
    --skip-tls)      SKIP_TLS=true; shift ;;
    --skip-grafana)  SKIP_GRAFANA=true; shift ;;
    --skip-webhooks) SKIP_WEBHOOKS=true; shift ;;
    --oidc-issuer)   OIDC_ISSUER="${2:?--oidc-issuer requires a value}"; shift 2 ;;
    *)               echo "Unknown option: $1"; exit 1 ;;
  esac
done

echo "Smoke testing: ${BASE_URL}"
echo "---"

# --- 1. Health endpoint ---
HEALTH_BODY=$(curl -sf --max-time 10 "${BASE_URL}/health" 2>/dev/null || true)
if echo "$HEALTH_BODY" | grep -q '"status":"ok"'; then
  pass "GET /health — 200, status ok"
else
  fail "GET /health — expected {\"status\":\"ok\"}, got: ${HEALTH_BODY:-<no response>}"
fi

# --- 2. Readiness endpoint ---
READY_BODY=$(curl -sf --max-time 10 "${BASE_URL}/ready" 2>/dev/null || true)
if echo "$READY_BODY" | grep -q '"status":"ready"'; then
  pass "GET /ready — 200, database reachable"
else
  fail "GET /ready — expected {\"status\":\"ready\"}, got: ${READY_BODY:-<no response>}"
fi

# --- 3. Security headers ---
HEADERS=$(curl -sI --max-time 10 "${BASE_URL}/health" 2>/dev/null || true)
check_header() {
  if echo "$HEADERS" | grep -qi "^$1:"; then
    pass "Header present: $1"
  else
    fail "Header missing: $1"
  fi
}
check_header "X-Frame-Options"
check_header "Strict-Transport-Security"
check_header "X-Content-Type-Options"

# --- 4. TLS certificate ---
if [ "$SKIP_TLS" = true ]; then
  warn "TLS check skipped (--skip-tls)"
else
  DOMAIN=$(echo "$BASE_URL" | sed -E 's|https?://||; s|/.*||')
  if echo | openssl s_client -connect "${DOMAIN}:443" -servername "$DOMAIN" 2>/dev/null | openssl x509 -noout -dates 2>/dev/null | grep -q "notAfter"; then
    pass "TLS certificate valid for ${DOMAIN}"
  else
    fail "TLS certificate check failed for ${DOMAIN}"
  fi
fi

# --- 5. tusd tus headers ---
TUS_HEADERS=$(curl -sI --max-time 10 -X OPTIONS "${BASE_URL}/upload" 2>/dev/null || true)
if echo "$TUS_HEADERS" | grep -qi "Tus-Resumable"; then
  pass "OPTIONS /upload — Tus-Resumable header present"
else
  fail "OPTIONS /upload — Tus-Resumable header missing"
fi

# --- 6. Unauthenticated tRPC returns 401 ---
TRPC_STATUS=$(curl -so /dev/null --max-time 10 -w "%{http_code}" "${BASE_URL}/trpc/submissions.list" 2>/dev/null || true)
if [ "$TRPC_STATUS" = "401" ]; then
  pass "GET /trpc/submissions.list — 401 (auth required)"
elif [ "$TRPC_STATUS" = "500" ] || [ "$TRPC_STATUS" = "502" ] || [ "$TRPC_STATUS" = "503" ]; then
  fail "GET /trpc/submissions.list — got ${TRPC_STATUS} (expected 401, server error)"
else
  warn "GET /trpc/submissions.list — got ${TRPC_STATUS} (expected 401)"
fi

# --- 7. Frontend serves HTML ---
FRONT_STATUS=$(curl -so /dev/null --max-time 10 -w "%{http_code}" "${BASE_URL}/" 2>/dev/null || true)
FRONT_TYPE=$(curl -sI --max-time 10 "${BASE_URL}/" 2>/dev/null | grep -i "^content-type:" || true)
if [ "$FRONT_STATUS" = "200" ] && echo "$FRONT_TYPE" | grep -qi "text/html"; then
  pass "GET / — 200 HTML (frontend serving)"
else
  fail "GET / — expected 200 text/html, got status=${FRONT_STATUS}"
fi

# --- 8. CORS preflight on /trpc ---
CORS_HEADERS=$(curl -sI --max-time 10 -X OPTIONS \
  -H "Origin: ${BASE_URL}" \
  -H "Access-Control-Request-Method: POST" \
  "${BASE_URL}/trpc" 2>/dev/null || true)
if echo "$CORS_HEADERS" | grep -qi "Access-Control-Allow"; then
  pass "OPTIONS /trpc — CORS headers present"
else
  fail "OPTIONS /trpc — CORS headers missing"
fi

# --- 9. NEXT_PUBLIC_API_URL — no doubled /trpc in JS bundle ---
# Fetch multiple pages to cover route-specific bundles. The home page (/) doesn't
# use tRPC, so we also fetch /dashboard which loads the tRPC client bundle.
FOUND_DOUBLE=false
FETCH_FAILED=true
for page in "/" "/dashboard"; do
  PAGE_HTML=$(curl -sf --max-time 10 "${BASE_URL}${page}" 2>/dev/null || true)
  if [ -z "$PAGE_HTML" ]; then
    continue
  fi
  FETCH_FAILED=false
  CHUNK_URLS=$(echo "$PAGE_HTML" | grep -oE '/_next/static/[^"'"'"']+\.js' | sort -u | head -15)
  for chunk in $CHUNK_URLS; do
    CHUNK_BODY=$(curl -sf --max-time 5 "${BASE_URL}${chunk}" 2>/dev/null || true)
    if echo "$CHUNK_BODY" | grep -q '/trpc/trpc'; then
      FOUND_DOUBLE=true
      break 2
    fi
  done
done
if [ "$FETCH_FAILED" = true ]; then
  fail "Bundle check — could not fetch frontend HTML"
elif [ "$FOUND_DOUBLE" = true ]; then
  fail "Bundle check — found /trpc/trpc in JS bundle (NEXT_PUBLIC_API_URL likely ends in /trpc)"
else
  pass "Bundle check — no /trpc/trpc in JS bundles"
fi

# --- 10. Grafana health ---
if [ "$SKIP_GRAFANA" = true ]; then
  warn "Grafana check skipped (--skip-grafana)"
else
  GRAFANA_STATUS=$(curl -so /dev/null --max-time 10 -w "%{http_code}" "${BASE_URL}/grafana/api/health" 2>/dev/null || true)
  if [ "$GRAFANA_STATUS" = "200" ]; then
    pass "GET /grafana/api/health — 200"
  else
    warn "GET /grafana/api/health — got ${GRAFANA_STATUS:-no response} (monitoring may not be deployed)"
  fi
fi

# --- 11. OIDC discovery ---
if [ -z "$OIDC_ISSUER" ]; then
  warn "OIDC discovery check skipped (no --oidc-issuer provided)"
else
  OIDC_URL="${OIDC_ISSUER%/}/.well-known/openid-configuration"
  OIDC_STATUS=$(curl -so /dev/null --max-time 10 -w "%{http_code}" "$OIDC_URL" 2>/dev/null || true)
  if [ "$OIDC_STATUS" = "200" ]; then
    pass "OIDC discovery — ${OIDC_ISSUER} reachable"
  else
    fail "OIDC discovery — ${OIDC_URL} returned ${OIDC_STATUS:-no response}"
  fi
fi

# --- 12. Webhook provider freshness ---
if [ "$SKIP_WEBHOOKS" = true ]; then
  warn "Webhook freshness check skipped (--skip-webhooks)"
else
  SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
  if bash "$SCRIPT_DIR/webhook-health.sh" --url "$BASE_URL" --quiet 2>/dev/null; then
    pass "GET /webhooks/health — all providers healthy"
  else
    warn "GET /webhooks/health — one or more providers stale/unknown"
  fi
fi

# --- Results ---
echo "---"
if [ "$FAILURES" -gt 0 ]; then
  echo -e "${RED}${FAILURES} check(s) failed${NC}"
  exit 1
else
  echo -e "${GREEN}All checks passed${NC}"
  exit 0
fi
