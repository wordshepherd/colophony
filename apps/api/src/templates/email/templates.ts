import sanitizeHtml from 'sanitize-html';
import { escapeHtml } from './escape-html.js';
import type {
  TemplateName,
  SubmissionTemplateData,
  ContractTemplateData,
  CopyeditorAssignedData,
  EditorMessageTemplateData,
  ReviewerAssignedTemplateData,
  DiscussionCommentTemplateData,
  EmbedSubmissionConfirmationData,
  ResponseReminderTemplateData,
  OrganizationInvitationData,
} from './types.js';
import { wrapInLayout } from './layout.js';

/** Sanitize Tiptap HTML to only allow safe formatting tags */
function sanitizeTiptapHtml(html: string): string {
  return sanitizeHtml(html, {
    allowedTags: [
      'p',
      'br',
      'strong',
      'b',
      'em',
      'i',
      'u',
      'a',
      'ul',
      'ol',
      'li',
      'blockquote',
      'h1',
      'h2',
      'h3',
    ],
    allowedAttributes: {
      a: ['href', 'target', 'rel'],
    },
    allowedSchemes: ['http', 'https', 'mailto'],
  });
}

interface TemplateResult {
  mjml: string;
  text: string;
  subject: string;
}

type TemplateRenderer = (data: Record<string, unknown>) => TemplateResult;

function submissionReceived(data: Record<string, unknown>): TemplateResult {
  const d = data as unknown as SubmissionTemplateData;
  return {
    subject: `New submission: ${d.submissionTitle}`,
    mjml: wrapInLayout(
      `<mj-text>
        <p>A new submission has been received.</p>
        <p><strong>Title:</strong> ${escapeHtml(d.submissionTitle)}</p>
        <p><strong>From:</strong> ${escapeHtml(d.submitterName)} (${escapeHtml(d.submitterEmail)})</p>
        ${d.submissionUrl ? `<p><a href="${escapeHtml(d.submissionUrl)}">View Submission</a></p>` : ''}
      </mj-text>`,
      d.orgName,
    ),
    text: [
      `New submission: ${d.submissionTitle}`,
      `From: ${d.submitterName} (${d.submitterEmail})`,
      d.submissionUrl ? `View: ${d.submissionUrl}` : '',
    ]
      .filter(Boolean)
      .join('\n'),
  };
}

function submissionAccepted(data: Record<string, unknown>): TemplateResult {
  const d = data as unknown as SubmissionTemplateData;
  return {
    subject: `Your submission has been accepted: ${d.submissionTitle}`,
    mjml: wrapInLayout(
      `<mj-text>
        <p>Congratulations! Your submission has been accepted.</p>
        <p><strong>Title:</strong> ${escapeHtml(d.submissionTitle)}</p>
        <p>The editorial team at ${escapeHtml(d.orgName)} will be in touch with next steps.</p>
      </mj-text>${d.editorComment ? `<mj-divider border-color="#e5e7eb" border-width="1px" padding="16px 0" /><mj-text><p><strong>Note from the editors:</strong></p><p>${escapeHtml(d.editorComment)}</p></mj-text>` : ''}`,
      d.orgName,
    ),
    text: [
      `Congratulations! Your submission "${d.submissionTitle}" has been accepted.`,
      `The editorial team at ${d.orgName} will be in touch with next steps.`,
      d.editorComment ? `\nNote from the editors:\n${d.editorComment}` : '',
    ]
      .filter(Boolean)
      .join('\n'),
  };
}

function submissionRejected(data: Record<string, unknown>): TemplateResult {
  const d = data as unknown as SubmissionTemplateData;

  // Build reader feedback sections (MJML and plaintext)
  const feedbackMjml =
    d.readerFeedback && d.readerFeedback.length > 0
      ? `<mj-divider border-color="#e5e7eb" border-width="1px" padding="16px 0" /><mj-text><p><strong>Reader feedback:</strong></p>${d.readerFeedback
          .map((f) => {
            const tagLine =
              f.tags.length > 0
                ? `<p style="color:#6b7280;font-size:13px">${f.tags.map((t) => escapeHtml(t)).join(', ')}</p>`
                : '';
            const commentLine = f.comment
              ? `<p>${escapeHtml(f.comment)}</p>`
              : '';
            return `<div style="margin-bottom:12px;padding-left:12px;border-left:3px solid #e5e7eb">${tagLine}${commentLine}</div>`;
          })
          .join('')}</mj-text>`
      : '';

  const feedbackText =
    d.readerFeedback && d.readerFeedback.length > 0
      ? `\nReader feedback:\n${d.readerFeedback
          .map((f) => {
            const parts = [...f.tags, f.comment].filter(Boolean);
            return `- ${parts.join(': ')}`;
          })
          .join('\n')}`
      : '';

  return {
    subject: `Update on your submission: ${d.submissionTitle}`,
    mjml: wrapInLayout(
      `<mj-text>
        <p>Thank you for your submission. After careful review, we are unable to accept it at this time.</p>
        <p><strong>Title:</strong> ${escapeHtml(d.submissionTitle)}</p>
        <p>We appreciate your interest in ${escapeHtml(d.orgName)} and encourage future submissions.</p>
      </mj-text>${d.editorComment ? `<mj-divider border-color="#e5e7eb" border-width="1px" padding="16px 0" /><mj-text><p><strong>Note from the editors:</strong></p><p>${escapeHtml(d.editorComment)}</p></mj-text>` : ''}${feedbackMjml}`,
      d.orgName,
    ),
    text: [
      `Thank you for your submission "${d.submissionTitle}".`,
      `After careful review, we are unable to accept it at this time.`,
      `We appreciate your interest in ${d.orgName} and encourage future submissions.`,
      d.editorComment ? `\nNote from the editors:\n${d.editorComment}` : '',
      feedbackText,
    ]
      .filter(Boolean)
      .join('\n'),
  };
}

