import { describe, it, expect } from 'vitest';
import { validateFieldValue } from './form-validation.service.js';
import type { FieldDefinitionForValidation } from './form-validation.service.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeField(
  overrides: Partial<FieldDefinitionForValidation> = {},
): FieldDefinitionForValidation {
  return {
    fieldKey: 'test_field',
    fieldType: 'text',
    label: 'Test Field',
    config: null,
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Tests — validateFieldValue
// ---------------------------------------------------------------------------

describe('validateFieldValue', () => {
  // -----------------------------------------------------------------------
  // text / textarea
  // -----------------------------------------------------------------------

  it('rejects non-string for text field', () => {
    const errors = validateFieldValue(
      makeField({ fieldType: 'text', label: 'Name' }),
      123,
    );
    expect(errors).toHaveLength(1);
    expect(errors[0].message).toContain('must be text');
  });

  it('accepts valid text', () => {
    const errors = validateFieldValue(
      makeField({ fieldType: 'text' }),
      'hello',
    );
    expect(errors).toEqual([]);
  });

  it('validates text minLength', () => {
    const errors = validateFieldValue(
      makeField({ fieldType: 'text', label: 'Name', config: { minLength: 5 } }),
      'ab',
    );
    expect(errors).toHaveLength(1);
    expect(errors[0].message).toContain('at least 5');
  });

  it('validates text maxLength', () => {
    const errors = validateFieldValue(
      makeField({ fieldType: 'text', label: 'Name', config: { maxLength: 3 } }),
      'abcdef',
    );
    expect(errors).toHaveLength(1);
    expect(errors[0].message).toContain('at most 3');
  });

  it('validates textarea same as text', () => {
    const errors = validateFieldValue(
      makeField({ fieldType: 'textarea', label: 'Bio' }),
      123,
    );
    expect(errors).toHaveLength(1);
    expect(errors[0].message).toContain('must be text');
  });

  // -----------------------------------------------------------------------
  // rich_text
  // -----------------------------------------------------------------------

  it('rejects non-string for rich_text', () => {
    const errors = validateFieldValue(
      makeField({ fieldType: 'rich_text', label: 'Content' }),
      42,
    );
    expect(errors).toHaveLength(1);
    expect(errors[0].message).toContain('must be text');
  });

  it('validates rich_text maxLength', () => {
    const errors = validateFieldValue(
      makeField({
        fieldType: 'rich_text',
        label: 'Content',
        config: { maxLength: 5 },
      }),
      'this is too long',
    );
    expect(errors).toHaveLength(1);
    expect(errors[0].message).toContain('at most 5');
  });

  // -----------------------------------------------------------------------
  // number
  // -----------------------------------------------------------------------

  it('rejects non-number for number field', () => {
    const errors = validateFieldValue(
      makeField({ fieldType: 'number', label: 'Age' }),
      'not-a-number',
    );
    expect(errors).toHaveLength(1);
    expect(errors[0].message).toContain('must be a number');
  });

  it('validates number min', () => {
    const errors = validateFieldValue(
      makeField({
        fieldType: 'number',
        label: 'Age',
        config: { min: 18, max: 120 },
      }),
      10,
    );
    expect(errors).toHaveLength(1);
    expect(errors[0].message).toContain('at least 18');
  });

  it('validates number max', () => {
    const errors = validateFieldValue(
      makeField({
        fieldType: 'number',
        label: 'Age',
        config: { min: 18, max: 120 },
      }),
      200,
    );
    expect(errors).toHaveLength(1);
    expect(errors[0].message).toContain('at most 120');
  });

  it('accepts valid number', () => {
    const errors = validateFieldValue(
      makeField({
        fieldType: 'number',
        label: 'Age',
        config: { min: 18, max: 120 },
      }),
      25,
    );
    expect(errors).toEqual([]);
  });

  // -----------------------------------------------------------------------
  // email
  // -----------------------------------------------------------------------

  it('rejects invalid email', () => {
    const errors = validateFieldValue(
      makeField({ fieldType: 'email', label: 'Email' }),
      'not-an-email',
    );
    expect(errors).toHaveLength(1);
    expect(errors[0].message).toContain('valid email');
  });

  it('accepts valid email', () => {
    const errors = validateFieldValue(
      makeField({ fieldType: 'email', label: 'Email' }),
      'test@example.com',
    );
    expect(errors).toEqual([]);
  });

  // -----------------------------------------------------------------------
  // url
  // -----------------------------------------------------------------------

  it('rejects invalid URL', () => {
    const errors = validateFieldValue(
      makeField({ fieldType: 'url', label: 'Website' }),
      'not-a-url',
    );
    expect(errors).toHaveLength(1);
    expect(errors[0].message).toContain('valid URL');
  });

  it('accepts valid URL', () => {
    const errors = validateFieldValue(
      makeField({ fieldType: 'url', label: 'Website' }),
      'https://example.com',
    );
    expect(errors).toEqual([]);
  });

  // -----------------------------------------------------------------------
  // date
  // -----------------------------------------------------------------------

  it('rejects invalid date', () => {
    const errors = validateFieldValue(
      makeField({ fieldType: 'date', label: 'Date of Birth' }),
      'not-a-date',
    );
    expect(errors).toHaveLength(1);
    expect(errors[0].message).toContain('valid date');
  });

  it('accepts valid date', () => {
    const errors = validateFieldValue(
      makeField({ fieldType: 'date', label: 'Date of Birth' }),
      '2026-01-15',
    );
    expect(errors).toEqual([]);
  });

  // -----------------------------------------------------------------------
  // select / radio
  // -----------------------------------------------------------------------

  it('rejects invalid select option', () => {
    const errors = validateFieldValue(
      makeField({
        fieldType: 'select',
        label: 'Genre',
        config: {
          options: [
            { label: 'Poetry', value: 'poetry' },
            { label: 'Fiction', value: 'fiction' },
          ],
        },
      }),
      'non-fiction',
    );
    expect(errors).toHaveLength(1);
    expect(errors[0].message).toContain('must be one of');
  });

  it('accepts valid select option', () => {
    const errors = validateFieldValue(
      makeField({
        fieldType: 'select',
        label: 'Genre',
        config: {
          options: [
            { label: 'Poetry', value: 'poetry' },
            { label: 'Fiction', value: 'fiction' },
          ],
        },
      }),
      'poetry',
    );
    expect(errors).toEqual([]);
  });

  it('validates radio same as select', () => {
    const errors = validateFieldValue(
      makeField({
        fieldType: 'radio',
        label: 'Choice',
        config: {
          options: [{ label: 'A', value: 'a' }],
        },
      }),
      'b',
    );
    expect(errors).toHaveLength(1);
    expect(errors[0].message).toContain('must be one of');
  });

  // -----------------------------------------------------------------------
  // multi_select / checkbox_group
  // -----------------------------------------------------------------------

  it('rejects non-array for multi_select', () => {
    const errors = validateFieldValue(
      makeField({ fieldType: 'multi_select', label: 'Tags' }),
      'not-an-array',
    );
    expect(errors).toHaveLength(1);
    expect(errors[0].message).toContain('must be an array');
  });

  it('rejects invalid option in multi_select', () => {
    const errors = validateFieldValue(
      makeField({
        fieldType: 'multi_select',
        label: 'Tags',
        config: {
          options: [
            { label: 'A', value: 'a' },
            { label: 'B', value: 'b' },
          ],
        },
      }),
      ['a', 'invalid'],
    );
    expect(errors).toHaveLength(1);
    expect(errors[0].message).toContain('invalid option');
  });

  it('accepts valid multi_select values', () => {
    const errors = validateFieldValue(
      makeField({
        fieldType: 'multi_select',
        label: 'Tags',
        config: {
          options: [
            { label: 'A', value: 'a' },
            { label: 'B', value: 'b' },
          ],
        },
      }),
      ['a', 'b'],
    );
    expect(errors).toEqual([]);
  });

  it('validates checkbox_group same as multi_select', () => {
    const errors = validateFieldValue(
      makeField({
        fieldType: 'checkbox_group',
        label: 'Options',
        config: {
          options: [{ label: 'X', value: 'x' }],
        },
      }),
      ['y'],
    );
    expect(errors).toHaveLength(1);
    expect(errors[0].message).toContain('invalid option');
  });

  // -----------------------------------------------------------------------
  // checkbox
  // -----------------------------------------------------------------------

  it('rejects non-boolean for checkbox', () => {
    const errors = validateFieldValue(
      makeField({ fieldType: 'checkbox', label: 'Agree' }),
      'yes',
    );
    expect(errors).toHaveLength(1);
    expect(errors[0].message).toContain('true or false');
  });

  it('accepts boolean for checkbox', () => {
    const errors = validateFieldValue(
      makeField({ fieldType: 'checkbox', label: 'Agree' }),
      true,
    );
    expect(errors).toEqual([]);
  });

  // -----------------------------------------------------------------------
  // file_upload
  // -----------------------------------------------------------------------

  it('passes file_upload without validation', () => {
    const errors = validateFieldValue(
      makeField({ fieldType: 'file_upload', label: 'Resume' }),
      'any-value',
    );
    expect(errors).toEqual([]);
  });
});
