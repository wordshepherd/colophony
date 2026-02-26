import { z } from "zod";

import type { AdapterType } from "./adapters/common.js";

export type PluginCategory =
  | "adapter"
  | "integration"
  | "workflow"
  | "import-export"
  | "report"
  | "theme"
  | "block"
  | "notification";

export type PluginPermission =
  | "submissions:read"
  | "submissions:write"
  | "files:read"
  | "files:write"
  | "email:send"
  | "http:outbound"
  | "storage:read"
  | "storage:write"
  | "search:read"
  | "search:write"
  | "payment:read"
  | "payment:write"
  | "pipeline:read"
  | "pipeline:write"
  | "publications:read"
  | "publications:write"
  | "members:read"
  | "database:read"
  | "database:write";

export interface PluginManifest {
  id: string;
  name: string;
  version: string;
  colophonyVersion: string;
  description: string;
  author: string;
  license: string;
  category: PluginCategory;
  homepage?: string;
  adapters?: AdapterType[];
  ui?: string[];
  permissions?: PluginPermission[];
  dependencies?: Record<string, string>;
}

const semverPattern = /^\d+\.\d+\.\d+(?:-[\w.]+)?$/;

export const pluginManifestSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  version: z.string().regex(semverPattern, "Must be a valid semver version"),
  colophonyVersion: z
    .string()
    .regex(semverPattern, "Must be a valid semver version"),
  description: z.string().min(1),
  author: z.string().min(1),
  license: z.string().min(1),
  category: z.enum([
    "adapter",
    "integration",
    "workflow",
    "import-export",
    "report",
    "theme",
    "block",
    "notification",
  ]),
  homepage: z.string().url().optional(),
  adapters: z
    .array(
      z.enum(["email", "payment", "storage", "search", "auth", "newsletter"]),
    )
    .optional(),
  ui: z.array(z.string()).optional(),
  permissions: z
    .array(
      z.enum([
        "submissions:read",
        "submissions:write",
        "files:read",
        "files:write",
        "email:send",
        "http:outbound",
        "storage:read",
        "storage:write",
        "search:read",
        "search:write",
        "payment:read",
        "payment:write",
        "pipeline:read",
        "pipeline:write",
        "publications:read",
        "publications:write",
        "members:read",
        "database:read",
        "database:write",
      ]),
    )
    .optional(),
  dependencies: z.record(z.string(), z.string()).optional(),
});
