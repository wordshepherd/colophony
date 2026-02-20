import { describe, it, expect, vi, beforeEach } from 'vitest';

// ---------------------------------------------------------------------------
// Drizzle mocks
// ---------------------------------------------------------------------------

vi.mock('@colophony/db', () => ({
  pool: { query: vi.fn(), connect: vi.fn() },
  db: { query: {} },
  formDefinitions: {},
  formFields: {},
  submissions: {},
  submissionPeriods: {},
  eq: vi.fn(),
  and: vi.fn(),
  sql: vi.fn(),
  asc: vi.fn(),
  inArray: vi.fn(),
}));

vi.mock('drizzle-orm', () => ({
  eq: vi.fn(),
  and: vi.fn(),
  sql: vi.fn(),
  asc: vi.fn(),
  inArray: vi.fn(),
  count: vi.fn(),
  ilike: vi.fn(),
}));

import { formService, FormNotFoundError } from './form.service.js';
import type { DrizzleDb } from '@colophony/db';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeFormWithFields(fieldOverrides: Record<string, unknown>[] = [{}]) {
  return {
    id: 'form-1',
    organizationId: 'org-1',
    name: 'Test Form',
    description: null,
    status: 'PUBLISHED' as const,
    version: 1,
    duplicatedFromId: null,
    createdBy: 'user-1',
    publishedAt: new Date(),
    archivedAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    fields: fieldOverrides.map((overrides, i) => ({
      id: `field-${i}`,
      formDefinitionId: 'form-1',
      fieldKey: `field_${i}`,
      fieldType: 'text' as const,
      label: `Field ${i}`,
      description: null,
      placeholder: null,
      required: false,
      sortOrder: i,
      config: null,
      conditionalRules: null,
      createdAt: new Date(),
      updatedAt: new Date(),
      ...overrides,
    })),
  };
}

// ---------------------------------------------------------------------------
// Tests — validateFormData
// ---------------------------------------------------------------------------

