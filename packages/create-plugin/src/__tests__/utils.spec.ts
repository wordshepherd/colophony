import { describe, it, expect } from "vitest";
import {
  toKebabCase,
  toPascalCase,
  toPluginId,
  validatePluginName,
} from "../utils.js";

describe("toKebabCase", () => {
  it("converts spaces to hyphens", () => {
    expect(toKebabCase("My Plugin")).toBe("my-plugin");
  });

  it("converts PascalCase to kebab-case", () => {
    expect(toKebabCase("MyPlugin")).toBe("my-plugin");
  });

  it("returns lowercase as-is", () => {
    expect(toKebabCase("simple")).toBe("simple");
  });
});

describe("toPascalCase", () => {
  it("converts kebab-case to PascalCase", () => {
    expect(toPascalCase("my-plugin")).toBe("MyPlugin");
  });

  it("converts spaces to PascalCase", () => {
    expect(toPascalCase("my cool plugin")).toBe("MyCoolPlugin");
  });
});

describe("toPluginId", () => {
  it("strips special characters and converts to kebab", () => {
    expect(toPluginId("My Plugin!@#")).toBe("my-plugin");
  });

  it("handles already clean input", () => {
    expect(toPluginId("my-plugin")).toBe("my-plugin");
  });
});

describe("validatePluginName", () => {
  it("returns true for valid names", () => {
    expect(validatePluginName("my-plugin")).toBe(true);
  });

  it("rejects empty string", () => {
    expect(validatePluginName("")).not.toBe(true);
  });

  it("rejects too-long names", () => {
    expect(validatePluginName("a".repeat(51))).not.toBe(true);
  });

  it("rejects names starting with a hyphen", () => {
    expect(validatePluginName("-bad")).not.toBe(true);
  });

  it("rejects single character names", () => {
    expect(validatePluginName("a")).not.toBe(true);
  });
});
