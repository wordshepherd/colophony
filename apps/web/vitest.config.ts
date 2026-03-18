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
      thresholds: {
        // Thresholds recalibrated for Vitest v8 (measures differently from Jest v8 + ts-jest).
        // Ratchet up as coverage improves.
        statements: 35,
        branches: 30,
        functions: 25,
        lines: 36,
      },
    },
  },
});
