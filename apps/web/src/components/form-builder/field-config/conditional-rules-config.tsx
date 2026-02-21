"use client";

import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { Plus, Trash2, X } from "lucide-react";
import type {
  ConditionalRule,
  RuleEffect,
  RuleComparator,
  SingleCondition,
} from "@colophony/types";
import { PRESENTATIONAL_FIELD_TYPES } from "@colophony/types";

// ---------------------------------------------------------------------------
// Comparator filtering by field type
// ---------------------------------------------------------------------------

const COMPARATORS_BY_TYPE: Record<string, RuleComparator[]> = {
  text: [
    "eq",
    "neq",
    "contains",
    "not_contains",
    "starts_with",
    "ends_with",
    "is_empty",
    "is_not_empty",
  ],
  textarea: [
    "eq",
    "neq",
    "contains",
    "not_contains",
    "starts_with",
    "ends_with",
    "is_empty",
    "is_not_empty",
  ],
  rich_text: [
    "eq",
    "neq",
    "contains",
    "not_contains",
    "starts_with",
    "ends_with",
    "is_empty",
    "is_not_empty",
  ],
  email: [
    "eq",
    "neq",
    "contains",
    "not_contains",
    "starts_with",
    "ends_with",
    "is_empty",
    "is_not_empty",
  ],
  url: [
    "eq",
    "neq",
    "contains",
    "not_contains",
    "starts_with",
    "ends_with",
    "is_empty",
    "is_not_empty",
  ],
  number: ["eq", "neq", "gt", "lt", "gte", "lte", "is_empty", "is_not_empty"],
  select: ["eq", "neq", "in", "not_in", "is_empty", "is_not_empty"],
  radio: ["eq", "neq", "in", "not_in", "is_empty", "is_not_empty"],
  multi_select: ["contains", "not_contains", "is_empty", "is_not_empty"],
  checkbox_group: ["contains", "not_contains", "is_empty", "is_not_empty"],
  checkbox: ["eq"],
  date: ["eq", "neq", "gt", "lt", "gte", "lte", "is_empty", "is_not_empty"],
};

const COMPARATOR_LABELS: Record<RuleComparator, string> = {
  eq: "equals",
  neq: "not equals",
  gt: "greater than",
  lt: "less than",
  gte: "at least",
  lte: "at most",
  contains: "contains",
  not_contains: "does not contain",
  starts_with: "starts with",
  ends_with: "ends with",
  is_empty: "is empty",
  is_not_empty: "is not empty",
  in: "is one of",
  not_in: "is not one of",
};

const EFFECT_LABELS: Record<RuleEffect, string> = {
  SHOW: "Show",
  HIDE: "Hide",
  REQUIRE: "Require",
};

const UNARY_COMPARATORS: RuleComparator[] = ["is_empty", "is_not_empty"];

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface FieldInfo {
  fieldKey: string;
  fieldType: string;
  label: string;
  config: Record<string, unknown> | null;
}

