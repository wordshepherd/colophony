import type { Issue, IssueSection, IssueItem } from '@colophony/types';
import { builder } from '../builder.js';

// ---------------------------------------------------------------------------
// Enums
// ---------------------------------------------------------------------------

export const IssueStatusEnum = builder.enumType('IssueStatus', {
  description: 'Status of an issue.',
  values: {
    PLANNING: { description: 'Being planned.' },
    ASSEMBLING: { description: 'Content being assembled.' },
    READY: { description: 'Ready for publication.' },
    PUBLISHED: { description: 'Published.' },
    ARCHIVED: { description: 'Archived.' },
  } as const,
});

// ---------------------------------------------------------------------------
// Object types
// ---------------------------------------------------------------------------

export const IssueType = builder.objectRef<Issue>('Issue').implement({
  description: 'An issue — a collection of pipeline items for publication.',
  fields: (t) => ({
    id: t.exposeString('id', { description: 'Issue ID.' }),
    organizationId: t.exposeString('organizationId', {
      description: 'Organization ID.',
    }),
    publicationId: t.exposeString('publicationId', {
      description: 'Publication ID.',
    }),
    title: t.exposeString('title', { description: 'Issue title.' }),
    volume: t.exposeInt('volume', {
      nullable: true,
      description: 'Volume number.',
    }),
    issueNumber: t.exposeInt('issueNumber', {
      nullable: true,
      description: 'Issue number.',
    }),
    description: t.exposeString('description', {
      nullable: true,
      description: 'Issue description.',
    }),
    coverImageUrl: t.exposeString('coverImageUrl', {
      nullable: true,
      description: 'Cover image URL.',
    }),
    status: t.exposeString('status', { description: 'Issue status.' }),
    publicationDate: t.expose('publicationDate', {
      type: 'DateTime',
      nullable: true,
      description: 'Scheduled publication date.',
    }),
    publishedAt: t.expose('publishedAt', {
      type: 'DateTime',
      nullable: true,
      description: 'Actual publish timestamp.',
    }),
    createdAt: t.expose('createdAt', {
      type: 'DateTime',
      description: 'When the issue was created.',
    }),
    updatedAt: t.expose('updatedAt', {
      type: 'DateTime',
      description: 'When the issue was last updated.',
    }),
  }),
});

export const IssueSectionType = builder
  .objectRef<IssueSection>('IssueSection')
  .implement({
    description: 'A section within an issue for grouping items.',
    fields: (t) => ({
      id: t.exposeString('id'),
      issueId: t.exposeString('issueId'),
      title: t.exposeString('title'),
      sortOrder: t.exposeInt('sortOrder'),
      createdAt: t.expose('createdAt', { type: 'DateTime' }),
    }),
  });

export const IssueItemType = builder
  .objectRef<IssueItem>('IssueItem')
  .implement({
    description: 'A pipeline item placed in an issue.',
    fields: (t) => ({
      id: t.exposeString('id'),
      issueId: t.exposeString('issueId'),
      pipelineItemId: t.exposeString('pipelineItemId'),
      issueSectionId: t.exposeString('issueSectionId', { nullable: true }),
      sortOrder: t.exposeInt('sortOrder'),
      createdAt: t.expose('createdAt', { type: 'DateTime' }),
    }),
  });
