#!/bin/sh
# Secret scanner — shared by the pre-commit hook and CI.
#
# Usage:
#   check-secrets.sh [--staged | --tracked | --range <git-range>]
#
#   --staged          Scan files staged for commit (default). Used by .husky/pre-commit.
#   --tracked         Scan every tracked file in the working tree. Used by CI, which must
#                     catch secrets already committed on a branch, not just what is
#                     currently staged.
#   --range <range>   Scan files changed in a git range, e.g. origin/main...HEAD.
#
# Exit code 1 blocks the commit / fails the workflow.

set -e

MODE="staged"
RANGE=""

while [ $# -gt 0 ]; do
  case "$1" in
    --staged)
      MODE="staged"
      shift
      ;;
    --tracked)
      MODE="tracked"
      shift
      ;;
    --range)
      MODE="range"
      RANGE="$2"
      if [ -z "$RANGE" ]; then
        echo "❌ --range requires a git range argument (e.g. --range origin/main...HEAD)"
        exit 2
      fi
      shift 2
      ;;
    -h|--help)
      echo "Usage: check-secrets.sh [--staged | --tracked | --range <git-range>]"
      exit 0
      ;;
    *)
      echo "❌ Unknown argument: $1"
      echo "Usage: check-secrets.sh [--staged | --tracked | --range <git-range>]"
      exit 2
      ;;
  esac
done

case "$MODE" in
  staged)  FILES=$(git diff --cached --name-only --diff-filter=ACM) ;;
  tracked) FILES=$(git ls-files) ;;
  range)   FILES=$(git diff --name-only --diff-filter=ACM "$RANGE") ;;
esac

if [ -z "$FILES" ]; then
  exit 0
fi

FOUND=0

for file in $FILES; do
  # Skip binary files, lock files, and this script itself
  case "$file" in
    *.lock|*.png|*.jpg|*.jpeg|*.gif|*.ico|*.webp|*.woff*|*.ttf|*.eot|*.pdf) continue ;;
    scripts/check-secrets.sh) continue ;;
  esac

  # ── Forbidden path classes ──────────────────────────────────────────────
  # Block-all-then-allow-templates, mirroring the same rule in .dockerignore.
  # Failing safe matters: an allowlist silently misses .env.qa, .env.e2e, or any
  # future variant someone adds.
  case "$file" in
    # Templates, examples, and the committed test DSN are the only permitted
    # .env* files. packages/db/.env.test holds a localhost test database URL with
    # dummy credentials and is intentionally tracked — see packages/db/CLAUDE.md.
    # If a .env.test ever needs real credentials, it must be gitignored instead of
    # added here.
    .env.example|.env.*.example|*/.env.example|*/.env.*.example) ;;
    .env.test|*/.env.test) ;;
    .env|.env.*|*/.env|*/.env.*)
      echo "❌ BLOCKED: Environment file $file should not be committed"
      FOUND=1
      continue
      ;;
    # Key material — blocked by path regardless of content, since DER, PKCS#12 and
    # raw API-key files never match the PEM header pattern below.
    *.key|*.pem|*.p12|*.pfx|*.jks|*.keystore)
      echo "❌ BLOCKED: Key material $file should not be committed"
      FOUND=1
      continue
      ;;
  esac

  # In --staged mode the index version is authoritative (the working tree may hold
  # unstaged edits); otherwise read from disk. Skip anything unreadable.
  if [ "$MODE" = "staged" ]; then
    content=$(git show ":$file" 2>/dev/null || true)
  else
    [ -f "$file" ] || continue
    content=$(cat "$file" 2>/dev/null || true)
  fi
  [ -z "$content" ] && continue

  # ── Content patterns ────────────────────────────────────────────────────

  # Stripe live keys
  if echo "$content" | grep -qE 'sk_live_[a-zA-Z0-9]{20,}'; then
    echo "❌ BLOCKED: Stripe live secret key found in $file"
    FOUND=1
  fi

  # AWS keys
  if echo "$content" | grep -qE 'AKIA[0-9A-Z]{16}'; then
    echo "❌ BLOCKED: AWS access key found in $file"
    FOUND=1
  fi

  # Private keys
  if echo "$content" | grep -q -- '-----BEGIN.*PRIVATE KEY-----'; then
    echo "❌ BLOCKED: Private key found in $file"
    FOUND=1
  fi

  # Generic high-entropy secrets (long hex/base64 strings assigned to *_SECRET or *_KEY vars)
  if echo "$content" | grep -qE '(SECRET|_KEY|_TOKEN|PASSWORD)\s*[=:]\s*['\''"][a-zA-Z0-9+/=]{40,}['\''"]'; then
    # Exclude known safe patterns (placeholder values, test values)
    if ! echo "$content" | grep -qE '(CHANGE_ME|your-secret|pk_test_|sk_test_|whsec_test|example)'; then
      echo "⚠️  WARNING: Possible secret in $file — verify before committing"
    fi
  fi
done

if [ "$FOUND" -eq 1 ]; then
  echo ""
  if [ "$MODE" = "staged" ]; then
    echo "Commit blocked. Remove secrets before committing."
    echo "If this is a false positive, use: git commit --no-verify"
    echo "Note: --no-verify only skips the local hook. CI runs this same script on"
    echo "every branch push and will still fail."
  else
    echo "Secret scan failed. Remove the offending files from the branch."
  fi
  exit 1
fi

exit 0
