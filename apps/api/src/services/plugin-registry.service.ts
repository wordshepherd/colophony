import {
  pluginRegistrySchema,
  type PluginRegistryEntry,
} from '@colophony/plugin-sdk';
import { getGlobalPluginManifests } from '../adapters/plugins-accessor.js';

export type RegistryEntryWithStatus = PluginRegistryEntry & {
  installed: boolean;
};

// In-memory cache
let _cache: { entries: PluginRegistryEntry[]; fetchedAt: number } | null = null;
const CACHE_TTL_MS = 60 * 60 * 1000; // 1 hour

export async function fetchPluginRegistry(
  registryUrl: string,
): Promise<PluginRegistryEntry[]> {
  const now = Date.now();
  if (_cache && now - _cache.fetchedAt < CACHE_TTL_MS) {
    return _cache.entries;
  }

  const response = await fetch(registryUrl);
  if (!response.ok) {
    throw new Error(
      `Failed to fetch plugin registry: ${response.status} ${response.statusText}`,
    );
  }

  const json: unknown = await response.json();
  const entries = pluginRegistrySchema.parse(json);
  _cache = { entries, fetchedAt: now };
  return entries;
}

export async function listRegistryEntries(
  registryUrl: string,
): Promise<RegistryEntryWithStatus[]> {
  const entries = await fetchPluginRegistry(registryUrl);
  const installedIds = new Set(getGlobalPluginManifests().map((m) => m.id));

  return entries.map((entry) => ({
    ...entry,
    installed: installedIds.has(entry.id),
  }));
}

export async function getRegistryEntry(
  registryUrl: string,
  pluginId: string,
): Promise<RegistryEntryWithStatus | null> {
  const entries = await listRegistryEntries(registryUrl);
  return entries.find((e) => e.id === pluginId) ?? null;
}

export function clearRegistryCache(): void {
  _cache = null;
}
