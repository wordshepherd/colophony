/**
 * Global Vitest setup: fail tests that produce unexpected console.error/warn.
 *
 * Spies on console.error and console.warn in beforeEach. In afterEach, any
 * calls that don't match the allowlist cause a test failure. Tests that
 * install their own spy (vi.spyOn(console, 'error')) are auto-detected via
 * identity check and skipped.
 */
import { afterEach, beforeEach, vi, type MockInstance } from "vitest";

const ALLOWED_ERROR_PATTERNS: RegExp[] = [
  /The above error occurred in the <\w+> component/,
  /React will try to recreate this component tree/,
  /An update to .+ inside a test was not wrapped in act/,
  /Warning: An update to/,
];

const ALLOWED_WARN_PATTERNS: RegExp[] = [];

function isAllowed(args: unknown[], patterns: RegExp[]): boolean {
  const msg = args.map(String).join(" ");
  return patterns.some((p) => p.test(msg));
}

function formatCalls(calls: unknown[][]): string {
  return calls
    .map((args, i) => `  [${i + 1}] ${args.map(String).join(" ")}`)
    .join("\n");
}

let errorSpy: MockInstance;
let warnSpy: MockInstance;

beforeEach(() => {
  errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
  warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
});

afterEach(() => {
  // Identity check: if a test replaced our spy, skip enforcement
  const testOverrodeError = console.error !== errorSpy;
  const testOverrodeWarn = console.warn !== warnSpy;

  if (!testOverrodeError) {
    const unexpected = errorSpy.mock.calls.filter(
      (args) => !isAllowed(args, ALLOWED_ERROR_PATTERNS),
    );
    errorSpy.mockRestore();
    if (unexpected.length > 0) {
      throw new Error(
        `Test produced ${unexpected.length} unexpected console.error call(s):\n` +
          formatCalls(unexpected) +
          "\n\nTo fix: suppress the root cause, or add a pattern to ALLOWED_ERROR_PATTERNS " +
          "in test/vitest-console-setup.ts",
      );
    }
  } else {
    errorSpy.mockRestore();
  }

  if (!testOverrodeWarn) {
    const unexpected = warnSpy.mock.calls.filter(
      (args) => !isAllowed(args, ALLOWED_WARN_PATTERNS),
    );
    warnSpy.mockRestore();
    if (unexpected.length > 0) {
      throw new Error(
        `Test produced ${unexpected.length} unexpected console.warn call(s):\n` +
          formatCalls(unexpected) +
          "\n\nTo fix: suppress the root cause, or add a pattern to ALLOWED_WARN_PATTERNS " +
          "in test/vitest-console-setup.ts",
      );
    }
  } else {
    warnSpy.mockRestore();
  }
});
