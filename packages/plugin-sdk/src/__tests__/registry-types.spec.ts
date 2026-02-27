import { describe, it, expect } from "vitest";
import {
  pluginRegistryEntrySchema,
  pluginRegistrySchema,
} from "../registry-types.js";

function makeValidEntry(overrides?: Record<string, unknown>) {
  return {
    id: "colophony-plugin-example",
    name: "Example Plugin",
    version: "1.0.0",
    colophonyVersion: "2.0.0",
    description: "An example plugin for testing.",
    author: "Test Author",
    license: "MIT",
    category: "adapter",
    npmPackage: "@colophony/plugin-example",
    ...overrides,
  };
}

describe("pluginRegistryEntrySchema", () => {
  it("validates a complete registry entry", () => {
    const entry = makeValidEntry({
      readme: "# Example\n\nA full readme.",
      repository: "https://github.com/example/plugin",
      downloads: 1500,
      tags: ["email", "adapter"],
      verified: true,
      iconUrl: "https://example.com/icon.png",
      configExample: 'new ExamplePlugin({ key: "value" })',
      installCommand: "pnpm add @colophony/plugin-example",
      homepage: "https://example.com",
      permissions: ["email:send", "http:outbound"],
    });

    const result = pluginRegistryEntrySchema.safeParse(entry);
    expect(result.success).toBe(true);
  });

  it("requires npmPackage field", () => {
    const { npmPackage: _, ...entry } = makeValidEntry();
    const result = pluginRegistryEntrySchema.safeParse(entry);
    expect(result.success).toBe(false);
  });

  it("inherits PluginManifest validation", () => {
    const entry = makeValidEntry({ version: "not-semver" });
    const result = pluginRegistryEntrySchema.safeParse(entry);
    expect(result.success).toBe(false);
  });

  it("validates array via pluginRegistrySchema", () => {
    const entries = [
      makeValidEntry({ id: "plugin-a" }),
      makeValidEntry({ id: "plugin-b" }),
    ];
    const result = pluginRegistrySchema.safeParse(entries);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).toHaveLength(2);
    }
  });

  it("allows minimal entry with only manifest + npmPackage", () => {
    const entry = makeValidEntry();
    const result = pluginRegistryEntrySchema.safeParse(entry);
    expect(result.success).toBe(true);
  });
});
