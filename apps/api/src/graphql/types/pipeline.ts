import type {
  PipelineItem,
  PipelineHistoryEntry,
  PipelineComment,
} from '@colophony/types';
import { builder } from '../builder.js';

// ---------------------------------------------------------------------------
// Enums
// ---------------------------------------------------------------------------

export const PipelineStageEnum = builder.enumType('PipelineStage', {
  description: 'Stage in the publication pipeline.',
  values: {
    COPYEDIT_PENDING: { description: 'Awaiting copyeditor assignment.' },
    COPYEDIT_IN_PROGRESS: { description: 'Copyediting in progress.' },
    AUTHOR_REVIEW: { description: 'Author is reviewing copyedits.' },
    PROOFREAD: { description: 'Proofreading in progress.' },
    READY_TO_PUBLISH: { description: 'Ready for publication.' },
    PUBLISHED: { description: 'Published.' },
    WITHDRAWN: { description: 'Withdrawn from pipeline.' },
  } as const,
});

// ---------------------------------------------------------------------------
// Object types
// ---------------------------------------------------------------------------

export const PipelineItemType = builder
  .objectRef<PipelineItem>('PipelineItem')
  .implement({
    description:
      'A pipeline item — an accepted submission moving through the publication workflow.',
    fields: (t) => ({
      id: t.exposeString('id', { description: 'Pipeline item ID.' }),
      organizationId: t.exposeString('organizationId', {
        description: 'Organization ID.',
      }),
      submissionId: t.exposeString('submissionId', {
        description: 'Linked submission ID.',
      }),
      publicationId: t.exposeString('publicationId', {
        nullable: true,
        description: 'Target publication ID.',
      }),
      stage: t.exposeString('stage', {
        description: 'Current pipeline stage.',
      }),
      assignedCopyeditorId: t.exposeString('assignedCopyeditorId', {
        nullable: true,
        description: 'Assigned copyeditor user ID.',
      }),
      assignedProofreaderId: t.exposeString('assignedProofreaderId', {
        nullable: true,
        description: 'Assigned proofreader user ID.',
      }),
      copyeditDueAt: t.expose('copyeditDueAt', {
        type: 'DateTime',
        nullable: true,
        description: 'Copyedit deadline.',
      }),
      proofreadDueAt: t.expose('proofreadDueAt', {
        type: 'DateTime',
        nullable: true,
        description: 'Proofread deadline.',
      }),
      authorReviewDueAt: t.expose('authorReviewDueAt', {
        type: 'DateTime',
        nullable: true,
        description: 'Author review deadline.',
      }),
      inngestRunId: t.exposeString('inngestRunId', {
        nullable: true,
        description: 'Active Inngest workflow run ID.',
      }),
      createdAt: t.expose('createdAt', {
        type: 'DateTime',
        description: 'When the item entered the pipeline.',
      }),
      updatedAt: t.expose('updatedAt', {
        type: 'DateTime',
        description: 'When the item was last updated.',
      }),
    }),
  });

export const PipelineHistoryEntryType = builder
  .objectRef<PipelineHistoryEntry>('PipelineHistoryEntry')
  .implement({
    description: 'A stage transition in the pipeline history.',
    fields: (t) => ({
      id: t.exposeString('id'),
      pipelineItemId: t.exposeString('pipelineItemId'),
      fromStage: t.exposeString('fromStage', { nullable: true }),
      toStage: t.exposeString('toStage'),
      changedBy: t.exposeString('changedBy', { nullable: true }),
      comment: t.exposeString('comment', { nullable: true }),
      changedAt: t.expose('changedAt', { type: 'DateTime' }),
    }),
  });

export const PipelineCommentType = builder
  .objectRef<PipelineComment>('PipelineComment')
  .implement({
    description: 'A comment on a pipeline item.',
    fields: (t) => ({
      id: t.exposeString('id'),
      pipelineItemId: t.exposeString('pipelineItemId'),
      authorId: t.exposeString('authorId', { nullable: true }),
      content: t.exposeString('content'),
      stage: t.exposeString('stage'),
      createdAt: t.expose('createdAt', { type: 'DateTime' }),
    }),
  });
