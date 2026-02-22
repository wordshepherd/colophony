import { z } from "zod";

// ---------------------------------------------------------------------------
// Schemas
// ---------------------------------------------------------------------------

export const ruleComparatorSchema = z.enum([
  "eq",
  "neq",
  "gt",
  "lt",
  "gte",
  "lte",
  "contains",
  "not_contains",
  "starts_with",
  "ends_with",
  "is_empty",
  "is_not_empty",
  "in",
  "not_in",
]);
export type RuleComparator = z.infer<typeof ruleComparatorSchema>;

export const ruleEffectSchema = z.enum(["SHOW", "HIDE", "REQUIRE"]);
export type RuleEffect = z.infer<typeof ruleEffectSchema>;

export const singleConditionSchema = z.object({
  field: z.string().min(1),
  comparator: ruleComparatorSchema,
  value: z
    .union([z.string(), z.number(), z.boolean(), z.array(z.string())])
    .optional(),
});
export type SingleCondition = z.infer<typeof singleConditionSchema>;

export const ruleConditionSchema = z.object({
  operator: z.enum(["AND", "OR"]),
  rules: z.array(singleConditionSchema).min(1),
});
export type RuleCondition = z.infer<typeof ruleConditionSchema>;

export const conditionalRuleSchema = z.object({
  effect: ruleEffectSchema,
  condition: ruleConditionSchema,
});
export type ConditionalRule = z.infer<typeof conditionalRuleSchema>;

export const conditionalRulesSchema = z.array(conditionalRuleSchema);
export type ConditionalRules = z.infer<typeof conditionalRulesSchema>;

// ---------------------------------------------------------------------------
// Evaluation engine
// ---------------------------------------------------------------------------

type FormValues = Record<string, unknown>;

function toComparableString(val: unknown): string {
  if (val === null || val === undefined) return "";
  return String(val);
}

function toComparableNumber(val: unknown): number | null {
  if (val === null || val === undefined || val === "") return null;
  const n = Number(val);
  return Number.isNaN(n) ? null : n;
}

function isEmpty(val: unknown): boolean {
  if (val === null || val === undefined) return true;
  if (typeof val === "string") return val === "";
  if (Array.isArray(val)) return val.length === 0;
  return false;
}

function evaluateSingleCondition(
  condition: SingleCondition,
  formValues: FormValues,
): boolean {
  const fieldValue = formValues[condition.field];
  const { comparator, value: conditionValue } = condition;

  switch (comparator) {
    case "is_empty":
      return isEmpty(fieldValue);
    case "is_not_empty":
      return !isEmpty(fieldValue);

    case "eq":
      return (
        toComparableString(fieldValue) === toComparableString(conditionValue)
      );
    case "neq":
      return (
        toComparableString(fieldValue) !== toComparableString(conditionValue)
      );

    case "gt": {
      const a = toComparableNumber(fieldValue);
      const b = toComparableNumber(conditionValue);
      return a !== null && b !== null && a > b;
    }
    case "lt": {
      const a = toComparableNumber(fieldValue);
      const b = toComparableNumber(conditionValue);
      return a !== null && b !== null && a < b;
    }
    case "gte": {
      const a = toComparableNumber(fieldValue);
      const b = toComparableNumber(conditionValue);
      return a !== null && b !== null && a >= b;
    }
    case "lte": {
      const a = toComparableNumber(fieldValue);
      const b = toComparableNumber(conditionValue);
      return a !== null && b !== null && a <= b;
    }

    case "contains":
      return toComparableString(fieldValue).includes(
        toComparableString(conditionValue),
      );
    case "not_contains":
      return !toComparableString(fieldValue).includes(
        toComparableString(conditionValue),
      );
    case "starts_with":
      return toComparableString(fieldValue).startsWith(
        toComparableString(conditionValue),
      );
    case "ends_with":
      return toComparableString(fieldValue).endsWith(
        toComparableString(conditionValue),
      );

    case "in": {
      const arr = Array.isArray(conditionValue) ? conditionValue : [];
      const fv = toComparableString(fieldValue);
      return arr.some((v) => toComparableString(v) === fv);
    }
    case "not_in": {
      const arr = Array.isArray(conditionValue) ? conditionValue : [];
      const fv = toComparableString(fieldValue);
      return !arr.some((v) => toComparableString(v) === fv);
    }

    default:
      return false;
  }
}

/**
 * Evaluate a rule condition (AND/OR group of single conditions) against form values.
 */
export function evaluateCondition(
  condition: RuleCondition,
  formValues: FormValues,
): boolean {
  const { operator, rules } = condition;

  if (operator === "AND") {
    return rules.every((rule) => evaluateSingleCondition(rule, formValues));
  }
  // OR
  return rules.some((rule) => evaluateSingleCondition(rule, formValues));
}

/**
 * Evaluate all conditional rules for a field and return its visibility and required state.
 *
 * - No rules → `{ visible: true, required: false }` (base required comes from field.required)
 * - SHOW rule: visible when condition is true
 * - HIDE rule: visible when condition is false (i.e., hidden when true)
 * - REQUIRE rule: conditionally required when condition is true
 * - Multiple SHOW/HIDE rules: last one wins
 * - REQUIRE is additive (any matching REQUIRE → required)
 */
