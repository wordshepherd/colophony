import { describe, it, expect, beforeEach } from 'vitest';
import type { PluginManifest } from '@colophony/plugin-sdk';
import {
  getGlobalPluginManifests,
  setGlobalPluginManifests,
} from '../plugins-accessor.js';

function makeManifest(id: string): PluginManifest {
  return {
    id,
    name: `Plugin ${id}`,
    version: '1.0.0',
    colophonyVersion: '2.0.0',
    description: 'Test plugin',
    author: 'Test',
    license: 'MIT',
    category: 'adapter',
  };
}

describe('plugins-accessor', () => {
  beforeEach(() => {
    setGlobalPluginManifests([]);
  });

  it('returns empty array before init', () => {
    expect(getGlobalPluginManifests()).toEqual([]);
  });

  it('set then get returns manifests', () => {
    const manifests = [makeManifest('foo'), makeManifest('bar')];
    setGlobalPluginManifests(manifests);
    expect(getGlobalPluginManifests()).toEqual(manifests);
  });

  it('set replaces previous', () => {
    setGlobalPluginManifests([makeManifest('first')]);
    setGlobalPluginManifests([makeManifest('second')]);
    const result = getGlobalPluginManifests();
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('second');
  });
});
