import { describe, it, expect, beforeEach } from 'vitest';
import type { UIExtensionDeclaration } from '@colophony/plugin-sdk';
import {
  getGlobalExtensions,
  setGlobalExtensions,
} from '../extensions-accessor.js';

describe('extensions-accessor', () => {
  beforeEach(() => {
    setGlobalExtensions([]);
  });

  it('getGlobalExtensions returns empty array before init', () => {
    expect(getGlobalExtensions()).toEqual([]);
  });

  it('set then get returns same extensions', () => {
    const exts: UIExtensionDeclaration[] = [
      {
        point: 'dashboard.widget',
        id: 'test-widget',
        label: 'Test',
        component: 'test.widget',
      },
    ];
    setGlobalExtensions(exts);
    expect(getGlobalExtensions()).toBe(exts);
  });

  it('set replaces previous extensions', () => {
    const first: UIExtensionDeclaration[] = [
      {
        point: 'dashboard.widget',
        id: 'first',
        label: 'First',
        component: 'first.widget',
      },
    ];
    const second: UIExtensionDeclaration[] = [
      {
        point: 'settings.section',
        id: 'second',
        label: 'Second',
        component: 'second.section',
      },
    ];

    setGlobalExtensions(first);
    setGlobalExtensions(second);

    const result = getGlobalExtensions();
    expect(result).toBe(second);
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('second');
  });
});
