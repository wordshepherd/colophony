import type { ContractTemplate, Contract } from '@colophony/types';
import { builder } from '../builder.js';

// ---------------------------------------------------------------------------
// Enums
// ---------------------------------------------------------------------------

export const ContractStatusEnum = builder.enumType('ContractStatus', {
  description: 'Status of a contract.',
  values: {
    DRAFT: { description: 'Draft — not yet sent.' },
    SENT: { description: 'Sent for signing.' },
    VIEWED: { description: 'Viewed by the signer.' },
    SIGNED: { description: 'Signed by the author.' },
    COUNTERSIGNED: { description: 'Countersigned by the publisher.' },
    COMPLETED: { description: 'Fully completed.' },
    VOIDED: { description: 'Voided / cancelled.' },
  } as const,
});

// ---------------------------------------------------------------------------
// Object types
// ---------------------------------------------------------------------------

export const ContractTemplateType = builder
  .objectRef<ContractTemplate>('ContractTemplate')
  .implement({
    description: 'A contract template with merge field placeholders.',
    fields: (t) => ({
      id: t.exposeString('id', { description: 'Template ID.' }),
      organizationId: t.exposeString('organizationId', {
        description: 'Organization ID.',
      }),
      name: t.exposeString('name', { description: 'Template name.' }),
      description: t.exposeString('description', {
        nullable: true,
        description: 'Template description.',
      }),
      body: t.exposeString('body', {
        description: 'Template body with {{merge_field}} placeholders.',
      }),
      isDefault: t.exposeBoolean('isDefault', {
        description: 'Whether this is the default template.',
      }),
      createdAt: t.expose('createdAt', {
        type: 'DateTime',
        description: 'When the template was created.',
      }),
      updatedAt: t.expose('updatedAt', {
        type: 'DateTime',
        description: 'When the template was last updated.',
      }),
    }),
  });

export const ContractType = builder.objectRef<Contract>('Contract').implement({
  description: 'A generated contract linked to a pipeline item.',
  fields: (t) => ({
    id: t.exposeString('id', { description: 'Contract ID.' }),
    organizationId: t.exposeString('organizationId', {
      description: 'Organization ID.',
    }),
    pipelineItemId: t.exposeString('pipelineItemId', {
      description: 'Pipeline item ID.',
    }),
    contractTemplateId: t.exposeString('contractTemplateId', {
      nullable: true,
      description: 'Source template ID.',
    }),
    status: t.exposeString('status', {
      description: 'Contract status.',
    }),
    renderedBody: t.exposeString('renderedBody', {
      description: 'Contract body with merge fields resolved.',
    }),
    documensoDocumentId: t.exposeString('documensoDocumentId', {
      nullable: true,
      description: 'Documenso document ID.',
    }),
    signedAt: t.expose('signedAt', {
      type: 'DateTime',
      nullable: true,
      description: 'When the contract was signed.',
    }),
    countersignedAt: t.expose('countersignedAt', {
      type: 'DateTime',
      nullable: true,
      description: 'When the contract was countersigned.',
    }),
    completedAt: t.expose('completedAt', {
      type: 'DateTime',
      nullable: true,
      description: 'When the contract was completed.',
    }),
    createdAt: t.expose('createdAt', {
      type: 'DateTime',
      description: 'When the contract was created.',
    }),
    updatedAt: t.expose('updatedAt', {
      type: 'DateTime',
      description: 'When the contract was last updated.',
    }),
  }),
});
