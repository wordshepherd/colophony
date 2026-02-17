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
      // Downgraded to warn: existing OIDC guard clauses use synchronous setState
      // in effects for early returns. Refactor deferred — see backlog.
      "react-hooks/set-state-in-effect": "warn",
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
];

export default eslintConfig;
