import type { AdapterType, BaseAdapter } from "./adapters/common.js";
import { AdapterInitializationError, ConfigValidationError } from "./errors.js";
import { HookEngine } from "./hooks/engine.js";
import type { Logger } from "./logger.js";
import type { ColophonyPlugin } from "./plugin-base.js";
import { AdapterRegistry } from "./registry.js";
import type { UIExtensionDeclaration } from "./ui/types.js";

export type AdapterConstructor<T extends BaseAdapter = BaseAdapter> =
  new () => T;

export interface ColophonyConfig {
  adapters?: Partial<Record<AdapterType, AdapterConstructor>>;
  plugins?: ColophonyPlugin[];
}

export interface LoadConfigOptions {
  config: ColophonyConfig;
  adapterConfigs?: Partial<Record<AdapterType, Record<string, unknown>>>;
  logger: Logger;
  audit?: (params: {
    action: string;
    resourceType: string;
    resourceId?: string;
    newValue?: unknown;
  }) => Promise<void>;
}

export interface LoadConfigResult {
  registry: AdapterRegistry;
  hookEngine: HookEngine;
  plugins: ColophonyPlugin[];
  uiExtensions: UIExtensionDeclaration[];
}

export function defineConfig(config: ColophonyConfig): ColophonyConfig {
  return config;
}

export async function loadConfig(
  options: LoadConfigOptions,
): Promise<LoadConfigResult> {
  const { config, adapterConfigs, logger, audit } = options;
  const registry = new AdapterRegistry();
  const hookEngine = new HookEngine(logger);
  const plugins = config.plugins ?? [];

  // Phase 1: Initialize adapters
  if (config.adapters) {
    for (const [type, Ctor] of Object.entries(config.adapters) as [
      AdapterType,
      AdapterConstructor,
    ][]) {
      const adapter = new Ctor();
      const rawConfig = adapterConfigs?.[type] ?? {};

      // Validate config against adapter schema
      const result = adapter.configSchema.safeParse(rawConfig);
      if (!result.success) {
        throw new ConfigValidationError(
          `Config validation failed for adapter "${adapter.id}": ${
            "error" in result ? String(result.error) : "Invalid configuration"
          }`,
        );
      }

      try {
        await adapter.initialize(result.data as Record<string, unknown>);
      } catch (err) {
        throw new AdapterInitializationError(adapter.id, err);
      }

      registry.register(type, adapter);
      logger.info(`Adapter "${adapter.id}" (${type}) initialized`);
    }
  }

  const noopAudit = async () => {};
  const auditFn = audit ?? noopAudit;

  // Phase 2: Plugin register
  const uiExtensions: UIExtensionDeclaration[] = [];
  for (const plugin of plugins) {
    await plugin.register({
      registerAdapter: (type, adapter) => registry.register(type, adapter),
      registerHook: (hookId, handler, hookOptions) => {
        hookEngine.on(hookId, handler, {
          ...hookOptions,
          pluginId: plugin.manifest.id,
        });
      },
      registerUIExtension: (ext) => uiExtensions.push(ext),
      logger: logger.child({ plugin: plugin.manifest.id }),
    });
  }

  // Phase 3: Plugin bootstrap
  for (const plugin of plugins) {
    await plugin.bootstrap({
      registerAdapter: (type, adapter) => registry.register(type, adapter),
      registerHook: (hookId, handler, hookOptions) => {
        hookEngine.on(hookId, handler, {
          ...hookOptions,
          pluginId: plugin.manifest.id,
        });
      },
      registerUIExtension: (ext) => uiExtensions.push(ext),
      resolveAdapter: <T extends BaseAdapter>(type: AdapterType) =>
        registry.resolve<T>(type),
      config: {},
      audit: auditFn,
      logger: logger.child({ plugin: plugin.manifest.id }),
    });
  }

  return { registry, hookEngine, plugins, uiExtensions };
}
