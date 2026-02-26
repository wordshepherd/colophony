import type { Logger } from "../logger.js";
import { HOOKS, type HookId } from "./definitions.js";
import type { HookPayloadMap } from "./payloads.js";

interface HookHandler {
  pluginId?: string;
  priority: number;
  handler: (payload: unknown) => unknown | Promise<unknown>;
}

export interface HookHandlerOptions {
  priority?: number;
  pluginId?: string;
}

export class HookEngine {
  private listeners = new Map<HookId, HookHandler[]>();
  private logger: Logger;

  constructor(logger: Logger) {
    this.logger = logger;
  }

  on<T extends HookId>(
    hookId: T,
    handler: (
      payload: HookPayloadMap[T],
    ) => HookPayloadMap[T] | void | Promise<HookPayloadMap[T]> | Promise<void>,
    options?: HookHandlerOptions,
  ): () => void {
    const entry: HookHandler = {
      pluginId: options?.pluginId,
      priority: options?.priority ?? 100,
      handler: handler as (payload: unknown) => unknown,
    };

    const existing = this.listeners.get(hookId) ?? [];
    existing.push(entry);
    existing.sort((a, b) => a.priority - b.priority);
    this.listeners.set(hookId, existing);

    return () => {
      const list = this.listeners.get(hookId);
      if (!list) return;
      const idx = list.indexOf(entry);
      if (idx !== -1) list.splice(idx, 1);
    };
  }

  async executeAction<T extends HookId>(
    hookId: T,
    payload: HookPayloadMap[T],
  ): Promise<void> {
    const handlers = this.listeners.get(hookId);
    if (!handlers?.length) return;

    for (const entry of handlers) {
      try {
        await entry.handler(payload);
      } catch (err) {
        this.logger.error(
          `Hook "${hookId}" handler${entry.pluginId ? ` (plugin: ${entry.pluginId})` : ""} threw an error`,
          err,
        );
      }
    }
  }

  async executeFilter<T extends HookId>(
    hookId: T,
    payload: HookPayloadMap[T],
  ): Promise<HookPayloadMap[T]> {
    const handlers = this.listeners.get(hookId);
    if (!handlers?.length) return payload;

    let current = payload;
    for (const entry of handlers) {
      try {
        const result = await entry.handler(current);
        if (result !== undefined && result !== null) {
          current = result as HookPayloadMap[T];
        }
      } catch (err) {
        this.logger.error(
          `Filter "${hookId}" handler${entry.pluginId ? ` (plugin: ${entry.pluginId})` : ""} threw an error — passing through`,
          err,
        );
      }
    }

    return current;
  }

  getListenerCount(hookId: HookId): number {
    return this.listeners.get(hookId)?.length ?? 0;
  }

  removeAll(hookId?: HookId): void {
    if (hookId) {
      this.listeners.delete(hookId);
    } else {
      this.listeners.clear();
    }
  }

  /** Returns all registered hook definitions. */
  getHookDefinitions(): typeof HOOKS {
    return HOOKS;
  }
}
