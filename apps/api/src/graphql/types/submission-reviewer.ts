import type { SubmissionReviewer } from '@colophony/types';
import { builder } from '../builder.js';
import { RoleEnum } from './enums.js';

export const SubmissionReviewerType = builder
  .objectRef<SubmissionReviewer>('SubmissionReviewer')
  .implement({
    description:
      'A reviewer assignment on a submission, tracking who has been assigned and whether they have read it.',
    fields: (t) => ({
      id: t.exposeString('id', { description: 'Assignment record ID.' }),
      submissionId: t.exposeString('submissionId', {
        description: 'ID of the submission.',
      }),
      reviewerUserId: t.exposeString('reviewerUserId', {
        description: 'ID of the reviewer user.',
      }),
      reviewerEmail: t.exposeString('reviewerEmail', {
        description: "Reviewer's email address.",
      }),
      reviewerRole: t.expose('reviewerRole', {
        type: RoleEnum,
        description: "Reviewer's role in the organization.",
      }),
      assignedBy: t.exposeString('assignedBy', {
        nullable: true,
        description: 'ID of the user who assigned this reviewer.',
      }),
      assignedAt: t.expose('assignedAt', {
        type: 'DateTime',
        description: 'When the reviewer was assigned.',
      }),
      readAt: t.expose('readAt', {
        type: 'DateTime',
        nullable: true,
        description:
          'When the reviewer first viewed the submission (null = unread).',
      }),
    }),
  });
