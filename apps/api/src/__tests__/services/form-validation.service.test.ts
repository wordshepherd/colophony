/**
 * Form validation service integration tests.
 *
 * Tests validateFieldValue() against all supported field types
 * with various configs and edge cases. Pure unit tests — no DB needed.
 */
import { describe, it, expect } from 'vitest';
import {
  validateFieldValue,
  type FieldDefinitionForValidation,
} from '../../services/form-validation.service.js';

function makeField(
  overrides: Partial<FieldDefinitionForValidation> & { fieldType: string },
): FieldDefinitionForValidation {
  return {
    fieldKey: overrides.fieldKey ?? 'test_field',
    fieldType: overrides.fieldType,
    label: overrides.label ?? 'Test Field',
    config: overrides.config ?? null,
  };
}

describe('form-validation service — validateFieldValue', () => {
  describe('text / textarea fields', () => {
    it('accepts valid text', () => {
      const field = makeField({ fieldType: 'text' });
      expect(validateFieldValue(field, 'hello')).toEqual([]);
    });

    it('rejects non-string value', () => {
      const field = makeField({ fieldType: 'text' });
      const errors = validateFieldValue(field, 123);
      expect(errors).toHaveLength(1);
      expect(errors[0].message).toContain('must be text');
    });

    it('enforces minLength', () => {
      const field = makeField({
        fieldType: 'text',
        config: { minLength: 5 },
      });
      const errors = validateFieldValue(field, 'hi');
      expect(errors).toHaveLength(1);
      expect(errors[0].message).toContain('at least 5');
    });

    it('enforces maxLength', () => {
      const field = makeField({
        fieldType: 'textarea',
        config: { maxLength: 10 },
      });
      const errors = validateFieldValue(field, 'a'.repeat(15));
      expect(errors).toHaveLength(1);
      expect(errors[0].message).toContain('at most 10');
    });

    it('passes when value is within length bounds', () => {
      const field = makeField({
        fieldType: 'text',
        config: { minLength: 2, maxLength: 10 },
      });
      expect(validateFieldValue(field, 'hello')).toEqual([]);
    });
  });

  describe('number fields', () => {
    it('accepts valid number', () => {
      const field = makeField({ fieldType: 'number' });
      expect(validateFieldValue(field, 42)).toEqual([]);
    });

    it('rejects non-number value', () => {
      const field = makeField({ fieldType: 'number' });
      const errors = validateFieldValue(field, 'forty-two');
      expect(errors).toHaveLength(1);
      expect(errors[0].message).toContain('must be a number');
    });

    it('enforces min', () => {
      const field = makeField({
        fieldType: 'number',
        config: { min: 10 },
      });
      const errors = validateFieldValue(field, 5);
      expect(errors).toHaveLength(1);
      expect(errors[0].message).toContain('at least 10');
    });

    it('enforces max', () => {
      const field = makeField({
        fieldType: 'number',
        config: { max: 100 },
      });
      const errors = validateFieldValue(field, 150);
      expect(errors).toHaveLength(1);
      expect(errors[0].message).toContain('at most 100');
    });
  });

  describe('email fields', () => {
    it('accepts valid email', () => {
      const field = makeField({ fieldType: 'email' });
      expect(validateFieldValue(field, 'test@example.com')).toEqual([]);
    });

    it('rejects invalid email', () => {
      const field = makeField({ fieldType: 'email' });
      const errors = validateFieldValue(field, 'not-an-email');
      expect(errors).toHaveLength(1);
      expect(errors[0].message).toContain('valid email');
    });

    it('rejects non-string value', () => {
      const field = makeField({ fieldType: 'email' });
      const errors = validateFieldValue(field, 123);
      expect(errors).toHaveLength(1);
      expect(errors[0].message).toContain('must be text');
    });
  });

  describe('url fields', () => {
    it('accepts valid URL', () => {
      const field = makeField({ fieldType: 'url' });
      expect(validateFieldValue(field, 'https://example.com')).toEqual([]);
    });

    it('rejects invalid URL', () => {
      const field = makeField({ fieldType: 'url' });
      const errors = validateFieldValue(field, 'not-a-url');
      expect(errors).toHaveLength(1);
      expect(errors[0].message).toContain('valid URL');
    });
  });

  describe('date fields', () => {
    it('accepts valid date string', () => {
      const field = makeField({ fieldType: 'date' });
      expect(validateFieldValue(field, '2026-03-02')).toEqual([]);
    });

    it('rejects invalid date format', () => {
      const field = makeField({ fieldType: 'date' });
      const errors = validateFieldValue(field, '03/02/2026');
      expect(errors).toHaveLength(1);
      expect(errors[0].message).toContain('valid date');
    });

    it('rejects non-string value', () => {
      const field = makeField({ fieldType: 'date' });
      const errors = validateFieldValue(field, 1709337600000);
      expect(errors).toHaveLength(1);
    });
  });

  describe('select / radio fields', () => {
    const selectConfig = {
      options: [
        { label: 'Fiction', value: 'fiction' },
        { label: 'Poetry', value: 'poetry' },
        { label: 'Non-Fiction', value: 'nonfiction' },
      ],
    };

    it('accepts valid option value', () => {
      const field = makeField({ fieldType: 'select', config: selectConfig });
      expect(validateFieldValue(field, 'poetry')).toEqual([]);
    });

    it('rejects invalid option value', () => {
      const field = makeField({ fieldType: 'select', config: selectConfig });
      const errors = validateFieldValue(field, 'drama');
      expect(errors).toHaveLength(1);
      expect(errors[0].message).toContain('must be one of');
    });

    it('rejects non-string value', () => {
      const field = makeField({ fieldType: 'radio', config: selectConfig });
      const errors = validateFieldValue(field, 123);
      expect(errors).toHaveLength(1);
      expect(errors[0].message).toContain('must be a string');
    });
  });

  describe('multi_select / checkbox_group fields', () => {
    const selectConfig = {
      options: [
        { label: 'Fiction', value: 'fiction' },
        { label: 'Poetry', value: 'poetry' },
      ],
    };

    it('accepts valid array of option values', () => {
      const field = makeField({
        fieldType: 'multi_select',
        config: selectConfig,
      });
      expect(validateFieldValue(field, ['fiction', 'poetry'])).toEqual([]);
    });

    it('rejects non-array value', () => {
      const field = makeField({
        fieldType: 'checkbox_group',
        config: selectConfig,
      });
      const errors = validateFieldValue(field, 'fiction');
      expect(errors).toHaveLength(1);
      expect(errors[0].message).toContain('must be an array');
    });

    it('rejects array with invalid option', () => {
      const field = makeField({
        fieldType: 'multi_select',
        config: selectConfig,
      });
      const errors = validateFieldValue(field, ['fiction', 'drama']);
      expect(errors).toHaveLength(1);
      expect(errors[0].message).toContain('invalid option');
    });
  });

  describe('checkbox fields', () => {
    it('accepts boolean true', () => {
      const field = makeField({ fieldType: 'checkbox' });
      expect(validateFieldValue(field, true)).toEqual([]);
    });

    it('accepts boolean false', () => {
      const field = makeField({ fieldType: 'checkbox' });
      expect(validateFieldValue(field, false)).toEqual([]);
    });

    it('rejects non-boolean value', () => {
      const field = makeField({ fieldType: 'checkbox' });
      const errors = validateFieldValue(field, 'yes');
      expect(errors).toHaveLength(1);
      expect(errors[0].message).toContain('true or false');
    });
  });

  describe('rich_text fields', () => {
    it('accepts valid rich text', () => {
      const field = makeField({ fieldType: 'rich_text' });
      expect(validateFieldValue(field, '<p>Hello world</p>')).toEqual([]);
    });

    it('enforces maxLength on rich text', () => {
      const field = makeField({
        fieldType: 'rich_text',
        config: { maxLength: 10 },
      });
      const errors = validateFieldValue(field, 'a'.repeat(20));
      expect(errors).toHaveLength(1);
      expect(errors[0].message).toContain('at most 10');
    });
  });

  describe('file_upload fields', () => {
    it('passes through without validation', () => {
      const field = makeField({ fieldType: 'file_upload' });
      expect(validateFieldValue(field, 'file-ref-uuid')).toEqual([]);
    });
  });
});
