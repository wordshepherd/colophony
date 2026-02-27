import * as fs from "node:fs/promises";
import * as path from "node:path";
import { toKebabCase } from "./utils.js";
import type { PluginAnswers } from "./prompts.js";
import { generatePackageJson } from "./templates/package-json.js";
import { generateTsConfig } from "./templates/tsconfig.js";
import { generatePluginClass } from "./templates/plugin-class.js";
import { generateAdapterClass } from "./templates/adapter-class.js";
import { generateTestFile } from "./templates/test-file.js";
import { generateReadme } from "./templates/readme.js";
import { generateGitignore } from "./templates/gitignore.js";
import { generateLicense } from "./templates/license.js";

export interface ScaffoldInput {
  outputDir: string;
  files: Record<string, string>;
}

export function buildFileMap(
  answers: PluginAnswers,
  options?: { cwd?: string },
): ScaffoldInput {
  const kebab = toKebabCase(answers.name);
  const dirName = `colophony-plugin-${kebab}`;
  const cwd = options?.cwd ?? process.cwd();
  const outputDir = path.join(cwd, dirName);

  const files: Record<string, string> = {
    "package.json": generatePackageJson(answers),
    "tsconfig.json": generateTsConfig(),
    "README.md": generateReadme(answers),
    ".gitignore": generateGitignore(),
    LICENSE: generateLicense({
      author: answers.author,
      license: answers.license,
    }),
    "src/index.ts": generatePluginClass(answers),
    "src/index.spec.ts": generateTestFile(answers),
  };

  const hasAdapter =
    answers.pluginType === "adapter" || answers.pluginType === "full";

  if (hasAdapter) {
    const adapterKebab = toKebabCase(
      (answers as { adapterType: string }).adapterType,
    );
    const adapterType = (
      answers as { adapterType: "email" | "payment" | "storage" | "search" }
    ).adapterType;
    files[`src/adapters/${adapterKebab}.adapter.ts`] = generateAdapterClass({
      name: answers.name,
      adapterType,
    });
  }

  return { outputDir, files };
}

export async function scaffoldProject(input: ScaffoldInput): Promise<void> {
  const exists = await fs
    .access(input.outputDir)
    .then(() => true)
    .catch(() => false);

  if (exists) {
    throw new Error(`Directory already exists: ${input.outputDir}`);
  }

  for (const [relativePath, content] of Object.entries(input.files)) {
    const fullPath = path.join(input.outputDir, relativePath);
    await fs.mkdir(path.dirname(fullPath), { recursive: true });
    await fs.writeFile(fullPath, content, "utf-8");
  }
}
