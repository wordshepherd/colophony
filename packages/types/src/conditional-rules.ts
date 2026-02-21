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
