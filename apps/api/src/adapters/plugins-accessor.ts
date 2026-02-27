import type { PluginManifest } from '@colophony/plugin-sdk';

let _manifests: PluginManifest[] = [];

export function setGlobalPluginManifests(manifests: PluginManifest[]): void {
  _manifests = manifests;
}

export function getGlobalPluginManifests(): PluginManifest[] {
  return _manifests;
}
