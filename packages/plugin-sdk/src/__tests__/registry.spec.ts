import { describe, it, expect, vi, beforeEach } from "vitest";
import { z } from "zod";

import { AdapterNotFoundError } from "../errors.js";
import { AdapterRegistry } from "../registry.js";
import type { BaseAdapter } from "../adapters/common.js";

function createStubAdapter(overrides?: Partial<BaseAdapter>): BaseAdapter {
  return {
    id: "stub",
    name: "Stub Adapter",
    version: "1.0.0",
    configSchema: z.object({}).passthrough(),
    initialize: vi.fn().mockResolvedValue(undefined),
    healthCheck: vi.fn().mockResolvedValue({ healthy: true, message: "ok" }),
    destroy: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  };
}

describe("AdapterRegistry", () => {
  let registry: AdapterRegistry;

  beforeEach(() => {
    registry = new AdapterRegistry();
  });

  it("registers and resolves an adapter", () => {
    const adapter = createStubAdapter({ id: "smtp" });
    registry.register("email", adapter);
    expect(registry.resolve("email")).toBe(adapter);
  });

  it("throws AdapterNotFoundError for unregistered type", () => {
    expect(() => registry.resolve("payment")).toThrow(AdapterNotFoundError);
  });

  it("tryResolve returns null for unregistered type", () => {
    expect(registry.tryResolve("storage")).toBeNull();
  });

  it("has() returns true for registered type", () => {
    registry.register("email", createStubAdapter());
    expect(registry.has("email")).toBe(true);
    expect(registry.has("payment")).toBe(false);
  });

  it("listRegistered returns adapter info", () => {
    registry.register(
      "email",
      createStubAdapter({ id: "smtp", name: "SMTP", version: "2.0.0" }),
    );
    const list = registry.listRegistered("email");
    expect(list).toHaveLength(1);
    expect(list[0]).toEqual({
      id: "smtp",
      name: "SMTP",
      version: "2.0.0",
      type: "email",
      active: true,
    });
    expect(registry.listRegistered("payment")).toHaveLength(0);
  });

  it("destroyAll calls destroy on all adapters", async () => {
    const a1 = createStubAdapter({ id: "a1" });
    const a2 = createStubAdapter({ id: "a2" });
    registry.register("email", a1);
    registry.register("storage", a2);

    await registry.destroyAll();

    expect(a1.destroy).toHaveBeenCalledOnce();
    expect(a2.destroy).toHaveBeenCalledOnce();
    expect(registry.has("email")).toBe(false);
  });

  it("listAllTypes returns types with registrations", () => {
    registry.register("email", createStubAdapter());
    registry.register("search", createStubAdapter());
    const types = registry.listAllTypes();
    expect(types).toContain("email");
    expect(types).toContain("search");
    expect(types).toHaveLength(2);
  });
});
