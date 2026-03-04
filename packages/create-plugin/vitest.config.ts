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
        statements: 71,
        branches: 63,
        functions: 70,
        lines: 71,
      },
    },
  },
});
