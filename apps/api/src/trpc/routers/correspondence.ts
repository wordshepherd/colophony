import { z } from 'zod';
import {
  sendEditorMessageSchema,
  correspondenceListItemSchema,
} from '@colophony/types';
import { orgProcedure, createRouter, requireScopes } from '../init.js';
import { toServiceContext } from '../../services/context.js';
import { correspondenceService } from '../../services/correspondence.service.js';
import { mapServiceError } from '../error-mapper.js';

function stripHtmlAndTruncate(html: string, maxLen: number): string {
  const text = html
    .replace(/<[^>]*>/g, '')
    .replace(/&nbsp;/g, ' ')
    .trim();
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
          direction: r.direction as 'inbound' | 'outbound',
          channel: r.channel as 'email' | 'portal' | 'in_app' | 'other',
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
});
