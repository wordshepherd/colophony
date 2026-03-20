#!/bin/bash
# Colophony RLS Verification Script
# Verifies Row-Level Security enforcement on the production database.
#
# Usage: bash scripts/verify-rls.sh [--structural-only] [--verbose]
# Env:   DATABASE_URL (superuser connection). Falls back to default Docker connection.
# Exit:  0 = all checks passed, 1 = any failure detected.
set -eo pipefail

BOLD='\033[1m'
GREEN='\033[0;32m'
YELLOW='\033[0;33m'
RED='\033[0;31m'
NC='\033[0m'

STRUCTURAL_ONLY=false
VERBOSE=false
FAILURES=0

for arg in "$@"; do
  case "$arg" in
    --structural-only) STRUCTURAL_ONLY=true ;;
    --verbose) VERBOSE=true ;;
    *) echo "Unknown option: $arg"; echo "Usage: bash scripts/verify-rls.sh [--structural-only] [--verbose]"; exit 1 ;;
  esac
done

DB_URL="${DATABASE_URL:-postgresql://colophony:colophony@localhost:5432/colophony}"

psql_cmd() {
  psql "$DB_URL" -t -A "$@"
}

pass() { echo -e "  ${GREEN}PASS${NC}  $1"; }
fail() { echo -e "  ${RED}FAIL${NC}  $1"; FAILURES=$((FAILURES + 1)); }
warn() { echo -e "  ${YELLOW}WARN${NC}  $1"; }
info() { if $VERBOSE; then echo -e "  ${BOLD}INFO${NC}  $1"; fi; }

# Tables that are intentionally exempt from RLS.
# These are system/admin tables queried via the superuser pool, not org-scoped.
KNOWN_NO_RLS=(
  organizations
  users
  dsar_requests
  stripe_webhook_events
  outbox_events
  zitadel_webhook_events
  federation_config
  documenso_webhook_events
  hub_registered_instances
  hub_fingerprint_index
  __drizzle_migrations
)

is_known_no_rls() {
  local table="$1"
  for exempt in "${KNOWN_NO_RLS[@]}"; do
    if [ "$table" = "$exempt" ]; then
      return 0
    fi
  done
  return 1
}

echo ""
echo -e "${BOLD}=== Colophony RLS Verification ===${NC}"
echo ""

# ─── Category 1: RLS Enabled + Forced ────────────────────────────────────────

echo -e "${BOLD}Category 1: RLS Enabled + Forced${NC}"

