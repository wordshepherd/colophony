import type { ComponentType } from "react";

export interface PluginComponentProps {
  orgId: string;
  userId: string;
  role: "ADMIN" | "EDITOR" | "READER";
  extensionId: string;
  context?: Record<string, unknown>;
}

const registry = new Map<string, ComponentType<PluginComponentProps>>();

export function registerComponent(
  key: string,
  component: ComponentType<PluginComponentProps>,
): void {
  if (registry.has(key)) {
    console.warn(
      `[plugin-components] Overwriting existing component for key "${key}"`,
    );
  }
  registry.set(key, component);
}

export function resolveComponent(
  key: string,
): ComponentType<PluginComponentProps> | null {
  return registry.get(key) ?? null;
}

export function listRegisteredKeys(): string[] {
  return Array.from(registry.keys());
}