describe('formService.validateFormData', () => {
  const mockTx = {} as DrizzleDb;

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('throws FormNotFoundError when form does not exist', async () => {
    vi.spyOn(formService, 'getById').mockResolvedValueOnce(null);

    await expect(
      formService.validateFormData(mockTx, 'nonexistent', {}),
    ).rejects.toThrow(FormNotFoundError);
  });

  it('returns empty errors for valid data', async () => {
    const form = makeFormWithFields([
      { fieldKey: 'name', fieldType: 'text', required: false },
    ]);
    vi.spyOn(formService, 'getById').mockResolvedValueOnce(form);

    const errors = await formService.validateFormData(mockTx, 'form-1', {
      name: 'Test',
    });
    expect(errors).toEqual([]);
  });

  it('validates required fields', async () => {
    const form = makeFormWithFields([
      {
        fieldKey: 'name',
        fieldType: 'text',
        label: 'Name',
        required: true,
      },
    ]);
    vi.spyOn(formService, 'getById').mockResolvedValueOnce(form);

    const errors = await formService.validateFormData(mockTx, 'form-1', {});
    expect(errors).toHaveLength(1);
    expect(errors[0].fieldKey).toBe('name');
    expect(errors[0].message).toContain('required');
  });

  it('skips presentational fields', async () => {
    const form = makeFormWithFields([
      {
        fieldKey: 'header',
        fieldType: 'section_header',
        required: true,
      },
      {
        fieldKey: 'info',
        fieldType: 'info_text',
        required: true,
      },
    ]);
    vi.spyOn(formService, 'getById').mockResolvedValueOnce(form);

    const errors = await formService.validateFormData(mockTx, 'form-1', {});
    expect(errors).toEqual([]);
  });

  it('validates text field type', async () => {
    const form = makeFormWithFields([
      { fieldKey: 'name', fieldType: 'text', label: 'Name' },
    ]);
    vi.spyOn(formService, 'getById').mockResolvedValueOnce(form);

    const errors = await formService.validateFormData(mockTx, 'form-1', {
      name: 123,
    });
    expect(errors).toHaveLength(1);
    expect(errors[0].message).toContain('must be text');
  });

  it('validates text field minLength', async () => {
    const form = makeFormWithFields([
      {
        fieldKey: 'name',
        fieldType: 'text',
        label: 'Name',
        config: { minLength: 5 },
      },
    ]);
    vi.spyOn(formService, 'getById').mockResolvedValueOnce(form);

    const errors = await formService.validateFormData(mockTx, 'form-1', {
      name: 'ab',
    });
    expect(errors).toHaveLength(1);
    expect(errors[0].message).toContain('at least 5');
  });

  it('validates text field maxLength', async () => {
    const form = makeFormWithFields([
      {
        fieldKey: 'name',
        fieldType: 'text',
        label: 'Name',
        config: { maxLength: 3 },
      },
    ]);
    vi.spyOn(formService, 'getById').mockResolvedValueOnce(form);

    const errors = await formService.validateFormData(mockTx, 'form-1', {
      name: 'abcdef',
    });
    expect(errors).toHaveLength(1);
    expect(errors[0].message).toContain('at most 3');
  });

  it('validates number field type', async () => {
    const form = makeFormWithFields([
      { fieldKey: 'age', fieldType: 'number', label: 'Age' },
    ]);
    vi.spyOn(formService, 'getById').mockResolvedValueOnce(form);

    const errors = await formService.validateFormData(mockTx, 'form-1', {
      age: 'not-a-number',
    });
    expect(errors).toHaveLength(1);
    expect(errors[0].message).toContain('must be a number');
  });

  it('validates number field min/max', async () => {
    const form = makeFormWithFields([
      {
        fieldKey: 'age',
        fieldType: 'number',
        label: 'Age',
        config: { min: 18, max: 120 },
      },
    ]);
    vi.spyOn(formService, 'getById').mockResolvedValueOnce(form);

    const errors = await formService.validateFormData(mockTx, 'form-1', {
      age: 10,
    });
    expect(errors).toHaveLength(1);
    expect(errors[0].message).toContain('at least 18');
  });

  it('validates email field', async () => {
    const form = makeFormWithFields([
      { fieldKey: 'email', fieldType: 'email', label: 'Email' },
    ]);
    vi.spyOn(formService, 'getById').mockResolvedValueOnce(form);

    const errors = await formService.validateFormData(mockTx, 'form-1', {
      email: 'not-an-email',
    });
    expect(errors).toHaveLength(1);
    expect(errors[0].message).toContain('valid email');
  });

  it('validates url field', async () => {
    const form = makeFormWithFields([
      { fieldKey: 'website', fieldType: 'url', label: 'Website' },
    ]);
    vi.spyOn(formService, 'getById').mockResolvedValueOnce(form);

    const errors = await formService.validateFormData(mockTx, 'form-1', {
      website: 'not-a-url',
    });
    expect(errors).toHaveLength(1);
    expect(errors[0].message).toContain('valid URL');
  });

  it('validates date field', async () => {
    const form = makeFormWithFields([
      { fieldKey: 'dob', fieldType: 'date', label: 'Date of Birth' },
    ]);
    vi.spyOn(formService, 'getById').mockResolvedValueOnce(form);

    const errors = await formService.validateFormData(mockTx, 'form-1', {
      dob: 'not-a-date',
    });
    expect(errors).toHaveLength(1);
    expect(errors[0].message).toContain('valid date');
  });

  it('validates select field options', async () => {
    const form = makeFormWithFields([
      {
        fieldKey: 'genre',
        fieldType: 'select',
        label: 'Genre',
        config: {
          options: [
            { label: 'Poetry', value: 'poetry' },
            { label: 'Fiction', value: 'fiction' },
          ],
        },
      },
    ]);
    vi.spyOn(formService, 'getById').mockResolvedValueOnce(form);

    const errors = await formService.validateFormData(mockTx, 'form-1', {
      genre: 'non-fiction',
    });
    expect(errors).toHaveLength(1);
    expect(errors[0].message).toContain('must be one of');
  });

  it('validates multi_select field', async () => {
    const form = makeFormWithFields([
      {
        fieldKey: 'tags',
        fieldType: 'multi_select',
        label: 'Tags',
        config: {
          options: [
            { label: 'A', value: 'a' },
            { label: 'B', value: 'b' },
          ],
        },
      },
    ]);
    vi.spyOn(formService, 'getById').mockResolvedValueOnce(form);

    const errors = await formService.validateFormData(mockTx, 'form-1', {
      tags: ['a', 'invalid'],
    });
    expect(errors).toHaveLength(1);
    expect(errors[0].message).toContain('invalid option');
  });

  it('validates checkbox field must be boolean', async () => {
    const form = makeFormWithFields([
      { fieldKey: 'agree', fieldType: 'checkbox', label: 'Agree' },
    ]);
    vi.spyOn(formService, 'getById').mockResolvedValueOnce(form);

    const errors = await formService.validateFormData(mockTx, 'form-1', {
      agree: 'yes',
    });
    expect(errors).toHaveLength(1);
    expect(errors[0].message).toContain('true or false');
  });

  it('skips optional empty fields', async () => {
    const form = makeFormWithFields([
      {
        fieldKey: 'bio',
        fieldType: 'textarea',
        label: 'Bio',
        required: false,
      },
    ]);
    vi.spyOn(formService, 'getById').mockResolvedValueOnce(form);

    const errors = await formService.validateFormData(mockTx, 'form-1', {});
    expect(errors).toEqual([]);
  });

  it('validates multiple fields at once', async () => {
    const form = makeFormWithFields([
      {
        fieldKey: 'name',
        fieldType: 'text',
        label: 'Name',
        required: true,
      },
      {
        fieldKey: 'email',
        fieldType: 'email',
        label: 'Email',
        required: true,
      },
      {
        fieldKey: 'age',
        fieldType: 'number',
        label: 'Age',
      },
    ]);
    vi.spyOn(formService, 'getById').mockResolvedValueOnce(form);

    const errors = await formService.validateFormData(mockTx, 'form-1', {
      age: 'not-a-number',
    });
    // name required, email required, age wrong type
    expect(errors).toHaveLength(3);
    expect(errors.map((e) => e.fieldKey)).toEqual(
      expect.arrayContaining(['name', 'email', 'age']),
    );
  });
});
