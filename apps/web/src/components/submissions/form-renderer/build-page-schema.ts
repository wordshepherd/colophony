import { PRESENTATIONAL_FIELD_TYPES } from "@colophony/types";
import type { FormFieldForRenderer } from "./build-form-schema";

/**
 * Returns react-hook-form field paths (e.g., "formData.bio_1") for all
 * validatable fields on a page. Used with form.trigger(paths) for per-page validation.
 */
export function getPageFieldPaths(
  pageFields: FormFieldForRenderer[],
): string[] {
  return pageFields
    .filter((field) => {
      if (
        PRESENTATIONAL_FIELD_TYPES.includes(
          field.fieldType as (typeof PRESENTATIONAL_FIELD_TYPES)[number],
        )
      ) {
        return false;
      }
      if (field.fieldType === "file_upload") return false;
      return true;
    })
    .map((field) => `formData.${field.fieldKey}`);
}
