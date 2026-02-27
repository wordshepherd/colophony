import prompts from "prompts";
import { validatePluginName } from "./utils.js";

export type PluginCategory =
  | "adapter"
  | "integration"
  | "workflow"
  | "import-export"
  | "report"
  | "theme"
  | "block"
  | "notification";

export type PluginType = "integration" | "adapter" | "full";
export type AdapterKind = "email" | "payment" | "storage" | "search";

interface BaseAnswers {
  name: string;
  description: string;
  author: string;
  license: string;
  category: PluginCategory;
}

export interface IntegrationAnswers extends BaseAnswers {
  pluginType: "integration";
}

export interface AdapterAnswers extends BaseAnswers {
  pluginType: "adapter";
  adapterType: AdapterKind;
}

export interface FullAnswers extends BaseAnswers {
  pluginType: "full";
  adapterType: AdapterKind;
}

export type PluginAnswers = IntegrationAnswers | AdapterAnswers | FullAnswers;

export async function collectAnswers(): Promise<PluginAnswers> {
  const base = await prompts(
    [
      {
        type: "text",
        name: "name",
        message: "Plugin name",
        validate: (value: string) => validatePluginName(value),
      },
      {
        type: "text",
        name: "description",
        message: "Description",
        validate: (v: string) =>
          v.length > 200 ? "Description must be at most 200 characters" : true,
      },
      {
        type: "text",
        name: "author",
        message: "Author",
        validate: (v: string) =>
          !v.trim()
            ? "Author is required"
            : v.length > 100
              ? "Author must be at most 100 characters"
              : true,
      },
      {
        type: "text",
        name: "license",
        message: "License",
        initial: "MIT",
      },
      {
        type: "select",
        name: "category",
        message: "Plugin category",
        choices: [
          { title: "Adapter", value: "adapter" },
          { title: "Integration", value: "integration" },
          { title: "Workflow", value: "workflow" },
          { title: "Import/Export", value: "import-export" },
          { title: "Report", value: "report" },
          { title: "Theme", value: "theme" },
          { title: "Block", value: "block" },
          { title: "Notification", value: "notification" },
        ],
      },
      {
        type: "select",
        name: "pluginType",
        message: "Plugin type (what to scaffold)",
        choices: [
          {
            title: "Integration",
            value: "integration",
            description: "Plugin class with hook stubs",
          },
          {
            title: "Adapter",
            value: "adapter",
            description: "Plugin class + adapter implementation",
          },
          {
            title: "Full",
            value: "full",
            description: "Plugin class + adapter + hook stubs",
          },
        ],
      },
    ],
    { onCancel: () => process.exit(1) },
  );

  if (base.pluginType === "integration") {
    return base as IntegrationAnswers;
  }

  const { adapterType } = await prompts(
    [
      {
        type: "select",
        name: "adapterType",
        message: "Adapter type",
        choices: [
          { title: "Email", value: "email" },
          { title: "Payment", value: "payment" },
          { title: "Storage", value: "storage" },
          { title: "Search", value: "search" },
        ],
      },
    ],
    { onCancel: () => process.exit(1) },
  );

  return { ...base, adapterType } as PluginAnswers;
}
