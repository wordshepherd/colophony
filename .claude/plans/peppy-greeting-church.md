# Plan: Migrate apps/web from Jest to Vitest

## Context

The monorepo has a test runner split: `apps/api` uses Vitest, `apps/web` uses Jest. This causes recurring gotchas (`vi.*` vs `jest.*` confusion, duplicate mock APIs, separate coverage configs). Migrating web to Vitest eliminates the split, unifies the test toolchain, and allows sharing patterns/setup across the monorepo.

## Design Decisions

1. **`globals: true`** — Unlike the API (`globals: false`), web tests will use implicit `describe/it/expect` globals. This avoids adding vitest imports to all ~72 files; only the ~59 files using `jest.*` APIs need `import { vi } from 'vitest'`. Can tighten later.
2. **Keep `.spec.ts(x)` pattern** — All existing files use `.spec`, no reason to expand.
3. **Convert local console-setup** rather than reuse root `test/vitest-console-setup.ts` — web has its own allowlist patterns (Radix UI DialogTitle/Description warnings).
4. **`@testing-library/jest-dom/vitest`** — Switch import path for proper Vitest matcher types.

## Implementation

### Phase 1: Dependencies (`apps/web/package.json`)

**Remove** from devDependencies:

- `jest`, `ts-jest`, `jest-environment-jsdom`, `@types/jest`

**Add** to devDependencies:

- `vitest` (`^4.1.0` — matches API)
- `@vitest/coverage-v8` (`^4.1.0`)
- `jsdom` (Vitest peer dep for `environment: 'jsdom'`)

**Update scripts:**

- `"test"`: `"vitest run"`
- `"test:watch"`: `"vitest"`
- `"test:cov"`: `"vitest run --coverage"`

E2E scripts unchanged (Playwright).

### Phase 2: Vitest config (`apps/web/vitest.config.ts` — new)

```typescript
import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  resolve: {
    alias: [
      { find: /^@\/(.*)$/, replacement: path.resolve(__dirname, "src/$1") },
      {
        find: "@colophony/api/trpc/client-types",
        replacement: path.resolve(__dirname, "../api/src/trpc/client-types.ts"),
      },
      {
        find: /^@colophony\/types$/,
        replacement: path.resolve(
          __dirname,
          "../../packages/types/src/index.ts",
        ),
      },
      {
        find: /^@colophony\/types\/(.*)$/,
        replacement: path.resolve(__dirname, "../../packages/types/src/$1"),
      },
    ],
  },
  test: {
    environment: "jsdom",
    globals: true,
    include: ["src/**/*.spec.{ts,tsx}"],
    exclude: [
      ".next/**",
      "node_modules/**",
      "e2e/**",
      "_v1/**",
      "**/*.flaky.test.*",
    ],
    sequence: { shuffle: true },
    setupFiles: ["./test/setup.ts"],
    testTimeout: 15_000,
    coverage: {
      provider: "v8",
      include: ["src/**/*.{ts,tsx}"],
      exclude: ["src/**/*.d.ts", "src/app/**/*", "src/components/ui/**/*"],
      reporter: ["text", "text-summary", "json-summary", "lcov"],
      reportsDirectory: "./coverage",
      thresholds: { statements: 42, branches: 65, functions: 31, lines: 42 },
    },
  },
});
```

Key: uses regex-based alias array to correctly handle both `@colophony/types` (exact) and `@colophony/types/csr` (subpath).

### Phase 3: TypeScript config (`apps/web/tsconfig.json`)

Add `"vitest/globals"` to `compilerOptions.types` so TS recognizes `describe`, `it`, `expect` as globals (previously provided by `@types/jest`).

### Phase 4: Console setup (`apps/web/test/console-setup.ts`)

Convert in place:

- `jest.SpyInstance` → `MockInstance` (import from `vitest`)
- `jest.spyOn` → `vi.spyOn`
- Add `import { afterEach, beforeEach, vi, type MockInstance } from 'vitest'`
- Keep all allowlist patterns and logic unchanged

