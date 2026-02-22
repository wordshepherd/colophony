import { describe, it, expect, vi, beforeEach } from 'vitest';

// ---------------------------------------------------------------------------
// Drizzle mocks
// ---------------------------------------------------------------------------

vi.mock('@colophony/db', () => ({
  pool: { query: vi.fn(), connect: vi.fn() },
  db: { query: {} },
  formDefinitions: {},
  formFields: {},
  formPages: {},
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
  desc: vi.fn(),
}));

import { formService } from './form.service.js';
import type { DrizzleDb } from '@colophony/db';

// ---------------------------------------------------------------------------
// Constants — valid UUIDs for branch IDs
// ---------------------------------------------------------------------------

const BRANCH_POETRY = 'a0000000-0000-4000-a000-000000000001';
const BRANCH_FICTION = 'a0000000-0000-4000-a000-000000000002';
const BRANCH_HAIKU = 'a0000000-0000-4000-a000-000000000003';

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
    pages: [],
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
      branchId: null,
      pageId: null,
      createdAt: new Date(),
      updatedAt: new Date(),
      ...overrides,
    })),
  };
}

// ---------------------------------------------------------------------------
// Tests — branching in validateFormData
// ---------------------------------------------------------------------------

describe('formService.validateFormData — branching', () => {
  const mockTx = {} as DrizzleDb;

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('skips validation for fields in inactive branches', async () => {
    const form = makeFormWithFields([
      {
        fieldKey: 'genre',
        fieldType: 'select',
        label: 'Genre',
        required: false,
        config: {
          options: [
            { label: 'Poetry', value: 'poetry' },
            { label: 'Fiction', value: 'fiction' },
          ],
          branching: {
            enabled: true,
            branches: [
              { id: BRANCH_POETRY, name: 'Poetry', optionValues: ['poetry'] },
              {
                id: BRANCH_FICTION,
                name: 'Fiction',
                optionValues: ['fiction'],
              },
            ],
          },
        },
      },
      {
        fieldKey: 'line_count',
        fieldType: 'number',
        label: 'Line Count',
        required: true,
        branchId: BRANCH_POETRY,
      },
      {
        fieldKey: 'word_count',
        fieldType: 'number',
        label: 'Word Count',
        required: true,
        branchId: BRANCH_FICTION,
      },
    ]);
    vi.spyOn(formService, 'getById').mockResolvedValueOnce(form);

    // Genre is "fiction" → line_count (poetry branch) should be skipped
    const errors = await formService.validateFormData(mockTx, 'form-1', {
      genre: 'fiction',
      word_count: 500,
    });
    expect(errors).toEqual([]);
  });

  it('validates required fields in active branches', async () => {
    const form = makeFormWithFields([
      {
        fieldKey: 'genre',
        fieldType: 'select',
        label: 'Genre',
        required: false,
        config: {
          options: [
            { label: 'Poetry', value: 'poetry' },
            { label: 'Fiction', value: 'fiction' },
          ],
          branching: {
            enabled: true,
            branches: [
              { id: BRANCH_POETRY, name: 'Poetry', optionValues: ['poetry'] },
            ],
          },
        },
      },
      {
        fieldKey: 'line_count',
        fieldType: 'number',
        label: 'Line Count',
        required: true,
        branchId: BRANCH_POETRY,
      },
    ]);
    vi.spyOn(formService, 'getById').mockResolvedValueOnce(form);

    // Genre is "poetry" → line_count (poetry branch) is active and required → error
    const errors = await formService.validateFormData(mockTx, 'form-1', {
      genre: 'poetry',
    });
    expect(errors).toHaveLength(1);
    expect(errors[0].fieldKey).toBe('line_count');
    expect(errors[0].message).toContain('required');
  });

  it('skips all branched fields when source field is empty', async () => {
    const form = makeFormWithFields([
      {
        fieldKey: 'genre',
        fieldType: 'select',
        label: 'Genre',
        required: false,
        config: {
          options: [{ label: 'Poetry', value: 'poetry' }],
          branching: {
            enabled: true,
            branches: [
              { id: BRANCH_POETRY, name: 'Poetry', optionValues: ['poetry'] },
            ],
          },
        },
      },
      {
        fieldKey: 'line_count',
        fieldType: 'number',
        label: 'Line Count',
        required: true,
        branchId: BRANCH_POETRY,
      },
    ]);
    vi.spyOn(formService, 'getById').mockResolvedValueOnce(form);

    // No genre selected → branch inactive → line_count not validated
    const errors = await formService.validateFormData(mockTx, 'form-1', {});
    expect(errors).toEqual([]);
  });

  it('handles sub-branching (field in branch that depends on another branched field)', async () => {
    const form = makeFormWithFields([
      {
        fieldKey: 'genre',
        fieldType: 'select',
        label: 'Genre',
        required: false,
        config: {
          options: [
            { label: 'Poetry', value: 'poetry' },
            { label: 'Fiction', value: 'fiction' },
          ],
          branching: {
            enabled: true,
            branches: [
              { id: BRANCH_POETRY, name: 'Poetry', optionValues: ['poetry'] },
            ],
          },
        },
      },
      {
        fieldKey: 'poetry_type',
        fieldType: 'select',
        label: 'Poetry Type',
        required: false,
        branchId: BRANCH_POETRY,
        config: {
          options: [
            { label: 'Haiku', value: 'haiku' },
            { label: 'Sonnet', value: 'sonnet' },
          ],
          branching: {
            enabled: true,
            branches: [
              { id: BRANCH_HAIKU, name: 'Haiku', optionValues: ['haiku'] },
            ],
          },
        },
      },
      {
        fieldKey: 'syllable_count',
        fieldType: 'number',
        label: 'Syllable Count',
        required: true,
        branchId: BRANCH_HAIKU,
      },
    ]);
    vi.spyOn(formService, 'getById').mockResolvedValueOnce(form);

    // Fiction selected → poetry branch inactive → haiku sub-branch inactive → no errors
    const errors = await formService.validateFormData(mockTx, 'form-1', {
      genre: 'fiction',
    });
    expect(errors).toEqual([]);
  });

  it('validates sub-branched fields when all parent branches are active', async () => {
    const form = makeFormWithFields([
      {
        fieldKey: 'genre',
        fieldType: 'select',
        label: 'Genre',
        required: false,
        config: {
          options: [{ label: 'Poetry', value: 'poetry' }],
          branching: {
            enabled: true,
            branches: [
              { id: BRANCH_POETRY, name: 'Poetry', optionValues: ['poetry'] },
            ],
          },
        },
      },
      {
        fieldKey: 'poetry_type',
        fieldType: 'select',
        label: 'Poetry Type',
        required: false,
        branchId: BRANCH_POETRY,
        config: {
          options: [{ label: 'Haiku', value: 'haiku' }],
          branching: {
            enabled: true,
            branches: [
              { id: BRANCH_HAIKU, name: 'Haiku', optionValues: ['haiku'] },
            ],
          },
        },
      },
      {
        fieldKey: 'syllable_count',
        fieldType: 'number',
        label: 'Syllable Count',
        required: true,
        branchId: BRANCH_HAIKU,
      },
    ]);
    vi.spyOn(formService, 'getById').mockResolvedValueOnce(form);

    // Poetry → Haiku → syllable_count is active and required
    const errors = await formService.validateFormData(mockTx, 'form-1', {
      genre: 'poetry',
      poetry_type: 'haiku',
    });
    expect(errors).toHaveLength(1);
    expect(errors[0].fieldKey).toBe('syllable_count');
    expect(errors[0].message).toContain('required');
  });

  it('combines branching with conditional rules', async () => {
    const form = makeFormWithFields([
      {
        fieldKey: 'genre',
        fieldType: 'select',
        label: 'Genre',
        required: false,
        config: {
          options: [{ label: 'Poetry', value: 'poetry' }],
          branching: {
            enabled: true,
            branches: [
              { id: BRANCH_POETRY, name: 'Poetry', optionValues: ['poetry'] },
            ],
          },
        },
      },
      {
        fieldKey: 'line_count',
        fieldType: 'number',
        label: 'Line Count',
        required: false,
        branchId: BRANCH_POETRY,
        conditionalRules: [
          {
            effect: 'REQUIRE',
            condition: {
              operator: 'AND',
              rules: [{ field: 'genre', comparator: 'eq', value: 'poetry' }],
            },
          },
        ],
      },
    ]);
    vi.spyOn(formService, 'getById').mockResolvedValueOnce(form);

    // Poetry selected → branch active → REQUIRE condition met → required
    const errors = await formService.validateFormData(mockTx, 'form-1', {
      genre: 'poetry',
    });
    expect(errors).toHaveLength(1);
    expect(errors[0].fieldKey).toBe('line_count');
    expect(errors[0].message).toContain('required');
  });
});
