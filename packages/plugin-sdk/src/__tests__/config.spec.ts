import { describe, it, expect, vi } from "vitest";
import { z } from "zod";

import { defineConfig, loadConfig } from "../config.js";
import {
  AdapterInitializationError,
  ConfigValidationError,
} from "../errors.js";
import type { BaseAdapter } from "../adapters/common.js";
import type { ColophonyPlugin } from "../plugin-base.js";
import { createNoopLogger } from "../testing/noop-logger.js";

function createAdapterClass(
  overrides?: Partial<BaseAdapter>,
): new () => BaseAdapter {
  return class TestAdapter {
    id = overrides?.id ?? "test";
    name = overrides?.name ?? "Test";
    version = overrides?.version ?? "1.0.0";
    configSchema = overrides?.configSchema ?? z.object({ apiKey: z.string() });
    initialize = overrides?.initialize ?? vi.fn().mockResolvedValue(undefined);
    healthCheck =
      overrides?.healthCheck ??
      vi.fn().mockResolvedValue({ healthy: true, message: "ok" });
    destroy = overrides?.destroy ?? vi.fn().mockResolvedValue(undefined);
  } as unknown as new () => BaseAdapter;
}

describe("config", () => {
  it("defineConfig returns config as-is", () => {
    const config = { adapters: {} };
    expect(defineConfig(config)).toBe(config);
  });

  it("loadConfig initializes adapters from constructors", async () => {
    const initFn = vi.fn().mockResolvedValue(undefined);
    const Cls = createAdapterClass({ id: "smtp", initialize: initFn });

    const result = await loadConfig({
      config: { adapters: { email: Cls } },
      adapterConfigs: { email: { apiKey: "key123" } },
      logger: createNoopLogger(),
    });

    expect(initFn).toHaveBeenCalledWith({ apiKey: "key123" });
    expect(result.registry.has("email")).toBe(true);
  });

  it("loadConfig validates adapter config against configSchema", async () => {
    const Cls = createAdapterClass({ id: "strict" });

    await expect(
      loadConfig({
        config: { adapters: { email: Cls } },
        adapterConfigs: { email: {} }, // missing apiKey
        logger: createNoopLogger(),
      }),
    ).rejects.toThrow(ConfigValidationError);
  });

  it("loadConfig runs register then bootstrap on plugins", async () => {
    const order: string[] = [];

    const plugin: ColophonyPlugin = {
      manifest: {
        id: "test-plugin",
        name: "Test",
        version: "1.0.0",
        colophonyVersion: "2.0.0",
        description: "Test plugin",
        author: "Test",
        license: "MIT",
        category: "integration",
      },
      register: vi.fn(async () => {
        order.push("register");
      }),
      bootstrap: vi.fn(async () => {
        order.push("bootstrap");
      }),
      destroy: vi.fn(),
    };

    await loadConfig({
      config: { plugins: [plugin] },
      logger: createNoopLogger(),
    });

    expect(order).toEqual(["register", "bootstrap"]);
    expect(plugin.register).toHaveBeenCalledOnce();
    expect(plugin.bootstrap).toHaveBeenCalledOnce();
  });

  it("loadConfig processes multiple adapters", async () => {
    const EmailCls = createAdapterClass({
      id: "email-adapter",
      configSchema: z.object({}).passthrough(),
    });
    const StorageCls = createAdapterClass({
      id: "storage-adapter",
      configSchema: z.object({}).passthrough(),
    });

    const result = await loadConfig({
      config: { adapters: { email: EmailCls, storage: StorageCls } },
      logger: createNoopLogger(),
    });

    expect(result.registry.has("email")).toBe(true);
    expect(result.registry.has("storage")).toBe(true);
  });

  it("loadConfig propagates adapter initialization errors", async () => {
    const Cls = createAdapterClass({
      id: "broken",
      configSchema: z.object({}).passthrough(),
      initialize: vi.fn().mockRejectedValue(new Error("connection refused")),
    });

    await expect(
      loadConfig({
        config: { adapters: { email: Cls } },
        logger: createNoopLogger(),
      }),
    ).rejects.toThrow(AdapterInitializationError);
  });
});
