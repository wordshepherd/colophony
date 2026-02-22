import { useMemo } from "react";
import { evaluateFieldVisibilityWithBranching } from "@colophony/types";
import type { ConditionalRule } from "@colophony/types";

interface FieldWithRules {
  fieldKey: string;
  branchId?: string | null;
  config?: Record<string, unknown> | null;
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
        evaluateFieldVisibilityWithBranching(
          {
            branchId: field.branchId ?? null,
            conditionalRules: field.conditionalRules,
          },
          fields.map((f) => ({
            fieldKey: f.fieldKey,
            branchId: f.branchId ?? null,
            config: f.config ?? null,
          })),
          formValues,
        ),
      );
    }
    return result;
  }, [fields, formValues]);
}
