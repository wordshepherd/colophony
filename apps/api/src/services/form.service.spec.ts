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
