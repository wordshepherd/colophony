#!/usr/bin/env bash
# detect-changes.sh — Determine which Playwright E2E suites to run based on changed files.
#
# Usage: pipe file list (one per line) into stdin.
#   echo "apps/web/src/components/slate/foo.tsx" | \
#     GITHUB_EVENT_NAME=pull_request GITHUB_OUTPUT=/dev/stdout bash .github/scripts/detect-changes.sh
#
# Outputs boolean flags to $GITHUB_OUTPUT:
#   run_submissions, run_embed, run_slate, run_workspace, run_uploads, run_oidc
#
# Behavior:
#   - push events → all suites run (main branch always runs everything)
#   - Shared path changes → all suites run
#   - Suite-specific path changes → only that suite runs
#   - Unknown paths (fail-open) → all suites run

set -euo pipefail

# --- Defaults ---
run_submissions=false
run_embed=false
run_slate=false
run_workspace=false
run_uploads=false
run_oidc=false
run_forms=false
run_organization=false
run_analytics=false
run_federation=false
run_all=false

# --- Push to main always runs everything ---
if [[ "${GITHUB_EVENT_NAME:-}" == "push" ]]; then
  run_all=true
fi

# --- Read changed files from stdin ---
FILES=()
while IFS= read -r line; do
  [[ -n "$line" ]] && FILES+=("$line")
done

