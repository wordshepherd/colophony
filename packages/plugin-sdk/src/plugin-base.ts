import type { AdapterType, BaseAdapter } from "./adapters/common.js";
import type { HookHandlerOptions } from "./hooks/engine.js";
import type { HookId } from "./hooks/definitions.js";
import type { HookPayloadMap } from "./hooks/payloads.js";
import type { Logger } from "./logger.js";
import type { PluginManifest } from "./plugin.js";
import type { UIExtensionDeclaration } from "./ui/types.js";

export type AuditFn = (params: {
  action: string;
  resourceType: string;
  resourceId?: string;
  newValue?: unknown;
}) => Promise<void>;

export interface PluginRegisterContext {
  registerAdapter(type: AdapterType, adapter: BaseAdapter): void;
  registerHook<T extends HookId>(
    hookId: T,
    handler: (
      payload: HookPayloadMap[T],
    ) => HookPayloadMap[T] | void | Promise<HookPayloadMap[T]> | Promise<void>,
    options?: HookHandlerOptions,
  ): void;
  registerUIExtension(extension: UIExtensionDeclaration): void;
  logger: Logger;
}

export interface PluginBootstrapContext extends PluginRegisterContext {
  resolveAdapter<T extends BaseAdapter>(type: AdapterType): T;
  config: Record<string, unknown>;
  audit: AuditFn;
}

export abstract class ColophonyPlugin {
  abstract readonly manifest: PluginManifest;

  abstract register(context: PluginRegisterContext): Promise<void>;

  async bootstrap(_context: PluginBootstrapContext): Promise<void> {
    // Optional — override in subclass
  }

  async destroy(): Promise<void> {
    // Optional — override in subclass
  }
}
