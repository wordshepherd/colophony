import { toKebabCase } from "../utils.js";
import type { PluginAnswers } from "../prompts.js";

export function generatePackageJson(answers: PluginAnswers): string {
  const kebab = toKebabCase(answers.name);
  const pkg = {
    name: `colophony-plugin-${kebab}`,
    version: "0.1.0",
    description: answers.description || `A Colophony plugin: ${answers.name}`,
    type: "module",
    main: "./dist/index.js",
    types: "./dist/index.d.ts",
    exports: {
      ".": {
        types: "./dist/index.d.ts",
        default: "./dist/index.js",
      },
    },
    scripts: {
      build: "tsc",
      clean: "rm -rf dist",
      "type-check": "tsc --noEmit",
      test: "vitest run",
      "test:watch": "vitest",
    },
    dependencies: {
      "@colophony/plugin-sdk": "^0.0.0",
      zod: "^4.0.0",
    },
    devDependencies: {
      typescript: "^5.7.0",
      vitest: "^4.0.0",
    },
    license: answers.license || "MIT",
  };

  return JSON.stringify(pkg, null, 2) + "\n";
}
