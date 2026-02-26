import {
  notificationsInbox,
  eq,
  and,
  isNull,
  type DrizzleDb,
} from '@colophony/db';
import { desc, count } from 'drizzle-orm';

interface CreateParams {
  organizationId: string;
  userId: string;
  eventType: string;
  title: string;
  body?: string;
  link?: string;
}

export const notificationService = {
  async create(tx: DrizzleDb, params: CreateParams) {
    const [row] = await tx
      .insert(notificationsInbox)
      .values({
        organizationId: params.organizationId,
        userId: params.userId,
        eventType: params.eventType,
        title: params.title,
        body: params.body ?? null,
        link: params.link ?? null,
      })
      .returning({ id: notificationsInbox.id });
    return row;
  },

  async list(
    tx: DrizzleDb,
    params: {
      userId: string;
      unreadOnly: boolean;
      page: number;
      limit: number;
    },
  ) {
    const conditions = [eq(notificationsInbox.userId, params.userId)];
    if (params.unreadOnly) {
      conditions.push(isNull(notificationsInbox.readAt));
    }

    const where = conditions.length === 1 ? conditions[0] : and(...conditions);

    const [items, [{ total }]] = await Promise.all([
      tx
        .select()
        .from(notificationsInbox)
        .where(where)
        .orderBy(desc(notificationsInbox.createdAt))
        .limit(params.limit)
        .offset((params.page - 1) * params.limit),
      tx.select({ total: count() }).from(notificationsInbox).where(where),
    ]);

    return { items, total };
  },

  async unreadCount(tx: DrizzleDb, userId: string): Promise<number> {
    const [row] = await tx
      .select({ count: count() })
      .from(notificationsInbox)
      .where(
        and(
          eq(notificationsInbox.userId, userId),
          isNull(notificationsInbox.readAt),
        ),
      );
    return row.count;
  },

  async markRead(tx: DrizzleDb, id: string, userId: string): Promise<boolean> {
    const result = await tx
      .update(notificationsInbox)
      .set({ readAt: new Date() })
      .where(
        and(
          eq(notificationsInbox.id, id),
          eq(notificationsInbox.userId, userId),
          isNull(notificationsInbox.readAt),
        ),
      )
      .returning({ id: notificationsInbox.id });
    return result.length > 0;
  },

  async markAllRead(tx: DrizzleDb, userId: string): Promise<number> {
    const result = await tx
      .update(notificationsInbox)
      .set({ readAt: new Date() })
      .where(
        and(
          eq(notificationsInbox.userId, userId),
          isNull(notificationsInbox.readAt),
        ),
      )
      .returning({ id: notificationsInbox.id });
    return result.length;
  },
};
