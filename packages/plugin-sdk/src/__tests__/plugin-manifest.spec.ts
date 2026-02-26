import { describe, it, expect } from "vitest";

import { pluginManifestSchema } from "../plugin.js";

const validManifest = {
  id: "my-plugin",
  name: "My Plugin",
  version: "1.0.0",
  colophonyVersion: "2.0.0",
  description: "A test plugin",
  author: "Test Author",
  license: "MIT",
  category: "adapter" as const,
};

describe("pluginManifestSchema", () => {
  it("validates a valid manifest", () => {
    const result = pluginManifestSchema.safeParse(validManifest);
    expect(result.success).toBe(true);
  });

  it("rejects manifest with missing required fields", () => {
    const { id: _, ...incomplete } = validManifest;
    const result = pluginManifestSchema.safeParse(incomplete);
    expect(result.success).toBe(false);
  });

  it("rejects manifest with invalid version format", () => {
    const result = pluginManifestSchema.safeParse({
      ...validManifest,
      version: "not-semver",
    });
    expect(result.success).toBe(false);
  });

  it("accepts manifest without optional fields", () => {
    const result = pluginManifestSchema.safeParse(validManifest);
    expect(result.success).toBe(true);
  });

  it("validates adapter type enum", () => {
    const valid = pluginManifestSchema.safeParse({
      ...validManifest,
      adapters: ["email", "storage"],
    });
    expect(valid.success).toBe(true);

    const invalid = pluginManifestSchema.safeParse({
      ...validManifest,
      adapters: ["nonexistent"],
    });
    expect(invalid.success).toBe(false);
  });

  it("validates permission enum", () => {
    const valid = pluginManifestSchema.safeParse({
      ...validManifest,
      permissions: ["submissions:read", "email:send"],
    });
    expect(valid.success).toBe(true);

    const invalid = pluginManifestSchema.safeParse({
      ...validManifest,
      permissions: ["invalid:perm"],
    });
    expect(invalid.success).toBe(false);
  });

  it("validates category enum", () => {
    const valid = pluginManifestSchema.safeParse(validManifest);
    expect(valid.success).toBe(true);

    const invalid = pluginManifestSchema.safeParse({
      ...validManifest,
      category: "nonexistent",
    });
    expect(invalid.success).toBe(false);
  });
});
