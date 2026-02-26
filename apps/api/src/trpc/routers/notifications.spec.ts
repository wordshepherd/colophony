import { describe, it, expect, vi } from 'vitest';

const mockList = vi.fn();
const mockUnreadCount = vi.fn();
const mockMarkRead = vi.fn();
const mockMarkAllRead = vi.fn();

vi.mock('../../services/notification.service.js', () => ({
  notificationService: {
    list: (...args: unknown[]) => mockList(...args),
    unreadCount: (...args: unknown[]) => mockUnreadCount(...args),
    markRead: (...args: unknown[]) => mockMarkRead(...args),
    markAllRead: (...args: unknown[]) => mockMarkAllRead(...args),
  },
}));

vi.mock('../init.js', () => {
  const passthrough = {
    input: vi.fn().mockReturnThis(),
    output: vi.fn().mockReturnThis(),
    query: vi.fn().mockReturnThis(),
    mutation: vi.fn().mockReturnThis(),
    use: vi.fn().mockReturnThis(),
  };
  return {
    orgProcedure: passthrough,
    createRouter: vi.fn((routes) => routes),
  };
});

vi.mock('@colophony/types', () => ({
  listNotificationsSchema: {},
  notificationResponseSchema: {},
  markNotificationReadSchema: {},
  unreadCountResponseSchema: {},
  AuditActions: {
    IN_APP_NOTIFICATION_READ: 'IN_APP_NOTIFICATION_READ',
    IN_APP_NOTIFICATION_ALL_READ: 'IN_APP_NOTIFICATION_ALL_READ',
  },
  AuditResources: { NOTIFICATION_INBOX: 'notification_inbox' },
}));

vi.mock('zod', () => ({
  z: {
    array: vi.fn().mockReturnThis(),
    object: vi.fn().mockReturnThis(),
    number: vi.fn().mockReturnThis(),
    boolean: vi.fn().mockReturnThis(),
  },
}));

import { notificationsRouter } from './notifications.js';

describe('notificationsRouter', () => {
  it('exports list, unreadCount, markRead, and markAllRead procedures', () => {
    expect(notificationsRouter).toHaveProperty('list');
    expect(notificationsRouter).toHaveProperty('unreadCount');
    expect(notificationsRouter).toHaveProperty('markRead');
    expect(notificationsRouter).toHaveProperty('markAllRead');
  });
});
