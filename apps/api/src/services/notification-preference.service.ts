import {
  notificationPreferences,
  eq,
  and,
  type DrizzleDb,
} from '@colophony/db';
import { sql } from 'drizzle-orm';

interface UpsertParams {
  organizationId: string;
  userId: string;
  channel: 'email';
  eventType: string;
  enabled: boolean;
}

export const notificationPreferenceService = {
  /**
   * Check if email notifications are enabled for a user + event type.
   * Returns true if no preference record exists (default: enabled).
   */
  async isEmailEnabled(
    tx: DrizzleDb,
    orgId: string,
    userId: string,
    eventType: string,
  ): Promise<boolean> {
    const [pref] = await tx
      .select({ enabled: notificationPreferences.enabled })
      .from(notificationPreferences)
      .where(
        and(
          eq(notificationPreferences.organizationId, orgId),
          eq(notificationPreferences.userId, userId),
          eq(notificationPreferences.channel, 'email'),
          eq(notificationPreferences.eventType, eventType),
        ),
      )
      .limit(1);

    // Default to enabled if no preference record exists
    return pref?.enabled ?? true;
  },

  async listForUser(tx: DrizzleDb, userId: string) {
    return tx
      .select()
      .from(notificationPreferences)
      .where(eq(notificationPreferences.userId, userId));
  },

  async upsert(tx: DrizzleDb, params: UpsertParams) {
    const [row] = await tx
      .insert(notificationPreferences)
      .values({
        organizationId: params.organizationId,
        userId: params.userId,
        channel: params.channel,
        eventType: params.eventType,
        enabled: params.enabled,
      })
      .onConflictDoUpdate({
        target: [
          notificationPreferences.organizationId,
          notificationPreferences.userId,
          notificationPreferences.channel,
          notificationPreferences.eventType,
        ],
        set: {
          enabled: sql`excluded.enabled`,
          updatedAt: new Date(),
        },
      })
      .returning();
    return row;
  },

  async bulkUpsert(
    tx: DrizzleDb,
    orgId: string,
    userId: string,
    preferences: Array<{
      channel: 'email';
      eventType: string;
      enabled: boolean;
    }>,
  ) {
    const results = [];
    for (const pref of preferences) {
      const row = await notificationPreferenceService.upsert(tx, {
        organizationId: orgId,
        userId,
        channel: pref.channel,
        eventType: pref.eventType,
        enabled: pref.enabled,
      });
      results.push(row);
    }
    return results;
  },
};
