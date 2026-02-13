---
name: new-e2e
description: Scaffold a Playwright browser E2E test with proper helpers and patterns.
---

# /new-e2e

Scaffold a Playwright browser E2E test with proper helpers and patterns.

## What this skill does

1. Creates a new E2E test file in `apps/web/e2e/`
2. Uses the existing helpers (`auth.ts`, `api-client.ts`, `db.ts`)
3. Sets up user creation, authentication, and page navigation
4. Follows strict selector patterns (role-based, scoped to `main`)

## Usage

```
/new-e2e <feature>            # Create e2e/<feature>.spec.ts
/new-e2e <feature> --editor   # Include editor role setup
```

## Instructions for Claude

When the user invokes `/new-e2e <feature>`:

1. **Create the test file** at `apps/web/e2e/<feature>.spec.ts`:

```typescript
import { test, expect } from "@playwright/test";
import { setupTestUser, loginAsBrowser } from "./helpers/auth";
import { prisma } from "./helpers/db";

test.describe("<Feature> Page", () => {
  let testUser: {
    email: string;
    password: string;
    userId: string;
    orgId: string;
  };

  test.beforeAll(async () => {
    testUser = await setupTestUser();
  });

  test.beforeEach(async ({ page }) => {
    await loginAsBrowser(page, testUser);
  });

  test.afterAll(async () => {
    await prisma.$disconnect();
  });

  test("should render the page", async ({ page }) => {
    await page.goto("/<feature>");
    await expect(page.getByRole("heading", { name: /TODO/i })).toBeVisible();
  });

  // TODO: Add test cases
});
```

For editor role tests (`--editor` flag):

```typescript
import { test, expect } from "@playwright/test";
import { setupTestUser, loginAsBrowser } from "./helpers/auth";
import { prisma } from "./helpers/db";

test.describe("<Feature> (Editor)", () => {
  let editorUser: {
    email: string;
    password: string;
    userId: string;
    orgId: string;
  };

  test.beforeAll(async () => {
    // Setup user with editor role
    editorUser = await setupTestUser();
    await prisma.organizationMember.updateMany({
      where: { userId: editorUser.userId },
      data: { role: "EDITOR" },
    });
  });

  test.beforeEach(async ({ page }) => {
    await loginAsBrowser(page, editorUser);
  });

  test.afterAll(async () => {
    await prisma.$disconnect();
  });

  test("should render the editor view", async ({ page }) => {
    await page.goto("/editor/<feature>");
    await expect(page.getByRole("heading", { name: /TODO/i })).toBeVisible();
  });

  // TODO: Add test cases
});
```

2. **Follow these patterns** (from existing tests):

**Selectors — always use strict, scoped selectors:**

```typescript
// GOOD: role-based, scoped to main
await page
  .locator("main")
  .getByRole("heading", { name: "My Submissions", exact: true });
await page.getByRole("button", { name: /submit/i });
await page.getByLabel("Title");

// BAD: fragile CSS selectors
await page.$(".submission-title");
await page.locator('[data-testid="submit-btn"]');
```

**Navigation — wait for network idle:**

```typescript
await page.goto("/submissions");
// or with explicit wait:
await page.goto("/submissions", { waitUntil: "networkidle" });
```

**Form interactions:**

```typescript
await page.getByLabel("Title").fill("My Submission");
await page.getByLabel("Category").selectOption("fiction");
await page.getByRole("button", { name: "Save Draft" }).click();
```

**Assertions — use locator-based expects:**

```typescript
await expect(page.getByText("Submission created")).toBeVisible();
await expect(page.getByRole("cell", { name: "DRAFT" })).toBeVisible();
```

**API calls for test data setup (prefer over UI):**

```typescript
import { trpcFetch } from "./helpers/api-client";

// Create a submission via API instead of clicking through UI
const submission = await trpcFetch(
  "submissions.create",
  {
    title: "Test Story",
    content: "Test content",
  },
  { token: testUser.accessToken, orgId: testUser.orgId },
);
```

**Direct DB setup for complex state:**

```typescript
import { prisma } from "./helpers/db";

// Set submission status directly (skip UI workflow)
await prisma.submission.update({
  where: { id: submission.id },
  data: { status: "SUBMITTED" },
});
```

3. **Inform the user**:

```
Created:
- apps/web/e2e/<feature>.spec.ts

Available helpers (already exist, just import):
- setupTestUser() — registers user + org via API
- loginAsBrowser(page, user) — sets tokens in localStorage (fast)
- loginViaForm(page, email, password) — uses actual login form (slow, for login tests only)
- trpcFetch(procedure, input, opts) — direct tRPC API calls with 429 retry
- prisma — superuser PrismaClient for test data setup

Run with:
  pnpm --filter @colophony/web test:e2e
  pnpm --filter @colophony/web test:e2e:ui  (interactive)

Requires:
  docker-compose up -d
  pnpm dev (or let playwright.config.ts auto-start)
```

## Important notes

- Playwright tests are **browser-level** — they test the full stack (frontend + API + DB)
- Use `loginAsBrowser()` for speed, `loginViaForm()` only when testing the login form itself
- Prefer API/DB setup over UI clicks for test data — faster and more reliable
- Rate limiter is active — the API helper retries on 429 automatically
- Tests run in Chromium only (configured in `playwright.config.ts`)
- Each test file gets its own worker — tests within a file run sequentially
