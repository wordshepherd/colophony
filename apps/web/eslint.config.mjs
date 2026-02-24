import coreWebVitals from "eslint-config-next/core-web-vitals";
import typescript from "eslint-config-next/typescript";

const eslintConfig = [
  ...coreWebVitals,
  ...typescript,
  {
    ignores: [".next/**", "out/**", "build/**", "coverage/**", "tailwind.config.js", "postcss.config.js", "next-env.d.ts"],
  },
  {
    rules: {
      // Match monorepo base config: allow _-prefixed vars for intentionally unused bindings
      "@typescript-eslint/no-unused-vars": ["warn", { argsIgnorePattern: "^_", varsIgnorePattern: "^_" }],
      // React Hook Form's watch() is incompatible with React Compiler memoization.
      // This is a known RHF limitation — the compiler skips these components automatically.
      "react-hooks/incompatible-library": "off",
      "no-restricted-imports": ["error", {
        patterns: [{
          group: ["@colophony/api/**"],
          message: "Import types from @colophony/api/trpc/client-types only (via src/lib/trpc.ts).",
        }],
      }],
    },
  },
  {
    files: ["src/lib/trpc.ts"],
    rules: {
      "no-restricted-imports": "off",
    },
  },
  {
    files: ["e2e/**/*.ts"],
    rules: {
      // Playwright fixture `use()` callback triggers false positives
      "react-hooks/rules-of-hooks": "off",
      "no-restricted-imports": "off",
    },
  },
];

export default eslintConfig;
