import type { SubmissionPeriod } from '@colophony/types';
import { builder } from '../builder.js';

// ---------------------------------------------------------------------------
// Enums
// ---------------------------------------------------------------------------

export const PeriodStatusEnum = builder.enumType('PeriodStatus', {
  description: 'Computed status of a submission period based on date range.',
  values: {
    UPCOMING: {
      description: 'Period has not opened yet (opensAt is in the future).',
    },
    OPEN: {
      description:
        'Period is currently accepting submissions (between opensAt and closesAt).',
    },
    CLOSED: {
      description: 'Period is past its deadline (closesAt is in the past).',
    },
  } as const,
});

// ---------------------------------------------------------------------------
// Object type
// ---------------------------------------------------------------------------

export const SubmissionPeriodType = builder
  .objectRef<SubmissionPeriod>('SubmissionPeriod')
  .implement({
    description:
      'A submission period — a time window during which submissions are accepted.',
    fields: (t) => ({
      id: t.exposeString('id', { description: 'Unique identifier.' }),
      organizationId: t.exposeString('organizationId', {
        description: 'ID of the owning organization.',
      }),
      name: t.exposeString('name', { description: 'Display name.' }),
      description: t.exposeString('description', {
        nullable: true,
        description: 'Optional description.',
      }),
      opensAt: t.expose('opensAt', {
        type: 'DateTime',
        description: 'When submissions open.',
      }),
      closesAt: t.expose('closesAt', {
        type: 'DateTime',
        description: 'When submissions close.',
      }),
      fee: t.exposeFloat('fee', {
        nullable: true,
        description: 'Submission fee in cents (null = free).',
      }),
      maxSubmissions: t.exposeInt('maxSubmissions', {
        nullable: true,
        description: 'Maximum submissions allowed (null = unlimited).',
      }),
      formDefinitionId: t.exposeString('formDefinitionId', {
        nullable: true,
        description: 'ID of the linked form definition.',
      }),
      createdAt: t.expose('createdAt', {
        type: 'DateTime',
        description: 'When the period was created.',
      }),
      updatedAt: t.expose('updatedAt', {
        type: 'DateTime',
        description: 'When the period was last updated.',
      }),
    }),
  });
