import {
  registerComponent,
  resolveComponent,
  listRegisteredKeys,
} from "../plugin-components";

// Reset registry between tests — since it's a module-level Map, we clear it
beforeEach(() => {
  // Re-register nothing; resolveComponent returns null for unregistered
  // We need to clear by re-importing or just testing in order
});

describe("plugin-components registry", () => {
  it("registerComponent stores and resolveComponent retrieves", () => {
    const TestComponent = () => null;
    registerComponent("test.component", TestComponent as any);
    expect(resolveComponent("test.component")).toBe(TestComponent);
  });

  it("resolveComponent returns null for unregistered key", () => {
    expect(resolveComponent("nonexistent.key")).toBeNull();
  });

  it("registerComponent warns on duplicate and overwrites", () => {
    const warnSpy = jest.spyOn(console, "warn").mockImplementation(() => {});
    const First = () => null;
    const Second = () => null;

    registerComponent("dup.key", First as any);
    registerComponent("dup.key", Second as any);

    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining("Overwriting"),
    );
    expect(resolveComponent("dup.key")).toBe(Second);
    warnSpy.mockRestore();
  });

  it("listRegisteredKeys returns all keys", () => {
    registerComponent("key.a", (() => null) as any);
    registerComponent("key.b", (() => null) as any);

    const keys = listRegisteredKeys();
    expect(keys).toContain("key.a");
    expect(keys).toContain("key.b");
  });
});
