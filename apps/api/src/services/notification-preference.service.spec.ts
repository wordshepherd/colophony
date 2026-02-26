import { describe, it, expect, vi } from 'vitest';

vi.mock('@colophony/db', () => {
  const eq = vi.fn();
  const and = vi.fn();
  return {
    notificationPreferences: {
      organizationId: 'organizationId',
      userId: 'userId',
      channel: 'channel',
      eventType: 'eventType',
      enabled: 'enabled',
    },
    eq,
    and,
    sql: vi.fn(),
  };
});

import { notificationPreferenceService } from './notification-preference.service.js';

describe('notificationPreferenceService', () => {
  it('exports expected methods', () => {
    expect(notificationPreferenceService.isEmailEnabled).toBeTypeOf('function');
    expect(notificationPreferenceService.listForUser).toBeTypeOf('function');
    expect(notificationPreferenceService.upsert).toBeTypeOf('function');
    expect(notificationPreferenceService.bulkUpsert).toBeTypeOf('function');
  });

  describe('isEmailEnabled', () => {
    it('returns true when no preference exists (default enabled)', async () => {
      const mockTx = {
        select: vi.fn().mockReturnThis(),
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        limit: vi.fn().mockResolvedValue([]),
      };

      const result = await notificationPreferenceService.isEmailEnabled(
        mockTx as any,
        'org-1',
        'user-1',
        'submission.received',
      );
      expect(result).toBe(true);
    });

    it('returns false when preference is disabled', async () => {
      const mockTx = {
        select: vi.fn().mockReturnThis(),
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        limit: vi.fn().mockResolvedValue([{ enabled: false }]),
      };

      const result = await notificationPreferenceService.isEmailEnabled(
        mockTx as any,
        'org-1',
        'user-1',
        'submission.received',
      );
      expect(result).toBe(false);
    });

    it('returns true when preference is enabled', async () => {
      const mockTx = {
        select: vi.fn().mockReturnThis(),
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        limit: vi.fn().mockResolvedValue([{ enabled: true }]),
      };

      const result = await notificationPreferenceService.isEmailEnabled(
        mockTx as any,
        'org-1',
        'user-1',
        'submission.received',
      );
      expect(result).toBe(true);
    });
  });
});
