import {
  withRls,
  db,
  organizations,
  organizationMembers,
  users,
  eq,
  and,
  inArray,
} from '@colophony/db';
import { orgSettingsSchema } from '@colophony/types';
import { inngest } from '../client.js';
import { queueEmailForRecipient } from '../helpers/queue-email-for-recipient.js';
import { submissionService } from '../../services/submission.service.js';
import { validateEnv } from '../../config/env.js';

export const submissionResponseReminderCron = inngest.createFunction(
  {
    id: 'submission-response-reminder-cron',
    name: 'Submission Response Reminder (Weekly)',
    retries: 1,
  },
  { cron: 'TZ=UTC 0 9 * * 1' },
  async ({ step }) => {
    const env = validateEnv();
    if (env.EMAIL_PROVIDER === 'none') {
      return { skipped: true, reason: 'email provider is none' };
    }

    // Step 1: Find orgs with reminders enabled (superuser query — no RLS)
    const eligibleOrgs = await step.run('find-eligible-orgs', async () => {
      const allOrgs = await db
        .select({
          id: organizations.id,
          name: organizations.name,
          settings: organizations.settings,
        })
        .from(organizations);

      return allOrgs
        .map((org) => {
          const parsed = orgSettingsSchema.safeParse(org.settings ?? {});
          const settings = parsed.success
            ? parsed.data
            : { responseReminderEnabled: false, responseReminderDays: 30 };
          return { id: org.id, name: org.name, settings };
        })
        .filter((org) => org.settings.responseReminderEnabled);
    });

    if (eligibleOrgs.length === 0) {
      return { skipped: true, reason: 'no orgs with reminders enabled' };
    }

    let totalEmails = 0;

    // Step 2: Process each org
    for (const org of eligibleOrgs) {
      const result = await step.run(`process-org-${org.id}`, async () => {
        // Get aging submissions (within RLS context)
        const { submissions: agingList, totalCount: totalAging } =
          await withRls({ orgId: org.id }, async (tx) => {
            return submissionService.listAgingByOrg(
              tx,
              org.settings.responseReminderDays,
            );
          });

        if (agingList.length === 0) {
          return { emailsSent: 0 };
        }

        // Take top 10 for email, compute summary
        const topSubmissions = agingList.slice(0, 10).map((s) => ({
          title: s.title ?? '(Untitled)',
          submitterEmail: s.submitterEmail ?? '[Anonymous]',
          daysPending: s.daysPending,
        }));
        const oldestDays = agingList.length > 0 ? agingList[0].daysPending : 0;
        const hasMore = totalAging > 10;

        // Get editors for this org
        const editors = await withRls({ orgId: org.id }, async (tx) => {
          return tx
            .select({
              userId: organizationMembers.userId,
              email: users.email,
            })
            .from(organizationMembers)
            .innerJoin(users, eq(users.id, organizationMembers.userId))
            .where(
              and(
                eq(organizationMembers.organizationId, org.id),
                inArray(organizationMembers.role, ['ADMIN', 'EDITOR']),
              ),
            );
        });

        let emailsSent = 0;
        for (const editor of editors) {
          if (!editor.email) continue;

          await queueEmailForRecipient({
            orgId: org.id,
            userId: editor.userId,
            email: editor.email,
            eventType: 'submission.response_reminder',
            templateName: 'submission-response-reminder',
            templateData: {
              orgName: org.name,
              editorName: editor.email,
              totalAging,
              oldestDays,
              topSubmissions,
              hasMore,
            },
            subject: `Response reminder: ${totalAging} submission${totalAging !== 1 ? 's' : ''} awaiting review (oldest: ${oldestDays}d)`,
          });
          emailsSent++;
        }

        return { emailsSent };
      });

      totalEmails += result.emailsSent;
    }

    return {
      processed: eligibleOrgs.length,
      totalEmails,
    };
  },
);