if [[ ${#FILES[@]} -eq 0 ]]; then
  # No files → nothing to run (docs_only will handle this)
  run_all=true
fi

# --- Shared prefixes: changes here trigger ALL suites ---
shared_prefixes=(
  "packages/types/"
  "packages/db/"
  "packages/auth-client/"
  "packages/api-contracts/"
  "apps/api/src/"
  "apps/web/src/lib/"
  "apps/web/src/hooks/"
  "apps/web/src/components/ui/"
  "apps/web/src/components/auth/"
  "apps/web/src/components/providers.tsx"
  "apps/web/playwright.config.ts"
  "apps/web/e2e/helpers/"
  "apps/web/e2e/global-setup.ts"
  "apps/web/e2e/global-teardown.ts"
  "apps/web/src/app/layout.tsx"
  "apps/web/src/app/globals.css"
  "apps/web/tsconfig"
  ".github/workflows/ci.yml"
  ".github/scripts/"
  "docker-compose"
  "package.json"
  "pnpm-lock.yaml"
  "pnpm-workspace.yaml"
  "tsconfig"
  "turbo.json"
)

# --- Suite-specific prefixes ---
submissions_prefixes=(
  "apps/web/e2e/submissions/"
  "apps/web/src/components/submissions/"
  "apps/web/src/app/(dashboard)/submissions/"
  "apps/web/src/components/form-renderer/"
)

forms_prefixes=(
  "apps/web/e2e/forms/"
  "apps/web/src/components/form-builder/"
  "apps/web/src/app/(dashboard)/editor/forms/"
)

embed_prefixes=(
  "apps/web/e2e/embed/"
  "apps/web/src/components/embed/"
  "apps/web/src/app/embed/"
)

slate_prefixes=(
  "apps/web/e2e/slate/"
  "apps/web/src/components/slate/"
  "apps/web/src/app/(dashboard)/slate/"
)

uploads_prefixes=(
  "apps/web/e2e/uploads/"
  "apps/web/src/components/submissions/file-upload"
  "apps/web/src/components/manuscripts/manuscript-version-files"
)

workspace_prefixes=(
  "apps/web/e2e/workspace/"
  "apps/web/src/components/workspace/"
  "apps/web/src/app/(dashboard)/workspace/"
)

oidc_prefixes=(
  "apps/web/e2e/oidc/"
  "apps/web/src/app/auth/"
)

organization_prefixes=(
  "apps/web/e2e/organization/"
  "apps/web/src/components/organizations/"
  "apps/web/src/app/(dashboard)/organizations/"
  "apps/web/src/app/(onboarding)/organizations/"
  "apps/web/src/app/(dashboard)/settings/"
)

analytics_prefixes=(
  "apps/web/e2e/analytics/"
  "apps/web/src/components/analytics/"
  "apps/web/src/app/(dashboard)/editor/analytics/"
)

federation_prefixes=(
  "apps/web/e2e/federation/"
  "apps/web/src/components/federation/"
  "apps/web/src/app/(dashboard)/federation/"
)

# --- Known non-suite prefixes (docs, configs, etc. that don't need E2E) ---
known_nonsuite_prefixes=(
  "docs/"
  "scripts/"
  ".husky/"
  ".vscode/"
  "coolify/"
  "apps/web/src/components/layout/"
  "apps/web/src/components/periods/"
  "apps/web/src/app/page.tsx"
  "apps/web/src/app/favicon.ico"
  "apps/web/public/"
  "apps/web/next.config"
  "apps/web/tailwind.config"
  "apps/web/postcss.config"
)

# --- Known non-suite file extensions ---
known_nonsuite_extensions=(
  ".md"
  ".mdx"
)

matches_any_prefix() {
  local file="$1"
  shift
  for prefix in "$@"; do
    if [[ "$file" == "$prefix"* ]]; then
      return 0
    fi
  done
  return 1
}

matches_any_extension() {
  local file="$1"
  shift
  for ext in "$@"; do
    if [[ "$file" == *"$ext" ]]; then
      return 0
    fi
  done
  return 1
}

# --- Classify each changed file ---
if [[ "$run_all" == "false" ]]; then
  for file in "${FILES[@]}"; do
    # Shared paths → all suites
    if matches_any_prefix "$file" "${shared_prefixes[@]}"; then
      run_all=true
      break
    fi

    matched=false

    # Suite-specific paths
    if matches_any_prefix "$file" "${submissions_prefixes[@]}"; then
      run_submissions=true
      matched=true
    fi
    if matches_any_prefix "$file" "${embed_prefixes[@]}"; then
      run_embed=true
      matched=true
    fi
    if matches_any_prefix "$file" "${slate_prefixes[@]}"; then
      run_slate=true
      matched=true
    fi
    if matches_any_prefix "$file" "${workspace_prefixes[@]}"; then
      run_workspace=true
      matched=true
    fi
    if matches_any_prefix "$file" "${uploads_prefixes[@]}"; then
      run_uploads=true
      matched=true
    fi
    if matches_any_prefix "$file" "${oidc_prefixes[@]}"; then
      run_oidc=true
      matched=true
    fi
    if matches_any_prefix "$file" "${forms_prefixes[@]}"; then
      run_forms=true
      matched=true
    fi
    if matches_any_prefix "$file" "${organization_prefixes[@]}"; then
      run_organization=true
      matched=true
    fi
    if matches_any_prefix "$file" "${analytics_prefixes[@]}"; then
      run_analytics=true
      matched=true
    fi
    if matches_any_prefix "$file" "${federation_prefixes[@]}"; then
      run_federation=true
      matched=true
    fi

    # Known non-suite paths (docs, configs) — skip without triggering fail-open
    if [[ "$matched" == "false" ]]; then
      if matches_any_prefix "$file" "${known_nonsuite_prefixes[@]}"; then
        matched=true
      fi
    fi
    if [[ "$matched" == "false" ]]; then
      if matches_any_extension "$file" "${known_nonsuite_extensions[@]}"; then
        matched=true
      fi
    fi

    # Fail-open: unknown file → run all suites
    if [[ "$matched" == "false" ]]; then
      echo "Unknown path (fail-open): $file"
      run_all=true
      break
    fi
  done
fi

# --- Apply run_all ---
if [[ "$run_all" == "true" ]]; then
  run_submissions=true
  run_embed=true
  run_slate=true
  run_workspace=true
  run_uploads=true
  run_oidc=true
  run_forms=true
  run_organization=true
  run_analytics=true
  run_federation=true
fi

# --- Output ---
echo "run_submissions=$run_submissions"
echo "run_embed=$run_embed"
echo "run_slate=$run_slate"
echo "run_workspace=$run_workspace"
echo "run_uploads=$run_uploads"
echo "run_oidc=$run_oidc"
echo "run_forms=$run_forms"
echo "run_organization=$run_organization"
echo "run_analytics=$run_analytics"
echo "run_federation=$run_federation"

# Write to GITHUB_OUTPUT if available
if [[ -n "${GITHUB_OUTPUT:-}" ]]; then
  {
    echo "run_submissions=$run_submissions"
    echo "run_embed=$run_embed"
    echo "run_slate=$run_slate"
    echo "run_workspace=$run_workspace"
    echo "run_uploads=$run_uploads"
    echo "run_oidc=$run_oidc"
    echo "run_forms=$run_forms"
    echo "run_organization=$run_organization"
    echo "run_analytics=$run_analytics"
    echo "run_federation=$run_federation"
  } >> "$GITHUB_OUTPUT"
fi
