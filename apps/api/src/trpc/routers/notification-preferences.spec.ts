import { describe, it, expect, vi } from 'vitest';

const mockListForUser = vi.fn();
const mockUpsert = vi.fn();
const mockBulkUpsert = vi.fn();

vi.mock('../../services/notification-preference.service.js', () => ({
  notificationPreferenceService: {
    listForUser: (...args: unknown[]) => mockListForUser(...args),
    upsert: (...args: unknown[]) => mockUpsert(...args),
    bulkUpsert: (...args: unknown[]) => mockBulkUpsert(...args),
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
    adminProcedure: passthrough,
    createRouter: vi.fn((routes) => routes),
  };
});

vi.mock('@colophony/types', () => ({
  upsertNotificationPreferenceSchema: {},
  bulkUpsertNotificationPreferencesSchema: {},
  notificationPreferenceResponseSchema: {},
  AuditActions: {
    NOTIFICATION_PREFERENCE_UPDATED: 'NOTIFICATION_PREFERENCE_UPDATED',
  },
  AuditResources: { NOTIFICATION_PREFERENCE: 'notification_preference' },
}));

vi.mock('zod', () => ({
  z: {
    array: vi.fn().mockReturnThis(),
    object: vi.fn().mockReturnThis(),
  },
}));

import { notificationPreferencesRouter } from './notification-preferences.js';

describe('notificationPreferencesRouter', () => {
  it('exports list, upsert, and bulkUpsert procedures', () => {
    expect(notificationPreferencesRouter).toHaveProperty('list');
    expect(notificationPreferencesRouter).toHaveProperty('upsert');
    expect(notificationPreferencesRouter).toHaveProperty('bulkUpsert');
  });
});
