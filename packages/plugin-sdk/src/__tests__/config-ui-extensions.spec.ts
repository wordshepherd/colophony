import { describe, it, expect, vi } from "vitest";

import { loadConfig } from "../config.js";
import type { ColophonyPlugin } from "../plugin-base.js";
import type { PluginManifest } from "../plugin.js";
import { createNoopLogger } from "../testing/noop-logger.js";

function makeManifest(id: string): PluginManifest {
  return {
    id,
    name: id,
    version: "1.0.0",
    colophonyVersion: "2.0.0",
    description: "Test",
    author: "Test",
    license: "MIT",
    category: "integration",
  };
}

describe("loadConfig — UI extensions", () => {
  it("returns empty uiExtensions when no plugins", async () => {
    const result = await loadConfig({
      config: {},
      logger: createNoopLogger(),
    });
    expect(result.uiExtensions).toEqual([]);
  });

  it("collects UI extensions from plugin register phase", async () => {
    const plugin: ColophonyPlugin = {
      manifest: makeManifest("ext-plugin"),
      register: vi.fn(async (ctx) => {
        ctx.registerUIExtension({
          point: "dashboard.widget",
          id: "test-widget",
          label: "Test Widget",
          component: "test.widget",
          order: 10,
        });
      }),
      bootstrap: vi.fn(),
      destroy: vi.fn(),
    };

    const result = await loadConfig({
      config: { plugins: [plugin] },
      logger: createNoopLogger(),
    });

    expect(result.uiExtensions).toHaveLength(1);
    expect(result.uiExtensions[0]).toMatchObject({
      point: "dashboard.widget",
      id: "test-widget",
      component: "test.widget",
    });
  });

  it("collects UI extensions from multiple plugins", async () => {
    const plugin1: ColophonyPlugin = {
      manifest: makeManifest("plugin-1"),
      register: vi.fn(async (ctx) => {
        ctx.registerUIExtension({
          point: "dashboard.widget",
          id: "widget-1",
          label: "Widget 1",
          component: "p1.widget",
        });
      }),
      bootstrap: vi.fn(),
      destroy: vi.fn(),
    };

    const plugin2: ColophonyPlugin = {
      manifest: makeManifest("plugin-2"),
      register: vi.fn(async (ctx) => {
        ctx.registerUIExtension({
          point: "settings.section",
          id: "settings-ext",
          label: "Settings Extension",
          component: "p2.settings",
        });
      }),
      bootstrap: vi.fn(),
      destroy: vi.fn(),
    };

    const result = await loadConfig({
      config: { plugins: [plugin1, plugin2] },
      logger: createNoopLogger(),
    });

    expect(result.uiExtensions).toHaveLength(2);
    expect(result.uiExtensions.map((e) => e.id)).toEqual([
      "widget-1",
      "settings-ext",
    ]);
  });

  it("includes extensions from bootstrap phase", async () => {
    const plugin: ColophonyPlugin = {
      manifest: makeManifest("bootstrap-plugin"),
      register: vi.fn(),
      bootstrap: vi.fn(async (ctx) => {
        ctx.registerUIExtension({
          point: "navigation.item",
          id: "nav-ext",
          label: "Nav Extension",
          component: "boot.nav",
        });
      }),
      destroy: vi.fn(),
    };

    const result = await loadConfig({
      config: { plugins: [plugin] },
      logger: createNoopLogger(),
    });

    expect(result.uiExtensions).toHaveLength(1);
    expect(result.uiExtensions[0].id).toBe("nav-ext");
  });
});
