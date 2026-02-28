import type { SubmissionDiscussion } from '@colophony/types';
import { builder } from '../builder.js';

export const SubmissionDiscussionType = builder
  .objectRef<SubmissionDiscussion>('SubmissionDiscussion')
  .implement({
    description:
      'An internal discussion comment on a submission, visible only to editors, admins, and assigned reviewers.',
    fields: (t) => ({
      id: t.exposeString('id', { description: 'Comment ID.' }),
      submissionId: t.exposeString('submissionId', {
        description: 'ID of the submission.',
      }),
      authorId: t.exposeString('authorId', {
        nullable: true,
        description: 'ID of the comment author.',
      }),
      authorEmail: t.exposeString('authorEmail', {
        nullable: true,
        description: "Author's email address.",
      }),
      parentId: t.exposeString('parentId', {
        nullable: true,
        description: 'ID of the parent comment (null for top-level comments).',
      }),
      content: t.exposeString('content', {
        description: 'HTML content of the comment.',
      }),
      createdAt: t.expose('createdAt', {
        type: 'DateTime',
        description: 'When the comment was created.',
      }),
      updatedAt: t.expose('updatedAt', {
        type: 'DateTime',
        nullable: true,
        description: 'When the comment was last updated.',
      }),
    }),
  });
