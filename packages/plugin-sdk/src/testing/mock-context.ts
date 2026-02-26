import type { AdapterType, BaseAdapter } from "../adapters/common.js";
import type { HookHandlerOptions } from "../hooks/engine.js";
import type { HookId } from "../hooks/definitions.js";
import type { HookPayloadMap } from "../hooks/payloads.js";
import type {
  AuditFn,
  PluginBootstrapContext,
  PluginRegisterContext,
} from "../plugin-base.js";
import type { UIExtensionDeclaration } from "../ui/types.js";
import { createNoopLogger } from "./noop-logger.js";

export interface MockRegisterContext extends PluginRegisterContext {
  registeredAdapters: Array<{ type: AdapterType; adapter: BaseAdapter }>;
  registeredHooks: Array<{
    hookId: HookId;
    handler: (payload: unknown) => unknown;
    options?: HookHandlerOptions;
  }>;
  registeredUIExtensions: UIExtensionDeclaration[];
}

export function createMockRegisterContext(): MockRegisterContext {
  const ctx: MockRegisterContext = {
    registeredAdapters: [],
    registeredHooks: [],
    registeredUIExtensions: [],
    logger: createNoopLogger(),

    registerAdapter(type: AdapterType, adapter: BaseAdapter) {
      ctx.registeredAdapters.push({ type, adapter });
    },

    registerHook<T extends HookId>(
      hookId: T,
      handler: (payload: HookPayloadMap[T]) => void | Promise<void>,
      options?: HookHandlerOptions,
    ) {
      ctx.registeredHooks.push({
        hookId,
        handler: handler as (payload: unknown) => unknown,
        options,
      });
    },

    registerUIExtension(extension: UIExtensionDeclaration) {
      ctx.registeredUIExtensions.push(extension);
    },
  };

  return ctx;
}

export function createMockBootstrapContext(
  overrides?: Partial<PluginBootstrapContext>,
): PluginBootstrapContext {
  const registerCtx = createMockRegisterContext();
  const noopAudit: AuditFn = async () => {};

  return {
    ...registerCtx,
    resolveAdapter: (_type: AdapterType) => {
      throw new Error("No adapter registered in mock context");
    },
    config: {},
    audit: noopAudit,
    ...overrides,
  } as PluginBootstrapContext;
}
