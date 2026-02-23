import type { FormDefinition, FormField, FormPage } from '@colophony/db';
import { builder } from '../builder.js';

// ---------------------------------------------------------------------------
// Enums
// ---------------------------------------------------------------------------

export const FormStatusEnum = builder.enumType('FormStatus', {
  description: 'Current status of a form definition.',
  values: {
    DRAFT: {
      description: 'Form is being designed — fields can be added/edited.',
    },
    PUBLISHED: {
      description: 'Form is live — can be linked to submission periods.',
    },
    ARCHIVED: {
      description: 'Form is retired — no longer assignable to new periods.',
    },
  } as const,
});

export const FormFieldTypeEnum = builder.enumType('FormFieldType', {
  description: 'Type of form field.',
  values: {
    text: { description: 'Single-line text input.' },
    textarea: { description: 'Multi-line text input.' },
    rich_text: { description: 'Rich text editor (HTML).' },
    number: { description: 'Numeric input.' },
    email: { description: 'Email address input.' },
    url: { description: 'URL input.' },
    date: { description: 'Date picker.' },
    select: { description: 'Single-select dropdown.' },
    multi_select: { description: 'Multi-select dropdown.' },
    radio: { description: 'Radio button group.' },
    checkbox: { description: 'Single checkbox (boolean).' },
    checkbox_group: { description: 'Checkbox group (multiple selection).' },
    file_upload: { description: 'File upload field.' },
    section_header: { description: 'Presentational — section heading.' },
    info_text: { description: 'Presentational — informational text block.' },
  } as const,
});

// ---------------------------------------------------------------------------
// Object types
// ---------------------------------------------------------------------------

export const FormFieldType = builder
  .objectRef<FormField>('FormField')
  .implement({
    description: 'A field within a form definition.',
    fields: (t) => ({
      id: t.exposeString('id', { description: 'Unique identifier.' }),
      formDefinitionId: t.exposeString('formDefinitionId', {
        description: 'ID of the parent form definition.',
      }),
      fieldKey: t.exposeString('fieldKey', {
        description: 'Machine name (unique per form).',
      }),
      fieldType: t.expose('fieldType', {
        type: FormFieldTypeEnum,
        description: 'Type of form field.',
      }),
      label: t.exposeString('label', { description: 'Human-readable label.' }),
      description: t.exposeString('description', {
        nullable: true,
        description: 'Help text.',
      }),
      placeholder: t.exposeString('placeholder', {
        nullable: true,
        description: 'Placeholder text.',
      }),
      required: t.exposeBoolean('required', {
        description: 'Whether this field is required.',
      }),
      sortOrder: t.exposeInt('sortOrder', {
        description: 'Display order within the form.',
      }),
      config: t.expose('config', {
        type: 'JSON',
        nullable: true,
        description: 'Type-specific configuration (options, min/max, etc.).',
      }),
      conditionalRules: t.expose('conditionalRules', {
        type: 'JSON',
        nullable: true,
        description: 'Conditional display rules.',
      }),
      branchId: t.exposeString('branchId', {
        nullable: true,
        description: 'Branch ID this field belongs to.',
      }),
      pageId: t.exposeString('pageId', {
        nullable: true,
        description: 'Page this field belongs to.',
      }),
      createdAt: t.expose('createdAt', {
        type: 'DateTime',
        description: 'When the field was created.',
      }),
      updatedAt: t.expose('updatedAt', {
        type: 'DateTime',
        description: 'When the field was last updated.',
      }),
    }),
  });

export const FormPageType = builder.objectRef<FormPage>('FormPage').implement({
  description: 'A page within a multi-page form definition.',
  fields: (t) => ({
    id: t.exposeString('id', { description: 'Unique identifier.' }),
    formDefinitionId: t.exposeString('formDefinitionId', {
      description: 'ID of the parent form definition.',
    }),
    title: t.exposeString('title', { description: 'Page title.' }),
    description: t.exposeString('description', {
      nullable: true,
      description: 'Page description.',
    }),
    sortOrder: t.exposeInt('sortOrder', {
      description: 'Display order within the form.',
    }),
    branchingRules: t.expose('branchingRules', {
      type: 'JSON',
      nullable: true,
      description: 'Page-level branching rules.',
    }),
    createdAt: t.expose('createdAt', {
      type: 'DateTime',
      description: 'When the page was created.',
    }),
    updatedAt: t.expose('updatedAt', {
      type: 'DateTime',
      description: 'When the page was last updated.',
    }),
  }),
});

export const FormDefinitionType = builder
  .objectRef<FormDefinition>('FormDefinition')
  .implement({
    description:
      'A form definition that describes the fields submitters fill out.',
    fields: (t) => ({
      id: t.exposeString('id', { description: 'Unique identifier.' }),
      organizationId: t.exposeString('organizationId', {
        description: 'ID of the owning organization.',
      }),
      name: t.exposeString('name', { description: 'Display name.' }),
      description: t.exposeString('description', {
        nullable: true,
        description: 'Description of the form.',
      }),
      status: t.expose('status', {
        type: FormStatusEnum,
        description: 'Current lifecycle status.',
      }),
      version: t.exposeInt('version', { description: 'Version number.' }),
      duplicatedFromId: t.exposeString('duplicatedFromId', {
        nullable: true,
        description: 'ID of the form this was duplicated from.',
      }),
      createdBy: t.exposeString('createdBy', {
        nullable: true,
        description: 'ID of the user who created this form.',
      }),
      publishedAt: t.expose('publishedAt', {
        type: 'DateTime',
        nullable: true,
        description: 'When the form was published.',
      }),
      archivedAt: t.expose('archivedAt', {
        type: 'DateTime',
        nullable: true,
        description: 'When the form was archived.',
      }),
      createdAt: t.expose('createdAt', {
        type: 'DateTime',
        description: 'When the form was created.',
      }),
      updatedAt: t.expose('updatedAt', {
        type: 'DateTime',
        description: 'When the form was last updated.',
      }),
      fields: t.field({
        type: [FormFieldType],
        description: 'Fields in this form, ordered by sortOrder.',
        resolve: (form, _args, ctx) => ctx.loaders.formFields.load(form.id),
      }),
      pages: t.field({
        type: [FormPageType],
        description: 'Pages in this form, ordered by sortOrder.',
        resolve: (form, _args, ctx) => ctx.loaders.formPages.load(form.id),
      }),
    }),
  });