function submissionReviseResubmit(
  data: Record<string, unknown>,
): TemplateResult {
  const d = data as unknown as SubmissionTemplateData;
  return {
    subject: `Revision requested for your submission: ${d.submissionTitle}`,
    mjml: wrapInLayout(
      `<mj-text>
        <p>After careful review, the editors at ${escapeHtml(d.orgName)} are interested in your work but are requesting revisions before a final decision.</p>
        <p><strong>Title:</strong> ${escapeHtml(d.submissionTitle)}</p>
      </mj-text>${d.editorComment ? `<mj-divider border-color="#e5e7eb" border-width="1px" padding="16px 0" /><mj-text><p><strong>Revision notes:</strong></p><p>${escapeHtml(d.editorComment)}</p></mj-text>` : ''}<mj-text><p>Please review the feedback and submit a revised version through your submission portal.</p>${d.submissionUrl ? `<p><a href="${escapeHtml(d.submissionUrl)}">View Submission</a></p>` : ''}</mj-text>`,
      d.orgName,
    ),
    text: [
      `Revision requested for your submission: ${d.submissionTitle}`,
      `After careful review, the editors at ${d.orgName} are interested in your work but are requesting revisions.`,
      d.editorComment ? `\nRevision notes:\n${d.editorComment}` : '',
      `\nPlease review the feedback and submit a revised version through your submission portal.`,
      d.submissionUrl ? `\nView: ${d.submissionUrl}` : '',
    ]
      .filter(Boolean)
      .join('\n'),
  };
}

function submissionWithdrawn(data: Record<string, unknown>): TemplateResult {
  const d = data as unknown as SubmissionTemplateData;
  return {
    subject: `Submission withdrawn: ${d.submissionTitle}`,
    mjml: wrapInLayout(
      `<mj-text>
        <p>A submission has been withdrawn by its author.</p>
        <p><strong>Title:</strong> ${escapeHtml(d.submissionTitle)}</p>
        <p><strong>Author:</strong> ${escapeHtml(d.submitterName)} (${escapeHtml(d.submitterEmail)})</p>
      </mj-text>`,
      d.orgName,
    ),
    text: [
      `Submission withdrawn: ${d.submissionTitle}`,
      `Author: ${d.submitterName} (${d.submitterEmail})`,
    ].join('\n'),
  };
}

function contractReady(data: Record<string, unknown>): TemplateResult {
  const d = data as unknown as ContractTemplateData;
  return {
    subject: `Contract ready for signing: ${d.submissionTitle}`,
    mjml: wrapInLayout(
      `<mj-text>
        <p>A contract is ready for your review and signature.</p>
        <p><strong>Submission:</strong> ${escapeHtml(d.submissionTitle)}</p>
        ${d.contractUrl ? `<p><a href="${escapeHtml(d.contractUrl)}">Review Contract</a></p>` : ''}
      </mj-text>`,
      d.orgName,
    ),
    text: [
      `A contract is ready for your review and signature.`,
      `Submission: ${d.submissionTitle}`,
      d.contractUrl ? `Review: ${d.contractUrl}` : '',
    ]
      .filter(Boolean)
      .join('\n'),
  };
}

