"use client";

import { useState, useCallback } from "react";
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
import { Plus, Trash2, ArrowRight } from "lucide-react";
import {
  PRESENTATIONAL_FIELD_TYPES,
  type PageBranchingRule,
  type RuleComparator,
  type SingleCondition,
} from "@colophony/types";

/** Loose page type that accepts both Date and string for timestamp fields (tRPC v11 serialization). */
interface PageData {
  id: string;
  title: string;
  description: string | null;
  sortOrder: number;
  branchingRules: PageBranchingRule[] | null;
}
import type { FormFieldForRenderer } from "@/components/submissions/form-renderer/build-form-schema";

const COMPARATOR_LABELS: Record<string, string> = {
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

const COMPARATORS_BY_TYPE: Record<string, RuleComparator[]> = {
  text: ["eq", "neq", "contains", "not_contains", "is_empty", "is_not_empty"],
  textarea: [
    "eq",
    "neq",
    "contains",
    "not_contains",
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

const UNARY_COMPARATORS: string[] = ["is_empty", "is_not_empty"];

interface PageBranchingEditorProps {
  page: PageData;
  allPages: PageData[];
  allFields: FormFieldForRenderer[];
  onUpdate: (branchingRules: PageBranchingRule[] | null) => void;
  isSaving: boolean;
}

function getComparators(fieldType: string): RuleComparator[] {
  return COMPARATORS_BY_TYPE[fieldType] ?? COMPARATORS_BY_TYPE.text;
}

function getFieldOptions(
  field: FormFieldForRenderer,
): Array<{ label: string; value: string }> | null {
  const config = field.config as Record<string, unknown> | null;
  const options = config?.options as
    | Array<{ label: string; value: string }>
    | undefined;
  if (options && options.length > 0) return options;
  return null;
}

export function PageBranchingEditor({
  page,
  allPages,
  allFields,
  onUpdate,
  isSaving,
}: PageBranchingEditorProps) {
  const [localRules, setLocalRules] = useState<PageBranchingRule[] | null>(
    page.branchingRules,
  );
  const [enabled, setEnabled] = useState(
    page.branchingRules !== null && page.branchingRules.length > 0,
  );

  // Sync from props when page changes (render-time state adjustment)
  const [prevPageId, setPrevPageId] = useState(page.id);
  if (prevPageId !== page.id) {
    setPrevPageId(page.id);
    setLocalRules(page.branchingRules);
    setEnabled(page.branchingRules !== null && page.branchingRules.length > 0);
  }

  const availableFields = allFields.filter(
    (f) =>
      !PRESENTATIONAL_FIELD_TYPES.includes(
        f.fieldType as (typeof PRESENTATIONAL_FIELD_TYPES)[number],
      ) && f.fieldType !== "file_upload",
  );

  const targetPages = allPages
    .filter((p) => p.id !== page.id)
    .sort((a, b) => a.sortOrder - b.sortOrder);

  const commit = useCallback(
    (rules: PageBranchingRule[] | null) => {
      setLocalRules(rules);
      onUpdate(rules);
    },
    [onUpdate],
  );

  function handleToggle(checked: boolean) {
    setEnabled(checked);
    if (checked) {
      if (!localRules || localRules.length === 0) {
        const firstField = availableFields[0];
        const firstTarget = targetPages[0];
        if (!firstField || !firstTarget) return;
        commit([
          {
            targetPageId: firstTarget.id,
            condition: {
              operator: "AND",
              rules: [
                { field: firstField.fieldKey, comparator: "eq", value: "" },
              ],
            },
          },
        ]);
      }
    } else {
      commit(null);
    }
  }

  function updateRule(index: number, rule: PageBranchingRule) {
    const newRules = [...(localRules ?? [])];
    newRules[index] = rule;
    commit(newRules);
  }

  function addRule() {
    const firstField = availableFields[0];
    const firstTarget = targetPages[0];
    if (!firstField || !firstTarget) return;
    commit([
      ...(localRules ?? []),
      {
        targetPageId: firstTarget.id,
        condition: {
          operator: "AND",
          rules: [{ field: firstField.fieldKey, comparator: "eq", value: "" }],
        },
      },
    ]);
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

  const canEnable = availableFields.length > 0 && targetPages.length > 0;

  return (
    <div className="p-4 space-y-4">
      <div>
        <h3 className="text-sm font-semibold">Page: {page.title}</h3>
        <p className="text-xs text-muted-foreground mt-1">
          Configure branching rules to control which page appears after this
          one.
        </p>
      </div>

      <Separator />

      <div className="flex items-center justify-between">
        <Label className="text-xs">Page Branching</Label>
        <Switch
          checked={enabled}
          onCheckedChange={handleToggle}
          disabled={!canEnable || isSaving}
        />
      </div>

      {!canEnable && !enabled && (
        <p className="text-xs text-muted-foreground">
          {targetPages.length === 0
            ? "Add more pages to use page branching."
            : "Add fields to the form to use page branching."}
        </p>
      )}

      {enabled && localRules && localRules.length > 0 && (
        <div className="space-y-3">
          {localRules.map((rule, ruleIdx) => (
            <PageBranchRuleEditor
              key={ruleIdx}
              rule={rule}
              availableFields={availableFields}
              targetPages={targetPages}
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
            disabled={isSaving}
          >
            <Plus className="mr-1 h-3 w-3" />
            Add Rule
          </Button>
        </div>
      )}

      <div className="rounded-lg bg-muted px-3 py-2 text-xs text-muted-foreground">
        <ArrowRight className="inline h-3 w-3 mr-1" />
        Default: next page in order
      </div>
    </div>
  );
}

function PageBranchRuleEditor({
  rule,
  availableFields,
  targetPages,
  onUpdate,
  onRemove,
  canRemove,
}: {
  rule: PageBranchingRule;
  availableFields: FormFieldForRenderer[];
  targetPages: PageData[];
  onUpdate: (rule: PageBranchingRule) => void;
  onRemove: () => void;
  canRemove: boolean;
}) {
  function updateTargetPage(targetPageId: string) {
    onUpdate({ ...rule, targetPageId });
  }

  function updateConditionRule(index: number, cond: SingleCondition) {
    const newRules = [...rule.condition.rules];
    newRules[index] = cond;
    onUpdate({
      ...rule,
      condition: { ...rule.condition, rules: newRules },
    });
  }

  function addCondition() {
    const firstField = availableFields[0];
    if (!firstField) return;
    onUpdate({
      ...rule,
      condition: {
        ...rule.condition,
        rules: [
          ...rule.condition.rules,
          {
            field: firstField.fieldKey,
            comparator: "eq" as RuleComparator,
            value: "",
          },
        ],
      },
    });
  }

  function removeCondition(index: number) {
    const newRules = rule.condition.rules.filter((_, i) => i !== index);
    if (newRules.length === 0) return;
    onUpdate({
      ...rule,
      condition: { ...rule.condition, rules: newRules },
    });
  }

  function toggleOperator() {
    onUpdate({
      ...rule,
      condition: {
        ...rule.condition,
        operator: rule.condition.operator === "AND" ? "OR" : "AND",
      },
    });
  }

  const targetPage = targetPages.find((p) => p.id === rule.targetPageId);

  return (
    <div className="rounded-lg border p-3 space-y-2">
      <div className="flex items-center gap-2">
        <span className="text-xs font-medium">If</span>
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
                className="text-[10px]"
                onClick={toggleOperator}
              >
                <Badge variant="secondary" className="text-[10px]">
                  {rule.condition.operator}
                </Badge>
              </button>
              <Separator className="flex-1" />
            </div>
          )}
          <PageConditionEditor
            condition={cond}
            availableFields={availableFields}
            onUpdate={(updated) => updateConditionRule(condIdx, updated)}
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

      <Separator />

      <div className="flex items-center gap-2">
        <ArrowRight className="h-3 w-3 text-muted-foreground" />
        <span className="text-xs text-muted-foreground">Go to:</span>
        <Select value={rule.targetPageId} onValueChange={updateTargetPage}>
          <SelectTrigger className="flex-1 h-7 text-xs">
            <SelectValue>{targetPage?.title ?? "Select page"}</SelectValue>
          </SelectTrigger>
          <SelectContent>
            {targetPages.map((p) => (
              <SelectItem key={p.id} value={p.id}>
                {p.title}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    </div>
  );
}

function PageConditionEditor({
  condition,
  availableFields,
  onUpdate,
  onRemove,
  canRemove,
}: {
  condition: SingleCondition;
  availableFields: FormFieldForRenderer[];
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
    } else {
      onUpdate({
        ...condition,
        comparator,
        value: typeof condition.value === "string" ? condition.value : "",
      });
    }
  }

  return (
    <div className="flex items-start gap-1.5 flex-wrap">
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
              {COMPARATOR_LABELS[c] ?? c}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {!isUnary && (
        <>
          {fieldOptions &&
          (condition.comparator === "eq" || condition.comparator === "neq") ? (
            <Select
              value={String(condition.value ?? "")}
              onValueChange={(v) => onUpdate({ ...condition, value: v })}
            >
              <SelectTrigger className="flex-1 h-7 text-xs min-w-[80px]">
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
              className="flex-1 h-7 text-xs min-w-[80px]"
              placeholder="Value"
              value={String(condition.value ?? "")}
              onChange={(e) =>
                onUpdate({
                  ...condition,
                  value:
                    fieldType === "number" && e.target.value
                      ? Number(e.target.value)
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
          <Trash2 className="h-3 w-3" />
        </Button>
      )}
    </div>
  );
}
