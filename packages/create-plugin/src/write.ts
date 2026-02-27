import * as fs from "node:fs/promises";
import * as path from "node:path";
import { toKebabCase, toPluginId } from "./utils.js";
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
  const safeId = toPluginId(answers.name);
  const dirName = `colophony-plugin-${safeId}`;
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

  const dirs = new Set(
    Object.keys(input.files).map((p) =>
      path.dirname(path.join(input.outputDir, p)),
    ),
  );
  for (const dir of dirs) {
    await fs.mkdir(dir, { recursive: true });
  }

  await Promise.all(
    Object.entries(input.files).map(([relativePath, content]) =>
      fs.writeFile(path.join(input.outputDir, relativePath), content, "utf-8"),
    ),
  );
}