function copyeditorAssigned(data: Record<string, unknown>): TemplateResult {
  const d = data as unknown as CopyeditorAssignedData;
  return {
    subject: `You've been assigned as copyeditor: ${d.submissionTitle}`,
    mjml: wrapInLayout(
      `<mj-text>
        <p>You have been assigned as the copyeditor for a submission.</p>
        <p><strong>Title:</strong> ${escapeHtml(d.submissionTitle)}</p>
        ${d.pipelineUrl ? `<p><a href="${escapeHtml(d.pipelineUrl)}">View in Pipeline</a></p>` : ''}
      </mj-text>`,
      d.orgName,
    ),
    text: [
      `You have been assigned as the copyeditor for "${d.submissionTitle}".`,
      d.pipelineUrl ? `View: ${d.pipelineUrl}` : '',
    ]
      .filter(Boolean)
      .join('\n'),
  };
}

function editorMessage(data: Record<string, unknown>): TemplateResult {
  const d = data as unknown as EditorMessageTemplateData;
  return {
    subject: d.messageSubject,
    mjml: wrapInLayout(
      `<mj-text>
        <p>You have received a message from the editorial team at ${escapeHtml(d.orgName)}.</p>
        <p><strong>Regarding:</strong> ${escapeHtml(d.submissionTitle)}</p>
      </mj-text>
      <mj-divider border-color="#e5e7eb" border-width="1px" padding="16px 0" />
      <mj-text>
        ${sanitizeTiptapHtml(d.messageBody)}
      </mj-text>`,
      d.orgName,
    ),
    text: [
      `You have received a message from the editorial team at ${d.orgName}.`,
      `Regarding: ${d.submissionTitle}`,
      '',
      stripHtml(sanitizeTiptapHtml(d.messageBody)),
    ].join('\n'),
  };
}

function reviewerAssigned(data: Record<string, unknown>): TemplateResult {
  const d = data as unknown as ReviewerAssignedTemplateData;
  return {
    subject: `You've been assigned to review: ${d.submissionTitle}`,
    mjml: wrapInLayout(
      `<mj-text>
        <p>You have been assigned as a reviewer for a submission.</p>
        <p><strong>Title:</strong> ${escapeHtml(d.submissionTitle)}</p>
        <p><strong>Assigned by:</strong> ${escapeHtml(d.assignedByName)}</p>
        ${d.submissionUrl ? `<p><a href="${escapeHtml(d.submissionUrl)}">View Submission</a></p>` : ''}
      </mj-text>`,
      d.orgName,
    ),
    text: [
      `You have been assigned as a reviewer for "${d.submissionTitle}".`,
      `Assigned by: ${d.assignedByName}`,
      d.submissionUrl ? `View: ${d.submissionUrl}` : '',
    ]
      .filter(Boolean)
      .join('\n'),
  };
}

function discussionComment(data: Record<string, unknown>): TemplateResult {
  const d = data as unknown as DiscussionCommentTemplateData;
  return {
    subject: `New discussion comment on: ${d.submissionTitle}`,
    mjml: wrapInLayout(
      `<mj-text>
        <p>A team member commented on the internal discussion for a submission.</p>
        <p><strong>Title:</strong> ${escapeHtml(d.submissionTitle)}</p>
        <p><strong>Comment by:</strong> ${escapeHtml(d.authorName)}</p>
        ${d.submissionUrl ? `<p><a href="${escapeHtml(d.submissionUrl)}">View Submission</a></p>` : ''}
      </mj-text>`,
      d.orgName,
    ),
    text: [
      `A team member commented on the internal discussion for "${d.submissionTitle}".`,
      `Comment by: ${d.authorName}`,
      d.submissionUrl ? `View: ${d.submissionUrl}` : '',
    ]
      .filter(Boolean)
      .join('\n'),
  };
}

function embedSubmissionConfirmation(
  data: Record<string, unknown>,
): TemplateResult {
  const d = data as unknown as EmbedSubmissionConfirmationData;
  return {
    subject: `Submission received: ${d.submissionTitle}`,
    mjml: wrapInLayout(
      `<mj-text>
        <p>Thank you for your submission!</p>
        <p><strong>Title:</strong> ${escapeHtml(d.submissionTitle)}</p>
        <p>Your submission to ${escapeHtml(d.orgName)} has been received and is under review.</p>
      </mj-text>
      <mj-button href="${escapeHtml(d.statusCheckUrl)}" background-color="#2563eb" color="#ffffff" font-size="14px" padding="16px 0">
        Check Submission Status
      </mj-button>
      <mj-text font-size="12px" color="#6b7280">
        <p>Or copy this link: ${escapeHtml(d.statusCheckUrl)}</p>
      </mj-text>`,
      d.orgName,
    ),
    text: [
      `Thank you for your submission!`,
      `Title: ${d.submissionTitle}`,
      `Your submission to ${d.orgName} has been received and is under review.`,
      ``,
      `Check your submission status: ${d.statusCheckUrl}`,
    ].join('\n'),
  };
}

