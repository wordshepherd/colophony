import { z } from "zod";

export const listNotificationsSchema = z.object({
  unreadOnly: z.boolean().default(false),
  page: z.number().int().min(1).default(1),
  limit: z.number().int().min(1).max(50).default(20),
});

export type ListNotificationsInput = z.infer<typeof listNotificationsSchema>;

export const notificationResponseSchema = z.object({
  id: z.string().uuid(),
  eventType: z.string(),
  title: z.string(),
  body: z.string().nullable(),
  link: z.string().nullable(),
  readAt: z.date().nullable(),
  createdAt: z.date(),
});

export type NotificationResponse = z.infer<typeof notificationResponseSchema>;

export const markNotificationReadSchema = z.object({
  id: z.string().uuid(),
});

export type MarkNotificationReadInput = z.infer<
  typeof markNotificationReadSchema
>;

export const unreadCountResponseSchema = z.object({
  count: z.number().int().min(0),
});

export type UnreadCountResponse = z.infer<typeof unreadCountResponseSchema>;
