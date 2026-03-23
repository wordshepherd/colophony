#!/usr/bin/env bash
# Post-deployment smoke test for Colophony staging.
# Usage: bash scripts/smoke-test.sh https://staging.example.com [--skip-tls]
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

# --- Parse args ---
if [ $# -lt 1 ]; then
  echo "Usage: bash scripts/smoke-test.sh <base-url> [--skip-tls]"
  echo "  e.g. bash scripts/smoke-test.sh https://staging.example.com"
  exit 1
fi

BASE_URL="${1%/}"  # strip trailing slash
shift
for arg in "$@"; do
  case "$arg" in
    --skip-tls) SKIP_TLS=true ;;
    *) echo "Unknown option: $arg"; exit 1 ;;
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

# --- Results ---
echo "---"
if [ "$FAILURES" -gt 0 ]; then
  echo -e "${RED}${FAILURES} check(s) failed${NC}"
  exit 1
else
  echo -e "${GREEN}All checks passed${NC}"
  exit 0
fi
