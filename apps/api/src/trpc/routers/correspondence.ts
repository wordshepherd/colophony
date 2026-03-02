import sanitizeHtml from 'sanitize-html';
import { z } from 'zod';
import {
  sendEditorMessageSchema,
  correspondenceListItemSchema,
  listCorrespondenceByUserSchema,
  createManualCorrespondenceSchema,
} from '@colophony/types';
import {
  orgProcedure,
  userProcedure,
  createRouter,
  requireScopes,
} from '../init.js';
import {
  toServiceContext,
  toUserServiceContext,
} from '../../services/context.js';
import { correspondenceService } from '../../services/correspondence.service.js';
import { mapServiceError } from '../error-mapper.js';

function stripHtmlAndTruncate(html: string, maxLen: number): string {
  const sanitized = sanitizeHtml(html, {
    allowedTags: [],
    allowedAttributes: {},
  });
  const text = sanitized.replace(/&nbsp;/g, ' ').trim();
  return text.length > maxLen ? text.slice(0, maxLen - 1) + '\u2026' : text;
}

export const correspondenceRouter = createRouter({
  send: orgProcedure
    .use(requireScopes('submissions:write'))
    .input(sendEditorMessageSchema)
    .output(z.object({ correspondenceId: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      try {
        return await correspondenceService.sendEditorMessage(
          toServiceContext(ctx),
          input,
        );
      } catch (e) {
        mapServiceError(e);
      }
    }),

  listBySubmission: orgProcedure
    .use(requireScopes('submissions:read'))
    .input(z.object({ submissionId: z.string().uuid() }))
    .output(z.array(correspondenceListItemSchema))
    .query(async ({ ctx, input }) => {
      try {
        const rows = await correspondenceService.listBySubmission(
          toServiceContext(ctx),
          input.submissionId,
        );
        return rows.map((r) => ({
          id: r.id,
          direction: r.direction,
          channel: r.channel,
          sentAt: r.sentAt.toISOString(),
          subject: r.subject,
          bodyPreview: stripHtmlAndTruncate(r.body, 200),
          senderName: r.senderName,
          senderEmail: r.senderEmail,
          isPersonalized: r.isPersonalized,
          source: r.source as 'colophony' | 'manual',
        }));
      } catch (e) {
        mapServiceError(e);
      }
    }),

  logManual: userProcedure
    .use(requireScopes('correspondence:write'))
    .input(createManualCorrespondenceSchema)
    .output(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      try {
        return await correspondenceService.createManualWithAudit(
          toUserServiceContext(ctx),
          input,
        );
      } catch (e) {
        mapServiceError(e);
      }
    }),

  listByUser: userProcedure
    .use(requireScopes('correspondence:read'))
    .input(listCorrespondenceByUserSchema)
    .query(async ({ ctx, input }) => {
      try {
        const result = await correspondenceService.listByUser(
          ctx.dbTx,
          ctx.authContext.userId,
          input,
        );
        return {
          ...result,
          items: result.items.map((r) => ({
            id: r.id,
            submissionId: r.submissionId,
            externalSubmissionId: r.externalSubmissionId,
            direction: r.direction,
            channel: r.channel,
            sentAt: r.sentAt.toISOString(),
            subject: r.subject,
            bodyPreview: stripHtmlAndTruncate(r.body, 200),
            senderName: r.senderName,
            isPersonalized: r.isPersonalized,
            source: r.source as 'colophony' | 'manual',
            journalName: r.journalName,
          })),
        };
      } catch (e) {
        mapServiceError(e);
      }
    }),
});
