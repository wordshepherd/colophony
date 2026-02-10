#!/bin/sh
# Pre-commit secret scanner
# Checks staged files for common secret patterns before allowing commit.
# Exit code 1 blocks the commit.

set -e

STAGED_FILES=$(git diff --cached --name-only --diff-filter=ACM)

if [ -z "$STAGED_FILES" ]; then
  exit 0
fi

FOUND=0

for file in $STAGED_FILES; do
  # Skip binary files and lock files
  case "$file" in
    *.lock|*.png|*.jpg|*.gif|*.ico|*.woff*|*.ttf|*.eot) continue ;;
  esac

  # Skip if file doesn't exist (deleted)
  [ -f "$file" ] || continue

  content=$(git show ":$file" 2>/dev/null || true)
  [ -z "$content" ] && continue

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
  if echo "$content" | grep -qE '-----BEGIN (RSA |EC |DSA )?PRIVATE KEY-----'; then
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

  # .env files that shouldn't be committed
  case "$file" in
    .env|.env.local|.env.prod|.env.*.local)
      echo "❌ BLOCKED: Environment file $file should not be committed"
      FOUND=1
      ;;
  esac
done

if [ "$FOUND" -eq 1 ]; then
  echo ""
  echo "Commit blocked. Remove secrets before committing."
  echo "If this is a false positive, use: git commit --no-verify"
  exit 1
fi

exit 0
