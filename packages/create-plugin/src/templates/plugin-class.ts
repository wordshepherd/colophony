import { toKebabCase, toPascalCase, toPluginId } from "../utils.js";
import type { PluginAnswers } from "../prompts.js";

export function generatePluginClass(answers: PluginAnswers): string {
  const pascal = toPascalCase(answers.name);
  const pluginId = toPluginId(answers.name);
  const hasAdapter =
    answers.pluginType === "adapter" || answers.pluginType === "full";
  const hasHooks =
    answers.pluginType === "integration" || answers.pluginType === "full";

  let adapterImport = "";
  let adapterTypes = "";
  if (hasAdapter) {
    const adapterType = (answers as { adapterType: string }).adapterType;
    adapterImport = `import { ${pascal}Adapter } from "./adapters/${toKebabCase(adapterType)}.adapter.js";\n`;
    adapterTypes = `\n    adapters: ["${adapterType}"],`;
  }

  const imports = [
    "ColophonyPlugin",
    "type PluginManifest",
    "type PluginRegisterContext",
  ];

  const registerBody: string[] = [];
  if (hasAdapter) {
    const adapterType = (answers as { adapterType: string }).adapterType;
    registerBody.push(
      `    context.registerAdapter("${adapterType}", new ${pascal}Adapter());`,
    );
  }
  if (hasHooks) {
    registerBody.push(
      `    // TODO: Register hooks`,
      `    // context.registerHook("submission.created", async (payload) => {`,
      `    //   context.logger.info("Submission created", { submissionId: payload.submissionId });`,
      `    // });`,
    );
  }

  return `import { ${imports.join(", ")} } from "@colophony/plugin-sdk";
${adapterImport}
export class ${pascal}Plugin extends ColophonyPlugin {
  readonly manifest: PluginManifest = {
    id: "${pluginId}",
    name: "${answers.name}",
    version: "0.1.0",
    colophonyVersion: "2.0.0",
    description: "${answers.description || `A Colophony plugin: ${answers.name}`}",
    author: "${answers.author}",
    license: "${answers.license}",
    category: "${answers.category}",${adapterTypes}
  };

  async register(context: PluginRegisterContext): Promise<void> {
${registerBody.length > 0 ? registerBody.join("\n") : "    // TODO: Register adapters, hooks, or UI extensions"}
  }
}

export default ${pascal}Plugin;
`;
}