interface ConditionalRulesConfigProps {
  rules: ConditionalRule[] | null;
  onChange: (rules: ConditionalRule[] | null) => void;
  fields: FieldInfo[];
  currentFieldKey: string;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function getComparators(fieldType: string): RuleComparator[] {
  return COMPARATORS_BY_TYPE[fieldType] ?? COMPARATORS_BY_TYPE.text;
}

function getFieldOptions(
  field: FieldInfo,
): Array<{ label: string; value: string }> | null {
  const config = field.config as Record<string, unknown> | null;
  const options = config?.options as
    | Array<{ label: string; value: string }>
    | undefined;
  if (options && options.length > 0) return options;
  return null;
}

function makeEmptyCondition(availableFields: FieldInfo[]): SingleCondition {
  const firstField = availableFields[0];
  return {
    field: firstField?.fieldKey ?? "",
    comparator: "eq",
    value: "",
  };
}

function makeEmptyRule(availableFields: FieldInfo[]): ConditionalRule {
  return {
    effect: "SHOW",
    condition: {
      operator: "AND",
      rules: [makeEmptyCondition(availableFields)],
    },
  };
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function ConditionalRulesConfig({
  rules,
  onChange,
  fields,
  currentFieldKey,
}: ConditionalRulesConfigProps) {
  // Local state for responsive editing — synced from props on field change
  const [localRules, setLocalRules] = useState<ConditionalRule[] | null>(rules);
  const [enabled, setEnabled] = useState(rules !== null && rules.length > 0);

  // Sync from props when the selected field changes (currentFieldKey drives this)
  useEffect(() => {
    setLocalRules(rules);
    setEnabled(rules !== null && rules.length > 0);
  }, [currentFieldKey]); // eslint-disable-line react-hooks/exhaustive-deps

  const availableFields = fields.filter(
    (f) =>
      f.fieldKey !== currentFieldKey &&
      !PRESENTATIONAL_FIELD_TYPES.includes(
        f.fieldType as (typeof PRESENTATIONAL_FIELD_TYPES)[number],
      ),
  );

  const commit = useCallback(
    (newRules: ConditionalRule[] | null) => {
      setLocalRules(newRules);
      onChange(newRules);
    },
    [onChange],
  );

  function handleToggle(checked: boolean) {
    setEnabled(checked);
    if (checked) {
      if (!localRules || localRules.length === 0) {
        commit([makeEmptyRule(availableFields)]);
      }
    } else {
      commit(null);
    }
  }

  function updateRule(index: number, updatedRule: ConditionalRule) {
    const newRules = [...(localRules ?? [])];
    newRules[index] = updatedRule;
    commit(newRules);
  }

  function addRule() {
    commit([...(localRules ?? []), makeEmptyRule(availableFields)]);
  }

  function removeRule(index: number) {
    const newRules = (localRules ?? []).filter((_, i) => i !== index);
    if (newRules.length === 0) {
      setEnabled(false);
      commit(null);
    } else {
      commit(newRules);
    }
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <Label className="text-xs">Conditional Logic</Label>
        <Switch
          checked={enabled}
          onCheckedChange={handleToggle}
          disabled={!enabled && availableFields.length === 0}
        />
      </div>

      {!enabled && availableFields.length === 0 && (
        <p className="text-xs text-muted-foreground">
          Add more fields to the form to use conditional logic.
        </p>
      )}

      {enabled && localRules && localRules.length > 0 && (
        <div className="space-y-3">
          {localRules.map((rule, ruleIdx) => (
            <RuleEditor
              key={ruleIdx}
              rule={rule}
              availableFields={availableFields}
              onUpdate={(updated) => updateRule(ruleIdx, updated)}
              onRemove={() => removeRule(ruleIdx)}
              canRemove={localRules.length > 1}
            />
          ))}

          <Button
            type="button"
            variant="outline"
            size="sm"
            className="w-full"
            onClick={addRule}
          >
            <Plus className="mr-1 h-3 w-3" />
            Add Rule
          </Button>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Rule editor
// ---------------------------------------------------------------------------

function RuleEditor({
  rule,
  availableFields,
  onUpdate,
  onRemove,
  canRemove,
}: {
  rule: ConditionalRule;
  availableFields: FieldInfo[];
  onUpdate: (rule: ConditionalRule) => void;
  onRemove: () => void;
  canRemove: boolean;
}) {
  function updateEffect(effect: RuleEffect) {
    onUpdate({ ...rule, effect });
  }

  function updateOperator(operator: "AND" | "OR") {
    onUpdate({
      ...rule,
      condition: { ...rule.condition, operator },
    });
  }

  function updateCondition(index: number, condition: SingleCondition) {
    const newRules = [...rule.condition.rules];
    newRules[index] = condition;
    onUpdate({
      ...rule,
      condition: { ...rule.condition, rules: newRules },
    });
  }

  function addCondition() {
    onUpdate({
      ...rule,
      condition: {
        ...rule.condition,
        rules: [...rule.condition.rules, makeEmptyCondition(availableFields)],
      },
    });
  }

  function removeCondition(index: number) {
    const newRules = rule.condition.rules.filter((_, i) => i !== index);
    if (newRules.length === 0) return; // must have at least 1
    onUpdate({
      ...rule,
      condition: { ...rule.condition, rules: newRules },
    });
  }

  return (
    <div className="rounded-lg border p-3 space-y-2">
      <div className="flex items-center gap-2">
        <Select
          value={rule.effect}
          onValueChange={(v) => updateEffect(v as RuleEffect)}
        >
          <SelectTrigger className="w-24 h-7 text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {(["SHOW", "HIDE", "REQUIRE"] as RuleEffect[]).map((e) => (
              <SelectItem key={e} value={e}>
                {EFFECT_LABELS[e]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <span className="text-xs text-muted-foreground">this field when:</span>
        <div className="flex-1" />
        {canRemove && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-6 w-6 p-0"
            onClick={onRemove}
          >
            <Trash2 className="h-3 w-3" />
          </Button>
        )}
      </div>

      {rule.condition.rules.map((cond, condIdx) => (
        <div key={condIdx}>
          {condIdx > 0 && (
            <div className="flex items-center gap-2 py-1">
              <Separator className="flex-1" />
              <button
                type="button"
                className="text-[10px] font-medium px-1.5 py-0.5 rounded-sm hover:bg-muted"
                onClick={() =>
                  updateOperator(
                    rule.condition.operator === "AND" ? "OR" : "AND",
                  )
                }
              >
                <Badge variant="secondary" className="text-[10px]">
                  {rule.condition.operator}
                </Badge>
              </button>
              <Separator className="flex-1" />
            </div>
          )}
          <ConditionEditor
            condition={cond}
            availableFields={availableFields}
            onUpdate={(updated) => updateCondition(condIdx, updated)}
            onRemove={() => removeCondition(condIdx)}
            canRemove={rule.condition.rules.length > 1}
          />
        </div>
      ))}

      <Button
        type="button"
        variant="ghost"
        size="sm"
        className="text-xs h-6"
        onClick={addCondition}
      >
        <Plus className="mr-1 h-3 w-3" />
        Add condition
      </Button>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Condition editor
// ---------------------------------------------------------------------------

function ConditionEditor({
  condition,
  availableFields,
  onUpdate,
  onRemove,
  canRemove,
}: {
  condition: SingleCondition;
  availableFields: FieldInfo[];
  onUpdate: (condition: SingleCondition) => void;
  onRemove: () => void;
  canRemove: boolean;
}) {
  const selectedField = availableFields.find(
    (f) => f.fieldKey === condition.field,
  );
  const fieldType = selectedField?.fieldType ?? "text";
  const comparators = getComparators(fieldType);
  const isUnary = UNARY_COMPARATORS.includes(condition.comparator);
  const fieldOptions = selectedField ? getFieldOptions(selectedField) : null;
  const isSelectComparator =
    condition.comparator === "in" || condition.comparator === "not_in";

  function handleFieldChange(fieldKey: string) {
    const newField = availableFields.find((f) => f.fieldKey === fieldKey);
    const newType = newField?.fieldType ?? "text";
    const newComparators = getComparators(newType);
    const comparator = newComparators.includes(condition.comparator)
      ? condition.comparator
      : newComparators[0];
    onUpdate({
      field: fieldKey,
      comparator,
      value: UNARY_COMPARATORS.includes(comparator) ? undefined : "",
    });
  }

  function handleComparatorChange(comparator: RuleComparator) {
    if (UNARY_COMPARATORS.includes(comparator)) {
      onUpdate({ ...condition, comparator, value: undefined });
    } else if (comparator === "in" || comparator === "not_in") {
      onUpdate({
        ...condition,
        comparator,
        value: Array.isArray(condition.value) ? condition.value : [],
      });
    } else {
      onUpdate({
        ...condition,
        comparator,
        value: typeof condition.value === "string" ? condition.value : "",
      });
    }
  }

  return (
    <div className="flex items-start gap-1.5">
      {/* Field selector */}
      <Select value={condition.field} onValueChange={handleFieldChange}>
        <SelectTrigger className="w-28 h-7 text-xs">
          <SelectValue placeholder="Field" />
        </SelectTrigger>
        <SelectContent>
          {availableFields.map((f) => (
            <SelectItem key={f.fieldKey} value={f.fieldKey}>
              {f.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {/* Comparator selector */}
      <Select
        value={condition.comparator}
        onValueChange={(v) => handleComparatorChange(v as RuleComparator)}
      >
        <SelectTrigger className="w-28 h-7 text-xs">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {comparators.map((c) => (
            <SelectItem key={c} value={c}>
              {COMPARATOR_LABELS[c]}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {/* Value input */}
      {!isUnary && (
        <>
          {fieldType === "checkbox" ? (
            <Select
              value={String(condition.value ?? "true")}
              onValueChange={(v) => onUpdate({ ...condition, value: v })}
            >
              <SelectTrigger className="w-20 h-7 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="true">Yes</SelectItem>
                <SelectItem value="false">No</SelectItem>
              </SelectContent>
            </Select>
          ) : isSelectComparator && fieldOptions ? (
            <MultiValueSelect
              options={fieldOptions}
              value={Array.isArray(condition.value) ? condition.value : []}
              onChange={(vals) => onUpdate({ ...condition, value: vals })}
            />
          ) : fieldOptions &&
            (condition.comparator === "eq" ||
              condition.comparator === "neq") ? (
            <Select
              value={String(condition.value ?? "")}
              onValueChange={(v) => onUpdate({ ...condition, value: v })}
            >
              <SelectTrigger className="flex-1 h-7 text-xs">
                <SelectValue placeholder="Value" />
              </SelectTrigger>
              <SelectContent>
                {fieldOptions.map((o) => (
                  <SelectItem key={o.value} value={o.value}>
                    {o.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          ) : (
            <Input
              type={fieldType === "number" ? "number" : "text"}
              className="flex-1 h-7 text-xs"
              placeholder="Value"
              value={String(condition.value ?? "")}
              onChange={(e) =>
                onUpdate({
                  ...condition,
                  value:
                    fieldType === "number"
                      ? e.target.value
                        ? Number(e.target.value)
                        : ""
                      : e.target.value,
                })
              }
            />
          )}
        </>
      )}

      {canRemove && (
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-7 w-7 p-0 shrink-0"
          onClick={onRemove}
        >
          <X className="h-3 w-3" />
        </Button>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Multi-value select (for in/not_in comparators)
// ---------------------------------------------------------------------------

function MultiValueSelect({
  options,
  value,
  onChange,
}: {
  options: Array<{ label: string; value: string }>;
  value: string[];
  onChange: (value: string[]) => void;
}) {
  function toggle(optValue: string) {
    if (value.includes(optValue)) {
      onChange(value.filter((v) => v !== optValue));
    } else {
      onChange([...value, optValue]);
    }
  }

  return (
    <div className="flex-1 flex flex-wrap gap-1">
      {options.map((opt) => (
        <Badge
          key={opt.value}
          variant={value.includes(opt.value) ? "default" : "outline"}
          className="cursor-pointer text-[10px] py-0"
          onClick={() => toggle(opt.value)}
        >
          {opt.label}
        </Badge>
      ))}
    </div>
  );
}
