import {
  correspondence,
  users,
  organizations,
  eq,
  desc,
  type DrizzleDb,
} from '@colophony/db';
import { AuditActions, AuditResources } from '@colophony/types';
import type { SendEditorMessageInput } from '@colophony/types';
import type { ServiceContext } from './types.js';
import { assertEditorOrAdmin, NotFoundError } from './errors.js';
import { submissionService } from './submission.service.js';
import { emailService } from './email.service.js';
import { enqueueEmail } from '../queues/email.queue.js';
import { validateEnv } from '../config/env.js';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface CreateCorrespondenceParams {
  userId: string;
  submissionId: string;
  direction: 'inbound' | 'outbound';
  channel: 'email' | 'portal' | 'in_app' | 'other';
  sentAt: Date;
  subject: string | null;
  body: string;
  senderName: string | null;
  senderEmail: string | null;
  isPersonalized: boolean;
  source: string;
}

// ---------------------------------------------------------------------------
// Service
// ---------------------------------------------------------------------------

export const correspondenceService = {
  async create(tx: DrizzleDb, params: CreateCorrespondenceParams) {
    const [row] = await tx
      .insert(correspondence)
      .values({
        userId: params.userId,
        submissionId: params.submissionId,
        direction: params.direction,
        channel: params.channel,
        sentAt: params.sentAt,
        subject: params.subject,
        body: params.body,
        senderName: params.senderName,
        senderEmail: params.senderEmail,
        isPersonalized: params.isPersonalized,
        source: params.source,
      })
      .returning();
    return row;
  },

  async listBySubmission(svc: ServiceContext, submissionId: string) {
    assertEditorOrAdmin(svc.actor.role);

    const rows = await svc.tx
      .select()
      .from(correspondence)
      .where(eq(correspondence.submissionId, submissionId))
      .orderBy(desc(correspondence.sentAt));

    return rows;
  },

  async sendEditorMessage(
    svc: ServiceContext,
    input: SendEditorMessageInput,
  ): Promise<{ correspondenceId: string }> {
    assertEditorOrAdmin(svc.actor.role);

    // Fetch the submission (RLS-scoped)
    const submission = await submissionService.getById(
      svc.tx,
      input.submissionId,
    );
    if (!submission) throw new NotFoundError('Submission not found');

    const submitterId = submission.submitterId;
    if (!submitterId) throw new NotFoundError('Submitter not found');

    // Fetch submitter email
    const [submitter] = await svc.tx
      .select({ email: users.email })
      .from(users)
      .where(eq(users.id, submitterId))
      .limit(1);

    if (!submitter) throw new NotFoundError('Submitter not found');

    // Fetch editor email (for replyTo)
    const [editor] = await svc.tx
      .select({ email: users.email })
      .from(users)
      .where(eq(users.id, svc.actor.userId))
      .limit(1);

    // Fetch org name
    const [org] = await svc.tx
      .select({ name: organizations.name })
      .from(organizations)
      .where(eq(organizations.id, svc.actor.orgId))
      .limit(1);

    const orgName = org?.name ?? 'Unknown Organization';
    const editorName = editor?.email ?? 'Editor';
    const editorEmail: string | undefined = editor?.email;

    // Create correspondence record
    const record = await correspondenceService.create(svc.tx, {
      userId: submitterId,
      submissionId: input.submissionId,
      direction: 'outbound',
      channel: 'email',
      sentAt: new Date(),
      subject: input.subject,
      body: input.body,
      senderName: editorName,
      senderEmail: editorEmail ?? null,
      isPersonalized: true,
      source: 'colophony',
    });

    // Create email_sends record
    const emailSend = await emailService.create(svc.tx, {
      organizationId: svc.actor.orgId,
      recipientUserId: submitterId,
      recipientEmail: submitter.email,
      templateName: 'editor-message',
      eventType: 'correspondence.editor_message',
      subject: input.subject,
    });

    // Audit
    await svc.audit({
      action: AuditActions.CORRESPONDENCE_SENT,
      resource: AuditResources.CORRESPONDENCE,
      resourceId: record.id,
      newValue: {
        submissionId: input.submissionId,
        recipientEmail: submitter.email,
        subject: input.subject,
      },
    });

    // Enqueue email for sending
    const env = validateEnv();
    if (env.EMAIL_PROVIDER !== 'none') {
      await enqueueEmail(env, {
        emailSendId: emailSend.id,
        orgId: svc.actor.orgId,
        to: submitter.email,
        from: env.SMTP_FROM ?? env.SENDGRID_FROM ?? 'noreply@colophony.dev',
        templateName: 'editor-message',
        templateData: {
          submissionTitle: submission.title ?? 'Untitled',
          orgName,
          editorName,
          messageSubject: input.subject,
          messageBody: input.body,
        },
        replyTo: editorEmail,
      });
    }

    return { correspondenceId: record.id };
  },
};
