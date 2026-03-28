---
name: pre-pr
description: Pre-flight validation before PR creation — type-check, lint, and test suite.
---

# /pre-pr

Run the full validation suite before creating a PR. Catches CI failures locally.

## What this skill does

1. Runs type-check (`pnpm type-check`)
2. Runs lint (`pnpm lint`)
3. Runs unit tests (`pnpm test`)
4. Reports results and fixes any failures before proceeding

## Usage

```
/pre-pr
```

Typically run before `/end-session` or as part of it (end-session chains this automatically before pushing).

## Instructions for Claude

When the user invokes `/pre-pr`, run the following validation sequence. Each step must pass before proceeding to the next. If any step fails, fix the issue and re-run that step before continuing.

### Step 1: Check for uncommitted changes

```bash
git status --short
```

If there are unstaged changes, warn the user — validation runs against the current file state, not the staged state. This is informational, not blocking.

### Step 2: Type-check

```bash
pnpm type-check
```

If type errors are found:

1. Read the error output carefully — identify the root cause (not just the symptom)
2. Fix the errors using the Edit tool
3. Re-run `pnpm type-check` to verify the fix
4. Repeat until clean

### Step 3: Lint

```bash
pnpm lint
```

If lint errors are found:

1. Fix the errors (the post-edit-lint hook should have caught most, but cross-file issues can slip through)
2. Re-run `pnpm lint` to verify
3. Repeat until clean

### Step 4: Unit tests

```bash
pnpm test
```

If tests fail:

1. Read the failure output — distinguish between:
   - **Test fixture issues** (invalid UUIDs, wrong enum values, missing fields) — fix the fixture
   - **Actual bugs** in the implementation — fix the code
   - **Stale mocks** (mock doesn't match current interface) — update the mock
   - **Flaky tests** (passes on re-run) — note it but don't block
2. Fix and re-run until green
3. If a test is genuinely flaky (passes on second run with no changes), note it in the session summary but proceed

### Step 5: Report

Print a summary:

```
## Pre-PR Validation

- Type-check: PASS
- Lint: PASS
- Tests: PASS (N suites, M tests)

[If any fixes were made:]
### Fixes Applied
- [file:line] — [what was fixed and why]

Ready for PR.
```

If any step could not be resolved after 3 attempts, stop and report the blocking issue to the user rather than looping indefinitely.

## Important notes

- This skill does NOT commit changes. Fixes are applied to the working tree — the caller (user or `/end-session`) handles committing.
- This skill does NOT run E2E/Playwright tests — those require dev servers and are validated by CI. The goal here is to catch the failures that most commonly slip through: type errors, lint violations, and unit test regressions.
- Max 3 fix-and-retry cycles per step. If still failing after 3 rounds, report and let the user decide.
- If `pnpm test` takes longer than 5 minutes, it may be hanging — check for stuck workers or missing test teardown.
