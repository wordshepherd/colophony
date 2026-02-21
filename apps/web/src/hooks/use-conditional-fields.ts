import { useMemo } from "react";
import { evaluateFieldVisibility } from "@colophony/types";
import type { ConditionalRule } from "@colophony/types";

interface FieldWithRules {
  fieldKey: string;
  conditionalRules?: ConditionalRule[] | null | undefined;
}

export function useConditionalFields(
  fields: FieldWithRules[],
  formValues: Record<string, unknown>,
): Map<string, { visible: boolean; required: boolean }> {
  return useMemo(() => {
    const result = new Map<string, { visible: boolean; required: boolean }>();
    for (const field of fields) {
      result.set(
        field.fieldKey,
        evaluateFieldVisibility(field.conditionalRules, formValues),
      );
    }
    return result;
  }, [fields, formValues]);
}
