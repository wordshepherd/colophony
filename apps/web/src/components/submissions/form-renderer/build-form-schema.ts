import { z } from "zod";
import {
  textFieldConfigSchema,
  numberFieldConfigSchema,
  selectFieldConfigSchema,
  richTextFieldConfigSchema,
  PRESENTATIONAL_FIELD_TYPES,
} from "@colophony/types";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface FormFieldForRenderer {
  fieldKey: string;
  fieldType: string;
  label: string;
  description: string | null;
  placeholder: string | null;
  required: boolean;
  config: Record<string, unknown> | null;
}

export interface FormSchemaResult {
  schema: z.ZodObject<Record<string, z.ZodTypeAny>>;
  defaultValues: Record<string, unknown>;
}

// ---------------------------------------------------------------------------
// Schema builder
// ---------------------------------------------------------------------------

function buildFieldSchema(field: FormFieldForRenderer): z.ZodTypeAny | null {
  const config = field.config ?? {};

  switch (field.fieldType) {
    case "text":
    case "textarea": {
      let s = z.string();
      const parsed = textFieldConfigSchema.safeParse(config);
      if (parsed.success) {
        if (parsed.data.minLength !== undefined) {
          s = s.min(
            parsed.data.minLength,
            `${field.label} must be at least ${parsed.data.minLength} characters`,
          );
        }
        if (parsed.data.maxLength !== undefined) {
          s = s.max(
            parsed.data.maxLength,
            `${field.label} must be at most ${parsed.data.maxLength} characters`,
          );
        }
      }
      if (field.required) {
        return s.min(1, `${field.label} is required`);
      }
      return s.optional().or(z.literal(""));
    }

    case "rich_text": {
      let s = z.string();
      const parsed = richTextFieldConfigSchema.safeParse(config);
      if (parsed.success && parsed.data.maxLength !== undefined) {
        s = s.max(
          parsed.data.maxLength,
          `${field.label} must be at most ${parsed.data.maxLength} characters`,
        );
      }
      if (field.required) {
        return s.min(1, `${field.label} is required`);
      }
      return s.optional().or(z.literal(""));
    }

    case "email": {
      const s = z
        .string()
        .email(`${field.label} must be a valid email address`);
      if (field.required) {
        return s.min(1, `${field.label} is required`);
      }
      return s.optional().or(z.literal(""));
    }

    case "url": {
      const s = z.string().url(`${field.label} must be a valid URL`);
      if (field.required) {
        return s.min(1, `${field.label} is required`);
      }
      return s.optional().or(z.literal(""));
    }

    case "date": {
      const s = z
        .string()
        .date(`${field.label} must be a valid date (YYYY-MM-DD)`);
      if (field.required) {
        return s.min(1, `${field.label} is required`);
      }
      return s.optional().or(z.literal(""));
    }

    case "number": {
      let s = z.coerce.number({
        error: `${field.label} must be a number`,
      });
      const parsed = numberFieldConfigSchema.safeParse(config);
      if (parsed.success) {
        if (parsed.data.min !== undefined) {
          s = s.min(
            parsed.data.min,
            `${field.label} must be at least ${parsed.data.min}`,
          );
        }
        if (parsed.data.max !== undefined) {
          s = s.max(
            parsed.data.max,
            `${field.label} must be at most ${parsed.data.max}`,
          );
        }
      }
      if (field.required) {
        return s;
      }
      return z.preprocess(
        (val) => (val === "" || val === undefined ? undefined : val),
        s.optional(),
      );
    }

    case "select":
    case "radio": {
      const parsed = selectFieldConfigSchema.safeParse(config);
      if (parsed.success && parsed.data.options.length > 0) {
        const values = parsed.data.options.map((o) => o.value);
        const s = z.enum(values as [string, ...string[]]);
        if (field.required) {
          return s;
        }
        return s.optional().or(z.literal(""));
      }
      return field.required
        ? z.string().min(1, `${field.label} is required`)
        : z.string().optional().or(z.literal(""));
    }

    case "multi_select":
    case "checkbox_group": {
      const parsed = selectFieldConfigSchema.safeParse(config);
      const validValues = parsed.success
        ? parsed.data.options.map((o) => o.value)
        : [];
      const s = z
        .array(z.string())
        .refine(
          (arr) =>
            validValues.length === 0 ||
            arr.every((v) => validValues.includes(v)),
          { message: `${field.label} contains invalid option(s)` },
        );
      if (field.required) {
        return s.refine((arr) => arr.length > 0, {
          message: `${field.label} is required`,
        });
      }
      return s.optional();
    }

    case "checkbox": {
      return z.boolean();
    }

    case "file_upload":
      return null;

    default: {
      if (
        PRESENTATIONAL_FIELD_TYPES.includes(
          field.fieldType as (typeof PRESENTATIONAL_FIELD_TYPES)[number],
        )
      ) {
        return null;
      }
      return field.required
        ? z.string().min(1, `${field.label} is required`)
        : z.string().optional().or(z.literal(""));
    }
  }
}

function getDefaultValue(field: FormFieldForRenderer): unknown {
  switch (field.fieldType) {
    case "checkbox":
      return false;
    case "multi_select":
    case "checkbox_group":
      return [];
    case "number":
      return undefined;
    default:
      return "";
  }
}

/**
 * Build a Zod schema and default values from a list of form field definitions.
 * Presentational fields and file_upload are skipped.
 */
export function buildFormFieldsSchema(
  fields: FormFieldForRenderer[],
): FormSchemaResult {
  const shape: Record<string, z.ZodTypeAny> = {};
  const defaultValues: Record<string, unknown> = {};

  for (const field of fields) {
    const schema = buildFieldSchema(field);
    if (schema === null) continue;

    shape[field.fieldKey] = schema;
    defaultValues[field.fieldKey] = getDefaultValue(field);
  }

  return {
    schema: z.object(shape),
    defaultValues,
  };
}
