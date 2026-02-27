import { toPascalCase, toPluginId } from "../utils.js";
import type { PluginAnswers } from "../prompts.js";

export function generateTestFile(answers: PluginAnswers): string {
  const pascal = toPascalCase(answers.name);
  const pluginId = toPluginId(answers.name);
  const hasAdapter =
    answers.pluginType === "adapter" || answers.pluginType === "full";

  if (hasAdapter) {
    return `import { describe, it, expect } from "vitest";
import { createMockRegisterContext } from "@colophony/plugin-sdk/testing";
import { ${pascal}Plugin } from "./index.js";

describe("${pascal}Plugin", () => {
  it("has the correct manifest id", () => {
    const plugin = new ${pascal}Plugin();
    expect(plugin.manifest.id).toBe("${pluginId}");
  });

  it("registers the ${answers.adapterType} adapter", async () => {
    const plugin = new ${pascal}Plugin();
    const context = createMockRegisterContext();

    await plugin.register(context);

    expect(context.registeredAdapters).toHaveLength(1);
    expect(context.registeredAdapters[0].type).toBe("${answers.adapterType}");
  });
});
`;
  }

  return `import { describe, it, expect } from "vitest";
import { createTestHarness } from "@colophony/plugin-sdk/testing";
import { ${pascal}Plugin } from "./index.js";

describe("${pascal}Plugin", () => {
  it("has the correct manifest id", () => {
    const plugin = new ${pascal}Plugin();
    expect(plugin.manifest.id).toBe("${pluginId}");
  });

  it("registers without error", async () => {
    const harness = createTestHarness();
    const plugin = new ${pascal}Plugin();

    await harness.loadPlugin(plugin);
    await harness.teardown();
  });
});
`;
}
