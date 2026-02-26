import { emailSends, eq, and, type DrizzleDb } from '@colophony/db';
import { desc, count } from 'drizzle-orm';

interface CreateEmailSendParams {
  organizationId: string;
  recipientUserId?: string;
  recipientEmail: string;
  templateName: string;
  eventType: string;
  subject: string;
}

interface ListEmailSendsParams {
  page: number;
  limit: number;
  status?: 'QUEUED' | 'SENDING' | 'SENT' | 'FAILED' | 'BOUNCED';
  eventType?: string;
}

export const emailService = {
  async create(tx: DrizzleDb, params: CreateEmailSendParams) {
    const [row] = await tx
      .insert(emailSends)
      .values({
        organizationId: params.organizationId,
        recipientUserId: params.recipientUserId ?? null,
        recipientEmail: params.recipientEmail,
        templateName: params.templateName,
        eventType: params.eventType,
        subject: params.subject,
        status: 'QUEUED',
      })
      .returning();
    return row;
  },

  async updateStatus(
    tx: DrizzleDb,
    id: string,
    status: 'QUEUED' | 'SENDING' | 'SENT' | 'FAILED' | 'BOUNCED',
    attempts?: number,
  ) {
    const update: Record<string, unknown> = { status };
    if (attempts !== undefined) update.attempts = attempts;
    await tx.update(emailSends).set(update).where(eq(emailSends.id, id));
  },

  async markSent(tx: DrizzleDb, id: string, messageId: string | null) {
    await tx
      .update(emailSends)
      .set({
        status: 'SENT',
        providerMessageId: messageId,
        sentAt: new Date(),
      })
      .where(eq(emailSends.id, id));
  },

  async markFailed(tx: DrizzleDb, id: string, error: string) {
    await tx
      .update(emailSends)
      .set({
        status: 'FAILED',
        errorMessage: error.slice(0, 2048),
      })
      .where(eq(emailSends.id, id));
  },

  async list(tx: DrizzleDb, params: ListEmailSendsParams) {
    const { page, limit, status, eventType } = params;
    const offset = (page - 1) * limit;

    const conditions = [];
    if (status) conditions.push(eq(emailSends.status, status));
    if (eventType) conditions.push(eq(emailSends.eventType, eventType));

    const where = conditions.length > 0 ? and(...conditions) : undefined;

    const [items, countResult] = await Promise.all([
      tx
        .select()
        .from(emailSends)
        .where(where)
        .orderBy(desc(emailSends.createdAt))
        .limit(limit)
        .offset(offset),
      tx.select({ count: count() }).from(emailSends).where(where),
    ]);

    const total = countResult[0]?.count ?? 0;
    return { items, total, page, limit, totalPages: Math.ceil(total / limit) };
  },
};