function submissionResponseReminder(
  data: Record<string, unknown>,
): TemplateResult {
  const d = data as unknown as ResponseReminderTemplateData;
  const summaryLine = `Showing ${d.topSubmissions.length} of ${d.totalAging} aging submissions. Oldest: ${d.oldestDays} days.`;
  const rows = d.topSubmissions
    .map(
      (s) =>
        `<tr>
          <td style="padding:8px;border-bottom:1px solid #e5e7eb">${escapeHtml(s.title)}</td>
          <td style="padding:8px;border-bottom:1px solid #e5e7eb">${escapeHtml(s.submitterEmail)}</td>
          <td style="padding:8px;border-bottom:1px solid #e5e7eb;text-align:right">${s.daysPending}d</td>
        </tr>`,
    )
    .join('');
  return {
    subject: `Response reminder: ${d.totalAging} submission${d.totalAging !== 1 ? 's' : ''} awaiting review (oldest: ${d.oldestDays}d)`,
    mjml: wrapInLayout(
      `<mj-text>
        <p>Hi ${escapeHtml(d.editorName)},</p>
        <p>The following submissions at ${escapeHtml(d.orgName)} have been waiting for a response:</p>
      </mj-text>
      <mj-table>
        <tr style="background-color:#f3f4f6;text-align:left">
          <th style="padding:8px">Title</th>
          <th style="padding:8px">Submitter</th>
          <th style="padding:8px;text-align:right">Age</th>
        </tr>
        ${rows}
      </mj-table>
      <mj-text font-size="13px" color="#6b7280">
        <p>${escapeHtml(summaryLine)}</p>
      </mj-text>
      ${d.hasMore && d.queueUrl ? `<mj-button href="${escapeHtml(d.queueUrl)}" background-color="#2563eb" color="#ffffff" font-size="14px" padding="16px 0">View All in Queue</mj-button>` : d.queueUrl ? `<mj-button href="${escapeHtml(d.queueUrl)}" background-color="#2563eb" color="#ffffff" font-size="14px" padding="16px 0">View Queue</mj-button>` : ''}`,
      d.orgName,
    ),
    text: [
      `Hi ${d.editorName},`,
      ``,
      `The following submissions at ${d.orgName} have been waiting for a response:`,
      ``,
      ...d.topSubmissions.map(
        (s) => `- ${s.title} (${s.submitterEmail}) — ${s.daysPending} days`,
      ),
      ``,
      summaryLine,
      ``,
      d.hasMore && d.queueUrl
        ? `View all in your queue: ${d.queueUrl}`
        : d.queueUrl
          ? `View queue: ${d.queueUrl}`
          : '',
    ]
      .filter(Boolean)
      .join('\n'),
  };
}

function organizationInvitation(data: Record<string, unknown>): TemplateResult {
  const d = data as unknown as OrganizationInvitationData;
  return {
    subject: `You've been invited to join ${d.orgName}`,
    mjml: wrapInLayout(
      `<mj-text>
        <p>${escapeHtml(d.inviterName)} has invited you to join <strong>${escapeHtml(d.orgName)}</strong> as <strong>${escapeHtml(d.roleName)}</strong>.</p>
      </mj-text>
      <mj-button href="${escapeHtml(d.inviteUrl)}" background-color="#2563eb" color="#ffffff" font-size="14px" padding="16px 0">
        Accept Invitation
      </mj-button>
      <mj-text font-size="12px" color="#6b7280">
        <p>This invitation expires on ${escapeHtml(d.expiresAt)}.</p>
        <p>Or copy this link: ${escapeHtml(d.inviteUrl)}</p>
      </mj-text>`,
      d.orgName,
    ),
    text: [
      `${d.inviterName} has invited you to join ${d.orgName} as ${d.roleName}.`,
      '',
      `Accept the invitation: ${d.inviteUrl}`,
      '',
      `This invitation expires on ${d.expiresAt}.`,
    ].join('\n'),
  };
}

export const templates: Record<TemplateName, TemplateRenderer> = {
  'submission-received': submissionReceived,
  'submission-accepted': submissionAccepted,
  'submission-rejected': submissionRejected,
  'submission-revise-resubmit': submissionReviseResubmit,
  'submission-withdrawn': submissionWithdrawn,
  'contract-ready': contractReady,
  'copyeditor-assigned': copyeditorAssigned,
  'editor-message': editorMessage,
  'reviewer-assigned': reviewerAssigned,
  'discussion-comment': discussionComment,
  'embed-submission-confirmation': embedSubmissionConfirmation,
  'submission-response-reminder': submissionResponseReminder,
  'organization-invitation': organizationInvitation,
};

function stripHtml(html: string): string {
  return sanitizeHtml(html, { allowedTags: [], allowedAttributes: {} })
    .replace(/&nbsp;/g, ' ')
    .trim();
}
