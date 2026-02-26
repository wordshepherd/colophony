import { describe, it, expect, vi } from 'vitest';

vi.mock('@colophony/db', () => {
  return {
    notificationsInbox: {
      id: 'id',
      organizationId: 'organizationId',
      userId: 'userId',
      eventType: 'eventType',
      title: 'title',
      body: 'body',
      link: 'link',
      readAt: 'readAt',
      createdAt: 'createdAt',
    },
    eq: vi.fn(),
    and: vi.fn(),
    isNull: vi.fn(),
  };
});

vi.mock('drizzle-orm', () => ({
  desc: vi.fn(),
  count: vi.fn(),
  sql: vi.fn(),
}));

import { notificationService } from './notification.service.js';

describe('notificationService', () => {
  it('exports expected methods', () => {
    /* eslint-disable @typescript-eslint/unbound-method */
    expect(notificationService.create).toBeTypeOf('function');
    expect(notificationService.list).toBeTypeOf('function');
    expect(notificationService.unreadCount).toBeTypeOf('function');
    expect(notificationService.markRead).toBeTypeOf('function');
    expect(notificationService.markAllRead).toBeTypeOf('function');
    /* eslint-enable @typescript-eslint/unbound-method */
  });

  describe('create', () => {
    it('inserts notification and returns id', async () => {
      const mockTx = {
        insert: vi.fn().mockReturnThis(),
        values: vi.fn().mockReturnThis(),
        returning: vi.fn().mockResolvedValue([{ id: 'notif-1' }]),
      };

      const result = await notificationService.create(mockTx as any, {
        organizationId: 'org-1',
        userId: 'user-1',
        eventType: 'submission.received',
        title: 'New submission',
        body: 'A body',
        link: '/submissions/123',
      });
      expect(result).toEqual({ id: 'notif-1' });
      expect(mockTx.insert).toHaveBeenCalled();
    });
  });

  describe('list', () => {
    it('returns paginated results with total count', async () => {
      const items = [
        { id: 'n1', title: 'Test', createdAt: new Date() },
        { id: 'n2', title: 'Test 2', createdAt: new Date() },
      ];
      const mockTx = {
        select: vi
          .fn()
          .mockReturnValueOnce({
            from: vi.fn().mockReturnValue({
              where: vi.fn().mockReturnValue({
                orderBy: vi.fn().mockReturnValue({
                  limit: vi.fn().mockReturnValue({
                    offset: vi.fn().mockResolvedValue(items),
                  }),
                }),
              }),
            }),
          })
          .mockReturnValueOnce({
            from: vi.fn().mockReturnValue({
              where: vi.fn().mockResolvedValue([{ total: 2 }]),
            }),
          }),
      };

      const result = await notificationService.list(mockTx as any, {
        userId: 'user-1',
        unreadOnly: false,
        page: 1,
        limit: 20,
      });
      expect(result.items).toHaveLength(2);
      expect(result.total).toBe(2);
    });

    it('filters unread only when flag set', async () => {
      const mockTx = {
        select: vi
          .fn()
          .mockReturnValueOnce({
            from: vi.fn().mockReturnValue({
              where: vi.fn().mockReturnValue({
                orderBy: vi.fn().mockReturnValue({
                  limit: vi.fn().mockReturnValue({
                    offset: vi.fn().mockResolvedValue([]),
                  }),
                }),
              }),
            }),
          })
          .mockReturnValueOnce({
            from: vi.fn().mockReturnValue({
              where: vi.fn().mockResolvedValue([{ total: 0 }]),
            }),
          }),
      };

      const result = await notificationService.list(mockTx as any, {
        userId: 'user-1',
        unreadOnly: true,
        page: 1,
        limit: 20,
      });
      expect(result.items).toHaveLength(0);
      expect(result.total).toBe(0);
    });
  });

  describe('unreadCount', () => {
    it('returns count of unread', async () => {
      const mockTx = {
        select: vi.fn().mockReturnThis(),
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockResolvedValue([{ count: 5 }]),
      };

      const result = await notificationService.unreadCount(
        mockTx as any,
        'user-1',
      );
      expect(result).toBe(5);
    });
  });

  describe('markRead', () => {
    it('returns true on success', async () => {
      const mockTx = {
        update: vi.fn().mockReturnThis(),
        set: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        returning: vi.fn().mockResolvedValue([{ id: 'notif-1' }]),
      };

      const result = await notificationService.markRead(
        mockTx as any,
        'notif-1',
        'user-1',
      );
      expect(result).toBe(true);
    });

    it('returns false when not found', async () => {
      const mockTx = {
        update: vi.fn().mockReturnThis(),
        set: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        returning: vi.fn().mockResolvedValue([]),
      };

      const result = await notificationService.markRead(
        mockTx as any,
        'notif-999',
        'user-1',
      );
      expect(result).toBe(false);
    });
  });

  describe('markAllRead', () => {
    it('returns count of marked notifications', async () => {
      const mockTx = {
        update: vi.fn().mockReturnThis(),
        set: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        returning: vi
          .fn()
          .mockResolvedValue([{ id: 'n1' }, { id: 'n2' }, { id: 'n3' }]),
      };

      const result = await notificationService.markAllRead(
        mockTx as any,
        'user-1',
      );
      expect(result).toBe(3);
    });
  });
});
