import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    include: ["src/**/*.{test,spec}.ts"],
    globals: false,
    setupFiles: ["../../test/vitest-console-setup.ts"],
    coverage: {
      provider: "v8",
      include: ["src/**/*.ts"],
      exclude: ["src/**/*.{test,spec}.ts"],
      reporter: ["text", "text-summary", "json-summary", "lcov"],
      reportsDirectory: "./coverage",
      thresholds: {
        statements: 36,
        branches: 41,
        functions: 48,
        lines: 36,
      },
    },
  },
});