### Phase 5: Test setup (`apps/web/test/setup.ts`)

Convert in place:

- `import "@testing-library/jest-dom"` → `import "@testing-library/jest-dom/vitest"`
- Remove `jest.setTimeout(15000)` (now in vitest config as `testTimeout`)
- All `jest.fn()` → `vi.fn()`, `jest.mock()` → `vi.mock()`
- Add `import { vi, afterEach } from 'vitest'`
- Exported mocks (`mockPush`, `mockReplace`, `mockBack`, `mockRefresh`) keep same names

### Phase 6: Mechanical replacement in ~59 test files

For each file containing `jest.*` calls:

1. Add `import { vi } from 'vitest'` at top (files using `Mock`/`MockedFunction` types add those too)
2. Replace all Jest API calls and types:

| Jest                             | Vitest                                                    |
| -------------------------------- | --------------------------------------------------------- |
| `jest.fn()`                      | `vi.fn()`                                                 |
| `jest.mock(`                     | `vi.mock(`                                                |
| `jest.spyOn(`                    | `vi.spyOn(`                                               |
| `jest.clearAllMocks()`           | `vi.clearAllMocks()`                                      |
| `jest.restoreAllMocks()`         | `vi.restoreAllMocks()`                                    |
| `jest.useFakeTimers()`           | `vi.useFakeTimers()`                                      |
| `jest.useRealTimers()`           | `vi.useRealTimers()`                                      |
| `jest.advanceTimersByTime(`      | `vi.advanceTimersByTime(`                                 |
| `jest.advanceTimersByTimeAsync(` | `vi.advanceTimersByTimeAsync(`                            |
| `jest.requireActual(`            | `vi.importActual(` (NOTE: returns Promise — must `await`) |
| `jest.Mock` (type)               | `Mock` (import from `vitest`)                             |
| `jest.MockedFunction<T>` (type)  | `MockedFunction<T>` (import from `vitest`)                |
| `jest.SpyInstance` (type)        | `MockInstance` (import from `vitest`)                     |

~545 replacements total. Mutable mock pattern (let var + factory closure) works identically in Vitest.

**`jest.requireActual` → `vi.importActual` migration note:** `vi.importActual` is async, so `jest.requireActual(...)` inside a `vi.mock` factory must become `await vi.importActual(...)` and the factory must be `async`. Affected file: `submission-form.spec.tsx:221`.

### Phase 6b: Remove redundant setup imports from ~20 test files

20 test files explicitly `import "../../../../test/setup"` (or import `mockPush` from it). Since Vitest runs `setupFiles` automatically, bare `import "../../../../test/setup"` lines cause double-execution of setup side effects. Fix:

- Files that only do `import "../../../../test/setup"` (bare import, no named imports): **remove the import entirely**
- Files that import named exports like `import { mockPush } from "../../../../test/setup"`: **keep the import** (needed for the mock reference)

### Phase 7: Delete `apps/web/jest.config.ts`

Remove after everything works.

## Files That Should NOT Change

- `apps/web/playwright.config.ts`, `apps/web/e2e/**` (Playwright, unrelated)
- `apps/api/**` (already on Vitest)
- `test/vitest-console-setup.ts` (root shared setup, stays as-is)
- `.github/workflows/ci.yml` (script-name based, no changes needed)
- Non-test source files in `apps/web/src/`

## Verification

1. `pnpm install` — resolve new deps
2. `pnpm --filter @colophony/web exec vitest run src/hooks/__tests__/use-debounce.spec.ts` — smoke test (uses fake timers)
3. `pnpm --filter @colophony/web test` — full suite (~72 files, shuffled)
4. `pnpm --filter @colophony/web test:cov` — coverage thresholds pass
5. `grep -rn "jest\.\|jest\.Mock\|jest\.SpyInstance\|jest\.MockedFunction" apps/web/src/ apps/web/test/ --include="*.spec.*" --include="*.ts"` — zero results (no stragglers)
6. `pnpm --filter @colophony/web type-check` — verifies `vitest/globals` types work
