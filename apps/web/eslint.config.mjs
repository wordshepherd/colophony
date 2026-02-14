import { dirname } from "path";
import { fileURLToPath } from "url";
import { FlatCompat } from "@eslint/eslintrc";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const compat = new FlatCompat({
  baseDirectory: __dirname,
});

const eslintConfig = [
  ...compat.extends("next/core-web-vitals", "next/typescript"),
  {
    ignores: [".next/**", "out/**", "build/**", "tailwind.config.js", "postcss.config.js", "next-env.d.ts"],
  },
  {
    rules: {
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
