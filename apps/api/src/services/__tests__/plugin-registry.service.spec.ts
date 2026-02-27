import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  fetchPluginRegistry,
  listRegistryEntries,
  getRegistryEntry,
  clearRegistryCache,
} from '../plugin-registry.service.js';

vi.mock('../../adapters/plugins-accessor.js', () => ({
  getGlobalPluginManifests: vi.fn(() => []),
}));

import { getGlobalPluginManifests } from '../../adapters/plugins-accessor.js';
const mockGetManifests = vi.mocked(getGlobalPluginManifests);

function makeRegistryEntry(id: string, overrides?: Record<string, unknown>) {
  return {
    id,
    name: `Plugin ${id}`,
    version: '1.0.0',
    colophonyVersion: '2.0.0',
    description: `Description for ${id}`,
    author: 'Test Author',
    license: 'MIT',
    category: 'adapter',
    npmPackage: `@colophony/plugin-${id}`,
    ...overrides,
  };
}

describe('plugin-registry.service', () => {
  beforeEach(() => {
    clearRegistryCache();
    vi.restoreAllMocks();
    mockGetManifests.mockReturnValue([]);
  });

  it('fetches and parses valid registry', async () => {
    const entries = [makeRegistryEntry('foo'), makeRegistryEntry('bar')];
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      new Response(JSON.stringify(entries), { status: 200 }),
    );

    const result = await fetchPluginRegistry(
      'https://example.com/registry.json',
    );
    expect(result).toHaveLength(2);
    expect(result[0].id).toBe('foo');
    expect(result[1].id).toBe('bar');
  });

  it('returns cached data within TTL', async () => {
    const entries = [makeRegistryEntry('cached')];
    const fetchSpy = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValue(
        new Response(JSON.stringify(entries), { status: 200 }),
      );

    await fetchPluginRegistry('https://example.com/registry.json');
    await fetchPluginRegistry('https://example.com/registry.json');

    expect(fetchSpy).toHaveBeenCalledTimes(1);
  });

  it('refetches after cache expiry', async () => {
    const entries = [makeRegistryEntry('fresh')];
    const json = JSON.stringify(entries);
    const fetchSpy = vi
      .spyOn(globalThis, 'fetch')
      .mockImplementation(async () => new Response(json, { status: 200 }));

    const now = Date.now();
    vi.spyOn(Date, 'now').mockReturnValueOnce(now);
    await fetchPluginRegistry('https://example.com/registry.json');

    // Advance past TTL (1 hour + 1ms)
    vi.spyOn(Date, 'now').mockReturnValueOnce(now + 3_600_001);
    await fetchPluginRegistry('https://example.com/registry.json');

    expect(fetchSpy).toHaveBeenCalledTimes(2);
  });

  it('throws on non-OK response', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      new Response('Not Found', { status: 404, statusText: 'Not Found' }),
    );

    await expect(
      fetchPluginRegistry('https://example.com/registry.json'),
    ).rejects.toThrow('Failed to fetch plugin registry: 404 Not Found');
  });

  it('throws on invalid schema', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      new Response(JSON.stringify([{ invalid: true }]), { status: 200 }),
    );

    await expect(
      fetchPluginRegistry('https://example.com/registry.json'),
    ).rejects.toThrow('Plugin registry response failed validation');
  });

  it('marks installed plugins correctly', async () => {
    const entries = [makeRegistryEntry('foo'), makeRegistryEntry('bar')];
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      new Response(JSON.stringify(entries), { status: 200 }),
    );
    mockGetManifests.mockReturnValue([
      {
        id: 'foo',
        name: 'Plugin foo',
        version: '1.0.0',
        colophonyVersion: '2.0.0',
        description: 'Test',
        author: 'Test',
        license: 'MIT',
        category: 'adapter',
      },
    ]);

    const result = await listRegistryEntries(
      'https://example.com/registry.json',
    );
    expect(result.find((e) => e.id === 'foo')?.installed).toBe(true);
    expect(result.find((e) => e.id === 'bar')?.installed).toBe(false);
  });

  it('getRegistryEntry returns entry with status', async () => {
    const entries = [makeRegistryEntry('target')];
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      new Response(JSON.stringify(entries), { status: 200 }),
    );

    const result = await getRegistryEntry(
      'https://example.com/registry.json',
      'target',
    );
    expect(result).not.toBeNull();
    expect(result!.id).toBe('target');
    expect(result!.installed).toBe(false);
  });

  it('getRegistryEntry returns null for unknown', async () => {
    const entries = [makeRegistryEntry('known')];
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      new Response(JSON.stringify(entries), { status: 200 }),
    );

    const result = await getRegistryEntry(
      'https://example.com/registry.json',
      'nonexistent',
    );
    expect(result).toBeNull();
  });
});
