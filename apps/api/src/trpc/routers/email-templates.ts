import { z } from 'zod';
import {
  upsertEmailTemplateSchema,
  getEmailTemplateSchema,
  previewEmailTemplateSchema,
  emailTemplateSchema,
  emailTemplatePreviewSchema,
  emailTemplateListItemSchema,
  templateNameValues,
  TEMPLATE_LABELS,
  TEMPLATE_MERGE_FIELDS,
  TEMPLATE_SAMPLE_DATA,
  type EmailTemplateName,
} from '@colophony/types';
import {
  orgProcedure,
  adminProcedure,
  createRouter,
  requireScopes,
} from '../init.js';
import { toServiceContext } from '../../services/context.js';
import { emailTemplateService } from '../../services/email-template.service.js';
import { renderCustomTemplate } from '../../templates/email/render.js';
import { mapServiceError } from '../error-mapper.js';

export const emailTemplatesRouter = createRouter({
  /** List all 7 template names with customization status. */
  list: orgProcedure
    .use(requireScopes('email_templates:read'))
    .output(z.array(emailTemplateListItemSchema))
    .query(async ({ ctx }) => {
      try {
        const customized = await emailTemplateService.list(ctx.dbTx);
        const customizedNames = new Set(customized.map((r) => r.templateName));

        return templateNameValues.map((name) => ({
          templateName: name,
          label: TEMPLATE_LABELS[name].label,
          description: TEMPLATE_LABELS[name].description,
          isCustomized: customizedNames.has(name),
          mergeFields: [...TEMPLATE_MERGE_FIELDS[name]],
        }));
      } catch (e) {
        mapServiceError(e);
      }
    }),

  /** Get a single template override by name. */
  getByName: orgProcedure
    .use(requireScopes('email_templates:read'))
    .input(getEmailTemplateSchema)
    .output(emailTemplateSchema.nullable())
    .query(async ({ ctx, input }) => {
      try {
        const row = await emailTemplateService.getByName(
          ctx.dbTx,
          input.templateName,
        );
        if (!row) return null;
        return {
          ...row,
          templateName: row.templateName as EmailTemplateName,
        };
      } catch (e) {
        mapServiceError(e);
      }
    }),

  /** Create or update a template override. */
  upsert: adminProcedure
    .use(requireScopes('email_templates:write'))
    .input(upsertEmailTemplateSchema)
    .output(emailTemplateSchema)
    .mutation(async ({ ctx, input }) => {
      try {
        const row = await emailTemplateService.upsertWithAudit(
          toServiceContext(ctx),
          input,
        );
        return {
          ...row,
          templateName: row.templateName as EmailTemplateName,
        };
      } catch (e) {
        mapServiceError(e);
      }
    }),

  /** Delete a template override (reset to built-in default). */
  delete: adminProcedure
    .use(requireScopes('email_templates:write'))
    .input(getEmailTemplateSchema)
    .output(emailTemplateSchema)
    .mutation(async ({ ctx, input }) => {
      try {
        const row = await emailTemplateService.deleteWithAudit(
          toServiceContext(ctx),
          input.templateName,
        );
        return {
          ...row,
          templateName: row.templateName as EmailTemplateName,
        };
      } catch (e) {
        mapServiceError(e);
      }
    }),

  /** Preview a template with sample data (renders full HTML). */
  preview: orgProcedure
    .use(requireScopes('email_templates:read'))
    .input(previewEmailTemplateSchema)
    .output(emailTemplatePreviewSchema)
    .mutation(async ({ input }) => {
      const sampleData =
        TEMPLATE_SAMPLE_DATA[input.templateName as EmailTemplateName];
      const rendered = renderCustomTemplate(
        {
          subjectTemplate: input.subjectTemplate,
          bodyHtml: input.bodyHtml,
        },
        sampleData,
        sampleData.orgName ?? 'Your Magazine',
      );

      return {
        html: rendered.html,
        text: rendered.text,
        subject: rendered.subject,
      };
    }),
});
