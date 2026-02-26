import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockIsInAppEnabled = vi.fn();
const mockCreate = vi.fn();
const mockAuditLog = vi.fn();
const mockPublishNotification = vi.fn();

vi.mock('@colophony/db', () => ({
  withRls: vi.fn((_ctx, fn) => fn({})),
}));

vi.mock('@colophony/types', () => ({
  AuditActions: { IN_APP_NOTIFICATION_CREATED: 'IN_APP_NOTIFICATION_CREATED' },
  AuditResources: { NOTIFICATION_INBOX: 'notification_inbox' },
}));

vi.mock('../../../services/notification-preference.service.js', () => ({
  notificationPreferenceService: {
    isInAppEnabled: (...args: unknown[]) => mockIsInAppEnabled(...args),
  },
}));

vi.mock('../../../services/notification.service.js', () => ({
  notificationService: {
    create: (...args: unknown[]) => mockCreate(...args),
  },
}));

vi.mock('../../../services/audit.service.js', () => ({
  auditService: {
    log: (...args: unknown[]) => mockAuditLog(...args),
  },
}));

vi.mock('../../../sse/redis-pubsub.js', () => ({
  publishNotification: (...args: unknown[]) => mockPublishNotification(...args),
}));

vi.mock('../../../config/env.js', () => ({
  validateEnv: vi.fn().mockReturnValue({
    REDIS_HOST: 'localhost',
    REDIS_PORT: 6379,
    REDIS_PASSWORD: '',
  }),
}));

import { queueInAppNotification } from '../queue-in-app-notification.js';

describe('queueInAppNotification', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('creates notification and publishes when in-app enabled (default)', async () => {
    mockIsInAppEnabled.mockResolvedValue(true);
    mockCreate.mockResolvedValue({ id: 'notif-1' });
    mockAuditLog.mockResolvedValue(undefined);
    mockPublishNotification.mockResolvedValue(undefined);

    const result = await queueInAppNotification({
      orgId: 'org-1',
      userId: 'user-1',
      eventType: 'submission.received',
      title: 'New submission: Test',
      link: '/submissions/123',
    });

    expect(result).toEqual({ created: true, id: 'notif-1' });
    expect(mockCreate).toHaveBeenCalled();
    expect(mockPublishNotification).toHaveBeenCalled();
  });

  it('skips creation when in-app disabled by preference', async () => {
    mockIsInAppEnabled.mockResolvedValue(false);

    const result = await queueInAppNotification({
      orgId: 'org-1',
      userId: 'user-1',
      eventType: 'submission.received',
      title: 'New submission: Test',
    });

    expect(result).toEqual({ created: false });
    expect(mockCreate).not.toHaveBeenCalled();
    expect(mockPublishNotification).not.toHaveBeenCalled();
  });

  it('publishes to Redis after DB insert', async () => {
    mockIsInAppEnabled.mockResolvedValue(true);
    mockCreate.mockResolvedValue({ id: 'notif-2' });
    mockAuditLog.mockResolvedValue(undefined);
    mockPublishNotification.mockResolvedValue(undefined);

    await queueInAppNotification({
      orgId: 'org-1',
      userId: 'user-1',
      eventType: 'contract.ready',
      title: 'Contract ready',
      link: '/contracts',
    });

    expect(mockPublishNotification).toHaveBeenCalledWith(
      expect.anything(),
      'org-1',
      'user-1',
      expect.objectContaining({
        id: 'notif-2',
        eventType: 'contract.ready',
        title: 'Contract ready',
      }),
    );
  });
});
