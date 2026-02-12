#!/bin/bash
# build-review-context.sh — Assembles a tiered context package for AI code review.
#
# Reads the full repo checkout and PR metadata to build two output files:
#   /tmp/system_prompt.txt — CLAUDE.md + reviewer instructions
#   /tmp/user_prompt.txt   — PR info, full files, diff, imports, schema
#
# Requires: gh CLI (authenticated), PR_NUMBER env var
# Optional: CONTEXT_BUDGET env var (default: 180000 bytes)

set -euo pipefail

: "${PR_NUMBER:?PR_NUMBER env var is required}"
BUDGET="${CONTEXT_BUDGET:-180000}"
REPO_ROOT="$(git rev-parse --show-toplevel)"

# Track cumulative user prompt size
USED=0

# Append content to user prompt if within budget. Returns 0 if anything was written.
append_within_budget() {
  local content="$1"
  local size=${#content}
  local remaining=$((BUDGET - USED))

  if [ "$remaining" -le 0 ]; then
    return 1
  fi

  if [ "$size" -gt "$remaining" ]; then
    # Truncate to fit, add notice
    content="${content:0:$remaining}"
    content+=$'\n[... truncated to fit context budget ...]\n'
    printf '%s' "$content" >> /tmp/user_prompt.txt
    USED=$BUDGET
    return 0
  fi

  printf '%s' "$content" >> /tmp/user_prompt.txt
  USED=$((USED + size))
  return 0
}

# --- System prompt (CLAUDE.md + reviewer instructions, outside budget) ---

{
  if [ -f "$REPO_ROOT/CLAUDE.md" ]; then
    cat "$REPO_ROOT/CLAUDE.md"
    echo ""
    echo "---"
    echo ""
  fi
  cat <<'INSTRUCTIONS'
You are reviewing a pull request for this project. Use the project guidelines above as your primary reference for what patterns, security rules, and conventions to enforce.

Review the PR for:

**Critical (flag clearly):**
- Security vulnerabilities (SQL injection, XSS, CSRF, command injection)
- Multi-tenancy / RLS violations (queries on tenant tables outside RLS context)
- Secrets or credentials in code
- PCI violations (logging/storing card data)
- Missing webhook idempotency checks
- GDPR violations

**Important:**
- Missing input validation
- Missing error handling on external service calls
- Missing audit logging on sensitive operations
- Race conditions or transaction safety issues
- N+1 queries or missing database indexes

**Suggestions:**
- Code clarity and maintainability
- Type safety improvements
- Test coverage gaps

**Do NOT comment on:** formatting, import ordering, minor naming preferences (handled by linters).

**Prior review context:** If this PR has been reviewed before, the prior AI review comments and developer responses are included below. **Do NOT re-raise findings that have already been:**
- **Fixed** — the developer addressed the issue in a subsequent commit.
- **Dismissed with reasoning** — the developer explained why the finding is a false positive, already handled, or out of scope. Accept their reasoning unless you have a concrete, specific counter-argument (not just restating the original concern).
- **Acknowledged as a roadmap item** — the developer noted it's planned but not in scope for this PR.

Only re-raise a previously dismissed finding if the code has materially changed in a way that invalidates the prior reasoning, or if you identify a genuinely new angle not covered by the prior response. Your review should focus on **new or unaddressed issues only**.

Format your response as markdown. Start with a one-line verdict:
- ✅ **LGTM** — no issues found
- ⚠️ **Minor issues** — suggestions but not blocking
- 🚨 **Issues found** — should be addressed before merge

Then list findings grouped by severity. Reference specific file paths and line numbers. If all prior findings have been addressed and no new issues exist, return ✅ **LGTM**.
INSTRUCTIONS
} > /tmp/system_prompt.txt

# --- User prompt (tiered context within budget) ---

> /tmp/user_prompt.txt

# Tier 1: PR title + description
PR_TITLE=$(gh pr view "$PR_NUMBER" --json title -q .title 2>/dev/null || echo "PR #$PR_NUMBER")
PR_BODY=$(gh pr view "$PR_NUMBER" --json body -q .body 2>/dev/null || echo "")

tier1="## PR: ${PR_TITLE}

### Description
${PR_BODY}

"
append_within_budget "$tier1"

# Tier 1.5: Prior review responses (developer "AI Review Response" comments)
# Only includes the developer response summaries, not the full AI review text.
# The responses already summarize what was fixed, dismissed, and why — that's
# all the reviewer needs to avoid re-raising resolved findings. Including full
# AI reviews would waste ~15-20KB of context budget on redundant content.
REVIEW_RESPONSES=$(gh pr view "$PR_NUMBER" --json comments --jq '
  [.comments[]
   | select(.body | test("AI Review Response"))
   | {createdAt: .createdAt, body: .body}
  ]
  | sort_by(.createdAt)
  | .[]
  | "---\n\(.body)"
' 2>/dev/null || true)

if [ -n "$REVIEW_RESPONSES" ]; then
  review_block="### Prior Review Responses

The following developer responses summarize findings from previous AI reviews on this PR. Each lists what was fixed, what was already handled, and what was dismissed with reasoning. Do NOT re-raise any finding covered by these responses.

${REVIEW_RESPONSES}

---

"
  append_within_budget "$review_block" || true
  echo "Prior review responses: ${#REVIEW_RESPONSES} bytes" >&2
fi

# Get list of changed files
gh pr view "$PR_NUMBER" --json files -q '.files[].path' 2>/dev/null | head -200 > /tmp/pr_files.txt || true

# Tier 2: Full contents of changed files
CHANGED_HEADER="### Full Changed Files
"
append_within_budget "$CHANGED_HEADER" || true

while IFS= read -r file; do
  filepath="$REPO_ROOT/$file"
  if [ -f "$filepath" ]; then
    # Determine language hint from extension
    ext="${file##*.}"
    lang=""
    case "$ext" in
      ts|tsx) lang="typescript" ;;
      js|jsx) lang="javascript" ;;
      json) lang="json" ;;
      sql) lang="sql" ;;
      sh) lang="bash" ;;
      md) lang="markdown" ;;
      yml|yaml) lang="yaml" ;;
    esac

    file_content=$(head -c 50000 "$filepath")
    block="