# Get all public tables and their RLS status
ALL_TABLES=$(psql_cmd -c "
SELECT c.relname, c.relrowsecurity, c.relforcerowsecurity
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public'
  AND c.relkind = 'r'
ORDER BY c.relname;
")

RLS_COUNT=0
RLS_PASS=0
RLS_FAIL_LIST=""
MISSING_RLS=""

while IFS='|' read -r table rls force; do
  [ -z "$table" ] && continue

  if is_known_no_rls "$table"; then
    info "Skipping exempt table: $table"
    continue
  fi

  if [ "$rls" = "t" ]; then
    RLS_COUNT=$((RLS_COUNT + 1))
    if [ "$force" = "t" ]; then
      RLS_PASS=$((RLS_PASS + 1))
      info "$table: RLS enabled + forced"
    else
      RLS_FAIL_LIST="$RLS_FAIL_LIST $table(force=false)"
    fi
  else
    # Table without RLS that is NOT in the exempt list
    # Check if it has organization_id or owner_id (should probably have RLS)
    HAS_TENANT_COL=$(psql_cmd -c "
      SELECT count(*) FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = '$table'
        AND column_name IN ('organization_id', 'owner_id');
    ")
    if [ "$HAS_TENANT_COL" -gt 0 ]; then
      MISSING_RLS="$MISSING_RLS $table"
    else
      info "No RLS needed: $table (no tenant column, not in exempt list)"
    fi
  fi
done <<< "$ALL_TABLES"

if [ "$RLS_COUNT" -lt 1 ]; then
  fail "No tables have RLS enabled — migrations may not have applied"
elif [ -n "$RLS_FAIL_LIST" ]; then
  fail "Tables with RLS but FORCE disabled:$RLS_FAIL_LIST"
elif [ -n "$MISSING_RLS" ]; then
  fail "Tables with tenant columns but NO RLS:$MISSING_RLS"
else
  pass "$RLS_PASS/$RLS_PASS tables with RLS verified (enabled + forced)"
fi

if [ -n "$MISSING_RLS" ]; then
  warn "Tables with organization_id/owner_id but no RLS:$MISSING_RLS"
fi

# ─── Category 2: Role Security ───────────────────────────────────────────────

echo ""
echo -e "${BOLD}Category 2: Role Security${NC}"

# Check app_user
APP_USER_FLAGS=$(psql_cmd -c "
SELECT rolsuper, rolbypassrls
FROM pg_roles WHERE rolname = 'app_user';
")

if [ -z "$APP_USER_FLAGS" ]; then
  fail "app_user role does not exist"
else
  IFS='|' read -r is_super bypass_rls <<< "$APP_USER_FLAGS"
  if [ "$is_super" = "f" ] && [ "$bypass_rls" = "f" ]; then
    pass "app_user: NOSUPERUSER + NOBYPASSRLS"
  else
    [ "$is_super" = "t" ] && fail "app_user is SUPERUSER — RLS will be bypassed!"
    [ "$bypass_rls" = "t" ] && fail "app_user has BYPASSRLS — RLS will be bypassed!"
  fi
fi

# Check audit_writer
AUDIT_FLAGS=$(psql_cmd -c "
SELECT rolsuper, rolbypassrls, rolcanlogin
FROM pg_roles WHERE rolname = 'audit_writer';
")

if [ -z "$AUDIT_FLAGS" ]; then
  warn "audit_writer role does not exist (expected for audit function ownership)"
else
  IFS='|' read -r is_super bypass_rls can_login <<< "$AUDIT_FLAGS"
  if [ "$is_super" = "f" ] && [ "$bypass_rls" = "f" ] && [ "$can_login" = "f" ]; then
    pass "audit_writer: NOSUPERUSER + NOBYPASSRLS + NOLOGIN"
  else
    [ "$is_super" = "t" ] && fail "audit_writer is SUPERUSER"
    [ "$bypass_rls" = "t" ] && fail "audit_writer has BYPASSRLS"
    [ "$can_login" = "t" ] && fail "audit_writer has LOGIN (should be NOLOGIN)"
  fi
fi

# ─── Category 3: Policy + Privilege Completeness ─────────────────────────────

echo ""
echo -e "${BOLD}Category 3: Policy + Privilege Completeness${NC}"

# Every RLS-enabled table must have at least one policy
TABLES_WITHOUT_POLICY=$(psql_cmd -c "
SELECT c.relname
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public'
  AND c.relkind = 'r'
  AND c.relrowsecurity = true
  AND NOT EXISTS (
    SELECT 1 FROM pg_policies p
    WHERE p.schemaname = 'public' AND p.tablename = c.relname
  )
ORDER BY c.relname;
")

if [ -z "$TABLES_WITHOUT_POLICY" ]; then
  POLICY_COUNT=$(psql_cmd -c "
    SELECT count(DISTINCT c.relname)
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    JOIN pg_policies p ON p.schemaname = 'public' AND p.tablename = c.relname
    WHERE n.nspname = 'public'
      AND c.relkind = 'r'
      AND c.relrowsecurity = true;
  ")
  pass "All RLS tables have policies ($POLICY_COUNT tables)"
else
  fail "RLS tables without policies: $(echo "$TABLES_WITHOUT_POLICY" | tr '\n' ' ')"
fi

# Check GRANT/REVOKE enforcement on restricted tables
# journal_directory: app_user should have SELECT only
JD_INSERT=$(psql_cmd -c "SELECT has_table_privilege('app_user', 'journal_directory', 'INSERT');")
JD_DELETE=$(psql_cmd -c "SELECT has_table_privilege('app_user', 'journal_directory', 'DELETE');")
JD_SELECT=$(psql_cmd -c "SELECT has_table_privilege('app_user', 'journal_directory', 'SELECT');")

if [ "$JD_SELECT" = "t" ] && [ "$JD_INSERT" = "f" ] && [ "$JD_DELETE" = "f" ]; then
  pass "journal_directory: app_user has SELECT only (no INSERT/DELETE)"
elif [ "$JD_SELECT" = "" ]; then
  info "journal_directory table not found — skipping privilege check"
else
  [ "$JD_INSERT" = "t" ] && fail "journal_directory: app_user has INSERT (should be SELECT only)"
  [ "$JD_DELETE" = "t" ] && fail "journal_directory: app_user has DELETE (should be SELECT only)"
fi

# audit_events: app_user should have SELECT only (INSERT via audit_writer function)
AE_INSERT=$(psql_cmd -c "SELECT has_table_privilege('app_user', 'audit_events', 'INSERT');" 2>/dev/null || echo "")
AE_DELETE=$(psql_cmd -c "SELECT has_table_privilege('app_user', 'audit_events', 'DELETE');" 2>/dev/null || echo "")
AE_SELECT=$(psql_cmd -c "SELECT has_table_privilege('app_user', 'audit_events', 'SELECT');" 2>/dev/null || echo "")

if [ -z "$AE_SELECT" ]; then
  info "audit_events table not found — skipping privilege check"
elif [ "$AE_SELECT" = "t" ] && [ "$AE_INSERT" = "f" ] && [ "$AE_DELETE" = "f" ]; then
  pass "audit_events: app_user has SELECT only (INSERT via audit_writer function)"
else
  [ "$AE_INSERT" = "t" ] && fail "audit_events: app_user has direct INSERT (should use audit_writer function)"
  [ "$AE_DELETE" = "t" ] && fail "audit_events: app_user has DELETE on audit_events"
fi

# ─── Category 4: Data Isolation (behavioral) ─────────────────────────────────

if $STRUCTURAL_ONLY; then
  echo ""
  echo -e "${BOLD}Category 4: Data Isolation${NC}"
  echo "  SKIP  --structural-only (behavioral tests skipped)"
  echo ""
  echo -e "${BOLD}Category 5: Permission Restrictions${NC}"
  echo "  SKIP  --structural-only (behavioral tests skipped)"
else
  echo ""
  echo -e "${BOLD}Category 4: Data Isolation${NC}"

  ISOLATION_RESULT=$(psql_cmd -c "
  DO \$\$
  DECLARE
    org_a_id uuid := gen_random_uuid();
    org_b_id uuid := gen_random_uuid();
    row_count integer;
  BEGIN
    -- Insert test orgs
    INSERT INTO organizations (id, name, slug, status)
    VALUES (org_a_id, 'RLS Test Org A', 'rls-test-a-' || substr(org_a_id::text, 1, 8), 'ACTIVE'),
           (org_b_id, 'RLS Test Org B', 'rls-test-b-' || substr(org_b_id::text, 1, 8), 'ACTIVE');

    -- Insert test submissions for each org
    INSERT INTO submissions (id, organization_id, title, status, submitter_email)
    VALUES (gen_random_uuid(), org_a_id, 'Test Sub A', 'PENDING', 'a@test.com'),
           (gen_random_uuid(), org_b_id, 'Test Sub B', 'PENDING', 'b@test.com');

    -- Switch to app_user role
    SET LOCAL ROLE app_user;

    -- Test 1: No context set → 0 rows
    SELECT count(*) INTO row_count FROM submissions;
    IF row_count > 0 THEN
      RAISE EXCEPTION 'FAIL: No context set but got % rows (expected 0)', row_count;
    END IF;
    RAISE NOTICE 'PASS: No context → 0 rows';

    -- Test 2: Set org A context → only org A data
    PERFORM set_config('app.current_org', org_a_id::text, true);
    SELECT count(*) INTO row_count FROM submissions WHERE organization_id = org_a_id;
    IF row_count != 1 THEN
      RAISE EXCEPTION 'FAIL: Org A context but got % rows (expected 1)', row_count;
    END IF;

    -- Verify no org B data visible
    SELECT count(*) INTO row_count FROM submissions WHERE organization_id = org_b_id;
    IF row_count != 0 THEN
      RAISE EXCEPTION 'FAIL: Org A context but can see % org B rows', row_count;
    END IF;
    RAISE NOTICE 'PASS: Org A context → only org A data';

    -- Test 3: Cross-org INSERT should fail
    BEGIN
      INSERT INTO submissions (id, organization_id, title, status, submitter_email)
      VALUES (gen_random_uuid(), org_b_id, 'Cross-org attack', 'PENDING', 'evil@test.com');
      RAISE EXCEPTION 'FAIL: Cross-org INSERT should have been rejected';
    EXCEPTION
      WHEN insufficient_privilege THEN
        RAISE NOTICE 'PASS: Cross-org INSERT rejected (42501)';
    END;

    -- Reset role for rollback
    RESET ROLE;

    -- Rollback all test data
    RAISE EXCEPTION 'ROLLBACK_SENTINEL';
  END;
  \$\$;
  " 2>&1)

  if echo "$ISOLATION_RESULT" | grep -q "ROLLBACK_SENTINEL"; then
    # All tests passed (the exception is our controlled rollback)
    PASS_COUNT=$(echo "$ISOLATION_RESULT" | grep -c "PASS:" || true)
    pass "Data isolation verified ($PASS_COUNT/3 tests)"
  elif echo "$ISOLATION_RESULT" | grep -q "FAIL:"; then
    FAIL_MSG=$(echo "$ISOLATION_RESULT" | grep "FAIL:" | head -1)
    fail "Data isolation: $FAIL_MSG"
  else
    fail "Data isolation test returned unexpected result"
    if $VERBOSE; then echo "$ISOLATION_RESULT"; fi
  fi

  # ─── Category 5: Permission Restrictions ──────────────────────────────────

  echo ""
  echo -e "${BOLD}Category 5: Permission Restrictions${NC}"

  # Test append-only tables reject DELETE
  APPEND_ONLY_TABLES=(user_keys trusted_peers sim_sub_checks inbound_transfers documenso_webhook_events)
  DELETE_PASS=0
  DELETE_TOTAL=${#APPEND_ONLY_TABLES[@]}

  for table in "${APPEND_ONLY_TABLES[@]}"; do
    # Check via has_table_privilege (no need to actually try DELETE)
    HAS_DELETE=$(psql_cmd -c "SELECT has_table_privilege('app_user', '$table', 'DELETE');" 2>/dev/null || echo "")
    if [ "$HAS_DELETE" = "f" ]; then
      DELETE_PASS=$((DELETE_PASS + 1))
      info "$table: DELETE revoked"
    elif [ -z "$HAS_DELETE" ]; then
      warn "$table: table not found"
    else
      fail "$table: app_user has DELETE privilege (should be revoked)"
    fi
  done

  if [ "$DELETE_PASS" -eq "$DELETE_TOTAL" ]; then
    pass "Append-only tables reject DELETE ($DELETE_PASS/$DELETE_TOTAL)"
  fi

  # Test audit_events rejects UPDATE/DELETE
  AE_UPDATE=$(psql_cmd -c "SELECT has_table_privilege('app_user', 'audit_events', 'UPDATE');" 2>/dev/null || echo "")
  AE_DELETE2=$(psql_cmd -c "SELECT has_table_privilege('app_user', 'audit_events', 'DELETE');" 2>/dev/null || echo "")

  if [ -z "$AE_UPDATE" ]; then
    info "audit_events table not found — skipping"
  elif [ "$AE_UPDATE" = "f" ] && [ "$AE_DELETE2" = "f" ]; then
    pass "audit_events: rejects UPDATE + DELETE"
  else
    [ "$AE_UPDATE" = "t" ] && fail "audit_events: app_user has UPDATE"
    [ "$AE_DELETE2" = "t" ] && fail "audit_events: app_user has DELETE"
  fi
fi

# ─── Summary ─────────────────────────────────────────────────────────────────

echo ""
if [ "$FAILURES" -eq 0 ]; then
  echo -e "${GREEN}${BOLD}=== All checks passed ===${NC}"
  exit 0
else
  echo -e "${RED}${BOLD}=== $FAILURES check(s) FAILED ===${NC}"
  exit 1
fi
