import { describe, it, expect, vi } from "vitest";

import type { PluginManifest } from "../plugin.js";
import type { ColophonyPlugin } from "../plugin-base.js";
import { MockEmailAdapter } from "../testing/mock-adapters.js";
import { createMockRegisterContext } from "../testing/mock-context.js";
import { createNoopLogger } from "../testing/noop-logger.js";
import { createTestHarness } from "../testing/test-harness.js";

function createTestPlugin(
  overrides?: Partial<ColophonyPlugin>,
): ColophonyPlugin {
  return {
    manifest: {
      id: "test-plugin",
      name: "Test",
      version: "1.0.0",
      colophonyVersion: "2.0.0",
      description: "Test",
      author: "Test",
      license: "MIT",
      category: "integration",
    } satisfies PluginManifest,
    register: vi.fn().mockResolvedValue(undefined),
    bootstrap: vi.fn().mockResolvedValue(undefined),
    destroy: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  };
}

describe("testing utilities", () => {
  it("MockEmailAdapter records sent emails", async () => {
    const adapter = new MockEmailAdapter();
    await adapter.send({
      to: "user@example.com",
      subject: "Hello",
      html: "<p>Hi</p>",
    });

    expect(adapter.sentEmails).toHaveLength(1);
    expect(adapter.getLastEmail()?.to).toBe("user@example.com");
  });

  it("MockEmailAdapter.reset clears history", async () => {
    const adapter = new MockEmailAdapter();
    await adapter.send({
      to: "user@example.com",
      subject: "Test",
      html: "<p>Test</p>",
    });
    adapter.reset();
    expect(adapter.sentEmails).toHaveLength(0);
    expect(adapter.getLastEmail()).toBeUndefined();
  });

  it("createMockRegisterContext tracks registrations", () => {
    const ctx = createMockRegisterContext();
    const adapter = new MockEmailAdapter();

    ctx.registerAdapter("email", adapter);
    ctx.registerHook("submission.created", async () => {});
    ctx.registerUIExtension({
      point: "dashboard.widget",
      id: "test-widget",
      label: "Test",
      component: "TestWidget",
    });

    expect(ctx.registeredAdapters).toHaveLength(1);
    expect(ctx.registeredHooks).toHaveLength(1);
    expect(ctx.registeredUIExtensions).toHaveLength(1);
  });

  it("createTestHarness loadPlugin calls lifecycle", async () => {
    const harness = createTestHarness();
    const plugin = createTestPlugin();

    await harness.loadPlugin(plugin);

    expect(plugin.register).toHaveBeenCalledOnce();
    expect(plugin.bootstrap).toHaveBeenCalledOnce();
  });

  it("createTestHarness teardown calls destroy", async () => {
    const harness = createTestHarness();
    const plugin = createTestPlugin();

    await harness.loadPlugin(plugin);
    await harness.teardown();

    expect(plugin.destroy).toHaveBeenCalledOnce();
  });

  it("createNoopLogger does not throw", () => {
    const logger = createNoopLogger();
    expect(() => {
      logger.info("test");
      logger.warn("test");
      logger.error("test");
      logger.debug("test");
      logger.child({ key: "value" }).info("child");
    }).not.toThrow();
  });
});
