import { z } from "zod";
import { pluginManifestSchema } from "./plugin.js";

export const pluginRegistryEntrySchema = pluginManifestSchema.extend({
  npmPackage: z.string().min(1),
  readme: z.string().optional(),
  repository: z.string().url().optional(),
  downloads: z.number().int().nonnegative().optional(),
  tags: z.array(z.string()).optional(),
  verified: z.boolean().optional(),
  iconUrl: z.string().url().optional(),
  configExample: z.string().optional(),
  installCommand: z.string().optional(),
});

export type PluginRegistryEntry = z.infer<typeof pluginRegistryEntrySchema>;

export const pluginRegistrySchema = z.array(pluginRegistryEntrySchema);
export type PluginRegistry = z.infer<typeof pluginRegistrySchema>;
