import type { ComponentType } from "react";
import {
  registerComponent,
  resolveComponent,
  listRegisteredKeys,
  type PluginComponentProps,
} from "../plugin-components";

const stub = (() => null) as unknown as ComponentType<PluginComponentProps>;

describe("plugin-components registry", () => {
  it("registerComponent stores and resolveComponent retrieves", () => {
    const TestComponent = stub;
    registerComponent("test.component", TestComponent);
    expect(resolveComponent("test.component")).toBe(TestComponent);
  });

  it("resolveComponent returns null for unregistered key", () => {
    expect(resolveComponent("nonexistent.key")).toBeNull();
  });

  it("registerComponent warns on duplicate and overwrites", () => {
    const warnSpy = jest.spyOn(console, "warn").mockImplementation(() => {});
    const First = stub;
    const Second = (() =>
      null) as unknown as ComponentType<PluginComponentProps>;

    registerComponent("dup.key", First);
    registerComponent("dup.key", Second);

    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining("Overwriting"),
    );
    expect(resolveComponent("dup.key")).toBe(Second);
    warnSpy.mockRestore();
  });

  it("listRegisteredKeys returns all keys", () => {
    registerComponent("key.a", stub);
    registerComponent("key.b", stub);

    const keys = listRegisteredKeys();
    expect(keys).toContain("key.a");
    expect(keys).toContain("key.b");
  });
});
