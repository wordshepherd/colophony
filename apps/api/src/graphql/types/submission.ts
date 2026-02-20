import type { Submission, SubmissionHistoryEntry } from '@colophony/db';
import { builder } from '../builder.js';
import { SubmissionStatusEnum } from './enums.js';
import { SubmissionFileType } from './file.js';
import { UserType } from './user.js';

export const SubmissionType = builder
  .objectRef<Submission>('Submission')
  .implement({
    description:
      'A literary submission (manuscript, poem, story, etc.) under review.',
    fields: (t) => ({
      id: t.exposeString('id', { description: 'Unique identifier.' }),
      organizationId: t.exposeString('organizationId', {
        description: 'ID of the owning organization.',
      }),
      submitterId: t.exposeString('submitterId', {
        description: 'ID of the user who created this submission.',
      }),
      submissionPeriodId: t.exposeString('submissionPeriodId', {
        nullable: true,
        description: 'ID of the associated submission period, if any.',
      }),
      title: t.exposeString('title', {
        nullable: true,
        description: 'Title of the submission.',
      }),
      content: t.exposeString('content', {
        nullable: true,
        description: 'Body content of the submission.',
      }),
      coverLetter: t.exposeString('coverLetter', {
        nullable: true,
        description: 'Optional cover letter.',
      }),
      status: t.expose('status', {
        type: SubmissionStatusEnum,
        description: 'Current workflow status.',
      }),
      submittedAt: t.expose('submittedAt', {
        type: 'DateTime',
        nullable: true,
        description:
          'When the submission was formally submitted (null if still a draft).',
      }),
      createdAt: t.expose('createdAt', {
        type: 'DateTime',
        description: 'When the submission was created.',
      }),
      updatedAt: t.expose('updatedAt', {
        type: 'DateTime',
        description: 'When the submission was last updated.',
      }),
      files: t.field({
        type: [SubmissionFileType],
        description: 'Files attached to this submission.',
        resolve: (submission, _args, ctx) =>
          ctx.loaders.submissionFiles.load(submission.id),
      }),
      submitter: t.field({
        type: UserType,
        nullable: true,
        description: 'The user who created this submission.',
        resolve: (submission, _args, ctx) =>
          ctx.loaders.user.load(submission.submitterId),
      }),
    }),
  });

export const SubmissionHistoryType = builder
  .objectRef<SubmissionHistoryEntry>('SubmissionHistory')
  .implement({
    description: "A record of a status change in a submission's workflow.",
    fields: (t) => ({
      id: t.exposeString('id', { description: 'History entry ID.' }),
      submissionId: t.exposeString('submissionId', {
        description: 'ID of the submission.',
      }),
      fromStatus: t.expose('fromStatus', {
        type: SubmissionStatusEnum,
        nullable: true,
        description: 'Previous status (null for initial creation).',
      }),
      toStatus: t.expose('toStatus', {
        type: SubmissionStatusEnum,
        description: 'New status after the transition.',
      }),
      changedBy: t.exposeString('changedBy', {
        nullable: true,
        description: 'ID of the user who made the change.',
      }),
      comment: t.exposeString('comment', {
        nullable: true,
        description: 'Optional comment explaining the change.',
      }),
      changedAt: t.expose('changedAt', {
        type: 'DateTime',
        description: 'When the status change occurred.',
      }),
    }),
  });