export function evaluateFieldVisibility(
  rules: ConditionalRule[] | null | undefined,
  formValues: FormValues,
): { visible: boolean; required: boolean } {
  if (!rules || rules.length === 0) {
    return { visible: true, required: false };
  }

  let visible = true;
  let required = false;
  let hasVisibilityRule = false;

  for (const rule of rules) {
    const conditionMet = evaluateCondition(rule.condition, formValues);

    switch (rule.effect) {
      case "SHOW":
        hasVisibilityRule = true;
        visible = conditionMet;
        break;
      case "HIDE":
        hasVisibilityRule = true;
        visible = !conditionMet;
        break;
      case "REQUIRE":
        if (conditionMet) required = true;
        break;
    }
  }

  // If there are visibility rules and the field is hidden, it can't be required
  if (hasVisibilityRule && !visible) {
    required = false;
  }

  return { visible, required };
}

// ---------------------------------------------------------------------------
// Branching evaluation
// ---------------------------------------------------------------------------

/** A named branch definition — lives in a source field's config.branching. */
export const branchDefinitionSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1).max(100),
  optionValues: z.array(z.string().min(1)).min(1),
});

export type BranchDefinition = z.infer<typeof branchDefinitionSchema>;

/** Branching config embedded in a field's config object. */
export const branchingConfigSchema = z.object({
  enabled: z.boolean(),
  branches: z.array(branchDefinitionSchema).min(1),
});

export type BranchingConfig = z.infer<typeof branchingConfigSchema>;

/**
 * Extract and validate a branching config from a field's config object.
 * Returns null if not present or invalid.
 */
export function extractBranchingConfig(
  config: Record<string, unknown> | null,
): {
  enabled: boolean;
  branches: Array<{ id: string; name: string; optionValues: string[] }>;
} | null {
  if (!config || !config.branching) return null;
  const result = branchingConfigSchema.safeParse(config.branching);
  return result.success ? result.data : null;
}

interface BranchableField {
  fieldKey: string;
  branchId?: string | null;
  config: Record<string, unknown> | null;
}

/**
 * Check if a branch is active based on the source field's current value.
 * Supports sub-branching (source field in another branch) with circular reference guard.
 */
export function isBranchActive(
  branchId: string,
  fields: BranchableField[],
  formValues: FormValues,
  visited?: Set<string>,
): boolean {
  const seen = visited ?? new Set<string>();
  if (seen.has(branchId)) return false; // circular reference guard
  seen.add(branchId);

  // Find the source field whose config.branching.branches contains this branchId
  let sourceField: BranchableField | undefined;
  let matchedBranch:
    | { id: string; name: string; optionValues: string[] }
    | undefined;

  for (const field of fields) {
    const branching = extractBranchingConfig(field.config);
    if (!branching?.enabled) continue;
    const branch = branching.branches.find((b) => b.id === branchId);
    if (branch) {
      sourceField = field;
      matchedBranch = branch;
      break;
    }
  }

  if (!sourceField || !matchedBranch) return false;

  // If the source field itself is in a branch, check that branch is active (sub-branching)
  if (sourceField.branchId) {
    if (!isBranchActive(sourceField.branchId, fields, formValues, seen)) {
      return false;
    }
  }

  // Check if the source field's value matches this branch's optionValues
  const value = formValues[sourceField.fieldKey];
  if (value === undefined || value === null) return false;

  if (Array.isArray(value)) {
    // For multi-select/checkbox_group: branch is active if any selected value is in optionValues
    return value.some((v) => matchedBranch.optionValues.includes(String(v)));
  }

  return matchedBranch.optionValues.includes(String(value));
}

/**
 * Evaluate field visibility considering both branching and conditional rules.
 * Branch visibility is checked first — if the branch is inactive, the field is hidden
 * regardless of conditional rules.
 */
export function evaluateFieldVisibilityWithBranching(
  field: {
    branchId: string | null;
    conditionalRules: ConditionalRule[] | null | undefined;
  },
  allFields: BranchableField[],
  formValues: FormValues,
): { visible: boolean; required: boolean } {
  // Check branch visibility first
  if (field.branchId) {
    if (!isBranchActive(field.branchId, allFields, formValues)) {
      return { visible: false, required: false };
    }
  }

  // Delegate to conditional rules evaluation
  return evaluateFieldVisibility(field.conditionalRules, formValues);
}

/**
 * Extract the fieldKeys that a field's rules depend on.
 * Used for dependency graph optimization in the renderer.
 */
export function getFieldDependencies(
  rules: ConditionalRule[] | null | undefined,
): string[] {
  if (!rules || rules.length === 0) return [];

  const keys = new Set<string>();
  for (const rule of rules) {
    for (const condition of rule.condition.rules) {
      keys.add(condition.field);
    }
  }
  return Array.from(keys);
}
