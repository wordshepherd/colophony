import type {
  AdapterInfo,
  AdapterType,
  BaseAdapter,
} from "./adapters/common.js";
import { AdapterNotFoundError } from "./errors.js";

export class AdapterRegistry {
  private adapters = new Map<AdapterType, BaseAdapter>();

  register<T extends BaseAdapter>(type: AdapterType, adapter: T): void {
    this.adapters.set(type, adapter);
  }

  resolve<T extends BaseAdapter>(type: AdapterType): T {
    const adapter = this.adapters.get(type);
    if (!adapter) {
      throw new AdapterNotFoundError(type);
    }
    return adapter as T;
  }

  tryResolve<T extends BaseAdapter>(type: AdapterType): T | null {
    const adapter = this.adapters.get(type);
    return (adapter as T) ?? null;
  }

  has(type: AdapterType): boolean {
    return this.adapters.has(type);
  }

  listRegistered(type: AdapterType): AdapterInfo[] {
    const adapter = this.adapters.get(type);
    if (!adapter) return [];
    return [
      {
        id: adapter.id,
        name: adapter.name,
        version: adapter.version,
        type,
        active: true,
      },
    ];
  }

  listAllTypes(): AdapterType[] {
    return [...this.adapters.keys()];
  }

  async destroyAll(): Promise<void> {
    const adapters = [...this.adapters.values()];
    this.adapters.clear();
    await Promise.all(adapters.map((a) => a.destroy()));
  }
}
