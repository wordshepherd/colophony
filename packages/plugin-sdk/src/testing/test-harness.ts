import type { AdapterType, BaseAdapter } from "../adapters/common.js";
import { HookEngine } from "../hooks/engine.js";
import type { ColophonyPlugin } from "../plugin-base.js";
import { AdapterRegistry } from "../registry.js";
import { createNoopLogger } from "./noop-logger.js";

export interface TestHarness {
  registry: AdapterRegistry;
  hookEngine: HookEngine;
  loadPlugin(plugin: ColophonyPlugin): Promise<void>;
  teardown(): Promise<void>;
}

export function createTestHarness(): TestHarness {
  const logger = createNoopLogger();
  const registry = new AdapterRegistry();
  const hookEngine = new HookEngine(logger);
  const loadedPlugins: ColophonyPlugin[] = [];

  return {
    registry,
    hookEngine,

    async loadPlugin(plugin: ColophonyPlugin) {
      await plugin.register({
        registerAdapter: (type, adapter) => registry.register(type, adapter),
        registerHook: (hookId, handler, options) => {
          hookEngine.on(hookId, handler, {
            ...options,
            pluginId: plugin.manifest.id,
          });
        },
        registerUIExtension: () => {},
        logger: logger.child({ plugin: plugin.manifest.id }),
      });

      await plugin.bootstrap({
        registerAdapter: (type, adapter) => registry.register(type, adapter),
        registerHook: (hookId, handler, options) => {
          hookEngine.on(hookId, handler, {
            ...options,
            pluginId: plugin.manifest.id,
          });
        },
        registerUIExtension: () => {},
        resolveAdapter: <T extends BaseAdapter>(type: AdapterType) =>
          registry.resolve<T>(type),
        config: {},
        audit: async () => {},
        logger: logger.child({ plugin: plugin.manifest.id }),
      });

      loadedPlugins.push(plugin);
    },

    async teardown() {
      for (const plugin of loadedPlugins) {
        await plugin.destroy();
      }
      loadedPlugins.length = 0;
      hookEngine.removeAll();
      await registry.destroyAll();
    },
  };
}
