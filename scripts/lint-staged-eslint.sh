#!/usr/bin/env bash
# lint-staged-eslint.sh — Route staged files to the correct ESLint config.
# Called by lint-staged with a list of absolute file paths.
# Runs ESLint with --fix --max-warnings 0 so warnings block commits.
# Only processes source files under apps/api/src, apps/api/test, or apps/web/src
# (config files at the project root are skipped — they aren't in tsconfig).
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"

api_files=()
web_files=()

for f in "$@"; do
  case "$f" in
    "$ROOT/apps/api/src/"*|"$ROOT/apps/api/test/"*) api_files+=("$f") ;;
    "$ROOT/apps/web/src/"*) web_files+=("$f") ;;
  esac
done

exit_code=0

if [ ${#api_files[@]} -gt 0 ]; then
  cd "$ROOT/apps/api"
  npx eslint --no-warn-ignored --fix --max-warnings 0 "${api_files[@]}" || exit_code=$?
fi

if [ ${#web_files[@]} -gt 0 ]; then
  cd "$ROOT/apps/web"
  npx eslint --no-warn-ignored --fix --max-warnings 0 "${web_files[@]}" || exit_code=$?
fi

exit $exit_code
