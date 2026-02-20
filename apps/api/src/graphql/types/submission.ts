import type { Submission, SubmissionHistoryEntry } from '@colophony/db';
import { builder } from '../builder.js';
import { SubmissionStatusEnum } from './enums.js';
import { SubmissionFileType } from './file.js';
import { UserType } from './user.js';

export const SubmissionType = builder
  .objectRef<Submission>('Submission')
  .implement({
    fields: (t) => ({
      id: t.exposeString('id'),
      organizationId: t.exposeString('organizationId'),
      submitterId: t.exposeString('submitterId'),
      submissionPeriodId: t.exposeString('submissionPeriodId', {
        nullable: true,
      }),
      title: t.exposeString('title', { nullable: true }),
      content: t.exposeString('content', { nullable: true }),
      coverLetter: t.exposeString('coverLetter', { nullable: true }),
      status: t.expose('status', { type: SubmissionStatusEnum }),
      submittedAt: t.expose('submittedAt', {
        type: 'DateTime',
        nullable: true,
      }),
      createdAt: t.expose('createdAt', { type: 'DateTime' }),
      updatedAt: t.expose('updatedAt', { type: 'DateTime' }),
      files: t.field({
        type: [SubmissionFileType],
        resolve: (submission, _args, ctx) =>
          ctx.loaders.submissionFiles.load(submission.id),
      }),
      submitter: t.field({
        type: UserType,
        nullable: true,
        resolve: (submission, _args, ctx) =>
          ctx.loaders.user.load(submission.submitterId),
      }),
    }),
  });

export const SubmissionHistoryType = builder
  .objectRef<SubmissionHistoryEntry>('SubmissionHistory')
  .implement({
    fields: (t) => ({
      id: t.exposeString('id'),
      submissionId: t.exposeString('submissionId'),
      fromStatus: t.expose('fromStatus', {
        type: SubmissionStatusEnum,
        nullable: true,
      }),
      toStatus: t.expose('toStatus', { type: SubmissionStatusEnum }),
      changedBy: t.exposeString('changedBy', { nullable: true }),
      comment: t.exposeString('comment', { nullable: true }),
      changedAt: t.expose('changedAt', { type: 'DateTime' }),
    }),
  });
