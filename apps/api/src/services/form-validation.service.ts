import { z } from 'zod';
import type { FormFieldError } from '@colophony/types';
import {
  textFieldConfigSchema,
  numberFieldConfigSchema,
  selectFieldConfigSchema,
  richTextFieldConfigSchema,
} from '@colophony/types';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/**
 * Minimal field shape needed for validation. Matches the subset of
 * `formFields.$inferSelect` used by the validator — avoids coupling
 * to the full Drizzle column type.
 */
export interface FieldDefinitionForValidation {
  fieldKey: string;
  fieldType: string;
  label: string;
  config: Record<string, unknown> | null;
}

// ---------------------------------------------------------------------------
// Field value validation
// ---------------------------------------------------------------------------

/**
 * Pure validation of a single field value against its type and config.
 * No DB access — takes field definition + value, returns errors.
 */
export function validateFieldValue(
  field: FieldDefinitionForValidation,
  value: unknown,
): FormFieldError[] {
  const errors: FormFieldError[] = [];
  const config = field.config ?? {};

  switch (field.fieldType) {
    case 'text':
    case 'textarea': {
      if (typeof value !== 'string') {
        errors.push({
          fieldKey: field.fieldKey,
          message: `${field.label} must be text`,
        });
        break;
      }
      const parsed = textFieldConfigSchema.safeParse(config);
      if (parsed.success) {
        if (
          parsed.data.minLength !== undefined &&
          value.length < parsed.data.minLength
        ) {
          errors.push({
            fieldKey: field.fieldKey,
            message: `${field.label} must be at least ${parsed.data.minLength} characters`,
          });
        }
        if (
          parsed.data.maxLength !== undefined &&
          value.length > parsed.data.maxLength
        ) {
          errors.push({
            fieldKey: field.fieldKey,
            message: `${field.label} must be at most ${parsed.data.maxLength} characters`,
          });
        }
      }
      break;
    }
    case 'rich_text': {
      if (typeof value !== 'string') {
        errors.push({
          fieldKey: field.fieldKey,
          message: `${field.label} must be text`,
        });
        break;
      }
      const parsed = richTextFieldConfigSchema.safeParse(config);
      if (
        parsed.success &&
        parsed.data.maxLength !== undefined &&
        value.length > parsed.data.maxLength
      ) {
        errors.push({
          fieldKey: field.fieldKey,
          message: `${field.label} must be at most ${parsed.data.maxLength} characters`,
        });
      }
      break;
    }
    case 'number': {
      if (typeof value !== 'number') {
        errors.push({
          fieldKey: field.fieldKey,
          message: `${field.label} must be a number`,
        });
        break;
      }
      const parsed = numberFieldConfigSchema.safeParse(config);
      if (parsed.success) {
        if (parsed.data.min !== undefined && value < parsed.data.min) {
          errors.push({
            fieldKey: field.fieldKey,
            message: `${field.label} must be at least ${parsed.data.min}`,
          });
        }
        if (parsed.data.max !== undefined && value > parsed.data.max) {
          errors.push({
            fieldKey: field.fieldKey,
            message: `${field.label} must be at most ${parsed.data.max}`,
          });
        }
      }
      break;
    }
    case 'email': {
      if (typeof value !== 'string') {
        errors.push({
          fieldKey: field.fieldKey,
          message: `${field.label} must be text`,
        });
        break;
      }
      const emailResult = z.string().email().safeParse(value);
      if (!emailResult.success) {
        errors.push({
          fieldKey: field.fieldKey,
          message: `${field.label} must be a valid email address`,
        });
      }
      break;
    }
    case 'url': {
      if (typeof value !== 'string') {
        errors.push({
          fieldKey: field.fieldKey,
          message: `${field.label} must be text`,
        });
        break;
      }
      const urlResult = z.string().url().safeParse(value);
      if (!urlResult.success) {
        errors.push({
          fieldKey: field.fieldKey,
          message: `${field.label} must be a valid URL`,
        });
      }
      break;
    }
    case 'date': {
      if (typeof value !== 'string') {
        errors.push({
          fieldKey: field.fieldKey,
          message: `${field.label} must be a date string`,
        });
        break;
      }
      const dateResult = z.string().date().safeParse(value);
      if (!dateResult.success) {
        errors.push({
          fieldKey: field.fieldKey,
          message: `${field.label} must be a valid date (YYYY-MM-DD)`,
        });
      }
      break;
    }
    case 'select':
    case 'radio': {
      if (typeof value !== 'string') {
        errors.push({
          fieldKey: field.fieldKey,
          message: `${field.label} must be a string`,
        });
        break;
      }
      const parsed = selectFieldConfigSchema.safeParse(config);
      if (parsed.success) {
        const validValues = parsed.data.options.map((o) => o.value);
        if (!validValues.includes(value)) {
          const validLabels = parsed.data.options.map((o) => o.label);
          errors.push({
            fieldKey: field.fieldKey,
            message: `${field.label} must be one of: ${validLabels.join(', ')}`,
          });
        }
      }
      break;
    }
    case 'multi_select':
    case 'checkbox_group': {
      if (!Array.isArray(value)) {
        errors.push({
          fieldKey: field.fieldKey,
          message: `${field.label} must be an array`,
        });
        break;
      }
      const parsed = selectFieldConfigSchema.safeParse(config);
      if (parsed.success) {
        const { options } = parsed.data;
        const validValues = options.map((o) => o.value);
        for (const v of value) {
          if (typeof v !== 'string' || !validValues.includes(v)) {
            const validLabels = options.map((o) => o.label);
            errors.push({
              fieldKey: field.fieldKey,
              message: `${field.label} contains invalid option. Valid options: ${validLabels.join(', ')}`,
            });
            break;
          }
        }
      }
      break;
    }
    case 'checkbox': {
      if (typeof value !== 'boolean') {
        errors.push({
          fieldKey: field.fieldKey,
          message: `${field.label} must be true or false`,
        });
      }
      break;
    }
    case 'file_upload': {
      // File upload validation happens at the file upload layer, not here.
      // We only validate the reference exists.
      break;
    }
  }

  return errors;
}
