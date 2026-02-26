import type { AdapterRegistry } from '@colophony/plugin-sdk';

let _registry: AdapterRegistry | null = null;

export function setGlobalRegistry(registry: AdapterRegistry): void {
  _registry = registry;
}

export function getGlobalRegistry(): AdapterRegistry {
  if (!_registry) {
    throw new Error(
      'AdapterRegistry not initialized — call setGlobalRegistry() first',
    );
  }
  return _registry;
}
