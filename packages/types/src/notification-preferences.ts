import { z } from "zod";

export const notificationEventTypes = [
  "submission.received",
  "submission.accepted",
  "submission.rejected",
  "submission.withdrawn",
  "contract.ready",
  "copyeditor.assigned",
] as const;

export type NotificationEventType = (typeof notificationEventTypes)[number];

export const notificationEventTypeSchema = z.enum(notificationEventTypes);

export const upsertNotificationPreferenceSchema = z.object({
  channel: z.enum(["email"]),
  eventType: notificationEventTypeSchema,
  enabled: z.boolean(),
});

export type UpsertNotificationPreferenceInput = z.infer<
  typeof upsertNotificationPreferenceSchema
>;

export const bulkUpsertNotificationPreferencesSchema = z.object({
  preferences: z.array(upsertNotificationPreferenceSchema).min(1).max(50),
});

export type BulkUpsertNotificationPreferencesInput = z.infer<
  typeof bulkUpsertNotificationPreferencesSchema
>;

export const notificationPreferenceResponseSchema = z.object({
  id: z.string().uuid(),
  channel: z.enum(["email"]),
  eventType: z.string(),
  enabled: z.boolean(),
  createdAt: z.date(),
  updatedAt: z.date(),
});

export type NotificationPreferenceResponse = z.infer<
  typeof notificationPreferenceResponseSchema
>;