#### ${file}
\`\`\`${lang}
${file_content}
\`\`\`
"
    append_within_budget "$block" || break
  fi
done < /tmp/pr_files.txt

# Tier 3: Diff
DIFF=$(gh pr diff "$PR_NUMBER" 2>/dev/null | head -c 100000 || true)
if [ -n "$DIFF" ]; then
  diff_block="
### Diff
\`\`\`diff
${DIFF}
\`\`\`
"
  append_within_budget "$diff_block" || true
fi

# Tier 4: Direct imports of changed files (one level deep)
# Collect all local imports from changed .ts/.tsx files
> /tmp/import_files.txt
while IFS= read -r file; do
  filepath="$REPO_ROOT/$file"
  if [ -f "$filepath" ] && [[ "$file" == *.ts || "$file" == *.tsx ]]; then
    filedir=$(dirname "$filepath")
    # Extract relative imports: from "./foo" or from "../bar"
    # Note: grep || true prevents pipefail exit when no relative imports exist
    (grep -oP "from ['\"](\./[^'\"]+|\.\.\/[^'\"]+)['\"]" "$filepath" 2>/dev/null || true) | \
      sed "s/from ['\"]//;s/['\"]$//" | while IFS= read -r imp; do
        # Resolve relative path
        resolved=$(cd "$filedir" && realpath -m "$imp" 2>/dev/null || echo "")
        if [ -z "$resolved" ]; then
          continue
        fi
        # Try with .ts extension if no extension
        if [ ! -f "$resolved" ] && [ ! -f "${resolved}.ts" ] && [ ! -f "${resolved}.tsx" ]; then
          continue
        fi
        if [ -f "$resolved" ]; then
          echo "$resolved"
        elif [ -f "${resolved}.ts" ]; then
          echo "${resolved}.ts"
        elif [ -f "${resolved}.tsx" ]; then
          echo "${resolved}.tsx"
        fi
      done
  fi
done < /tmp/pr_files.txt | sort -u > /tmp/import_files.txt

# Remove files already included as changed files
if [ -s /tmp/import_files.txt ]; then
  # Build set of already-included absolute paths
  > /tmp/changed_abs.txt
  while IFS= read -r file; do
    realpath -m "$REPO_ROOT/$file" 2>/dev/null >> /tmp/changed_abs.txt || true
  done < /tmp/pr_files.txt

  # Filter out already-included files
  import_files=$(comm -23 /tmp/import_files.txt /tmp/changed_abs.txt 2>/dev/null || cat /tmp/import_files.txt)

  if [ -n "$import_files" ]; then
    import_header="
### Imported Files (direct dependencies of changed files)
"
    append_within_budget "$import_header" || true

    echo "$import_files" | while IFS= read -r abs_path; do
      if [ -f "$abs_path" ]; then
        rel_path="${abs_path#$REPO_ROOT/}"
        ext="${abs_path##*.}"
        lang=""
        case "$ext" in
          ts|tsx) lang="typescript" ;;
          js|jsx) lang="javascript" ;;
        esac
        file_content=$(head -c 30000 "$abs_path")
        block="
#### ${rel_path}
\`\`\`${lang}
${file_content}
\`\`\`
"
        append_within_budget "$block" || break
      fi
    done
  fi
fi

# Tier 5: Schema files (if any changed file references schema or @colophony/db)
SCHEMA_DIR="$REPO_ROOT/packages/db/src/schema"
if [ -d "$SCHEMA_DIR" ]; then
  needs_schema=false
  while IFS= read -r file; do
    filepath="$REPO_ROOT/$file"
    if [ -f "$filepath" ] && grep -qE '(from.*schema|@colophony/db)' "$filepath" 2>/dev/null; then
      needs_schema=true
      break
    fi
  done < /tmp/pr_files.txt

  if $needs_schema; then
    schema_header="
### Database Schema Files
"
    append_within_budget "$schema_header" || true

    find "$SCHEMA_DIR" -name '*.ts' -type f | sort | while IFS= read -r schema_file; do
      # Skip if already included as a changed or imported file
      rel_path="${schema_file#$REPO_ROOT/}"
      if grep -qF "$rel_path" /tmp/pr_files.txt 2>/dev/null; then
        continue
      fi
      file_content=$(head -c 20000 "$schema_file")
      block="
#### ${rel_path}
\`\`\`typescript
${file_content}
\`\`\`
"
      append_within_budget "$block" || break
    done
  fi
fi

# Summary
echo "Context built: system=$(wc -c < /tmp/system_prompt.txt) bytes, user=${USED}/${BUDGET} bytes" >&2
