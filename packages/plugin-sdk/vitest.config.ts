import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    include: ["src/**/*.{test,spec}.ts"],
    exclude: ["src/**/*.flaky.test.ts"],
    globals: false,
    sequence: {
      shuffle: true,
    },
    setupFiles: ["../../test/vitest-console-setup.ts"],
    coverage: {
      provider: "v8",
      include: ["src/**/*.ts"],
      exclude: ["src/**/*.{test,spec}.ts"],
      reporter: ["text", "text-summary", "json-summary", "lcov"],
      reportsDirectory: "./coverage",
      thresholds: {
        statements: 55,
        branches: 50,
        functions: 36,
        lines: 55,
      },
    },
  },
});
