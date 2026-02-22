"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { TextConfig } from "./field-config/text-config";
import { NumberConfig } from "./field-config/number-config";
import { SelectConfig } from "./field-config/select-config";
import { FileUploadConfig } from "./field-config/file-upload-config";
import { BranchingConfig } from "./field-config/branching-config";
import { ConditionalRulesConfig } from "./field-config/conditional-rules-config";
import { FIELD_TYPE_META } from "./field-type-meta";
import { Loader2, Check } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  extractBranchingConfig,
  type FormFieldType,
  type UpdateFormFieldInput,
  type ConditionalRule,
} from "@colophony/types";

interface PropertiesField {
  id: string;
  fieldKey: string;
  fieldType: FormFieldType;
  label: string;
  description: string | null;
  placeholder: string | null;
  required: boolean;
  config: Record<string, unknown> | null;
  conditionalRules: ConditionalRule[] | null;
  branchId: string | null;
}

interface AllFieldInfo {
  fieldKey: string;
  fieldType: string;
  label: string;
  config: Record<string, unknown> | null;
}

interface FieldPropertiesPanelProps {
  field: PropertiesField;
  allFields: AllFieldInfo[];
  onUpdate: (fieldId: string, data: UpdateFormFieldInput) => void;
  isSaving: boolean;
}

type SaveStatus = "idle" | "saving" | "saved";

const TEXT_TYPES = ["text", "textarea", "rich_text", "email", "url"] as const;
const SELECT_TYPES = [
  "select",
  "multi_select",
  "radio",
  "checkbox_group",
] as const;

export function FieldPropertiesPanel({
  field,
  allFields,
  onUpdate,
  isSaving,
}: FieldPropertiesPanelProps) {
  const [label, setLabel] = useState(field.label);
  const [description, setDescription] = useState(field.description ?? "");
  const [placeholder, setPlaceholder] = useState(field.placeholder ?? "");
  const [required, setRequired] = useState(field.required);
  const [config, setConfig] = useState<Record<string, unknown>>(
    field.config ?? {},
  );
  const [saveStatus, setSaveStatus] = useState<SaveStatus>("idle");
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const fieldIdRef = useRef(field.id);

  // Reset local state when selected field changes
  useEffect(() => {
    if (fieldIdRef.current !== field.id) {
      fieldIdRef.current = field.id;
      setLabel(field.label);
      setDescription(field.description ?? "");
      setPlaceholder(field.placeholder ?? "");
      setRequired(field.required);
      setConfig(field.config ?? {});
      setSaveStatus("idle");
    }
  }, [field]);

  const debouncedSave = useCallback(
    (data: UpdateFormFieldInput) => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      setSaveStatus("saving");
      debounceRef.current = setTimeout(() => {
        onUpdate(field.id, data);
      }, 500);
    },
    [field.id, onUpdate],
  );

  // Track save completion
  useEffect(() => {
    if (!isSaving && saveStatus === "saving") {
      setSaveStatus("saved");
      const timer = setTimeout(() => setSaveStatus("idle"), 2000);
      return () => clearTimeout(timer);
    }
  }, [isSaving, saveStatus]);

  // Cleanup debounce on unmount
  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, []);

  function handleLabelChange(value: string) {
    setLabel(value);
    debouncedSave({ label: value });
  }

  function handleDescriptionChange(value: string) {
    setDescription(value);
    debouncedSave({ description: value });
  }

  function handlePlaceholderChange(value: string) {
    setPlaceholder(value);
    debouncedSave({ placeholder: value });
  }

  function handleRequiredChange(checked: boolean) {
    setRequired(checked);
    debouncedSave({ required: checked });
  }

  function handleConfigChange(newConfig: Record<string, unknown>) {
    setConfig(newConfig);
    debouncedSave({ config: newConfig });
  }

  function handleConditionalRulesChange(newRules: ConditionalRule[] | null) {
    debouncedSave({ conditionalRules: newRules });
  }

  function handleBranchIdChange(branchId: string | null) {
    debouncedSave({ branchId });
  }

  // Collect available branches from all fields that have branching enabled
  const availableBranches: Array<{
    branchId: string;
    branchName: string;
    sourceLabel: string;
  }> = [];
  for (const f of allFields) {
    if (f.fieldKey === field.fieldKey) continue;
    const bc = extractBranchingConfig(f.config);
    if (!bc?.enabled) continue;
    for (const branch of bc.branches) {
      availableBranches.push({
        branchId: branch.id,
        branchName: branch.name,
        sourceLabel: f.label,
      });
    }
  }

  const meta = FIELD_TYPE_META[field.fieldType];

  function renderTypeConfig() {
    if ((TEXT_TYPES as readonly string[]).includes(field.fieldType)) {
      return <TextConfig config={config} onChange={handleConfigChange} />;
    }
    if (field.fieldType === "number") {
      return <NumberConfig config={config} onChange={handleConfigChange} />;
    }
    if ((SELECT_TYPES as readonly string[]).includes(field.fieldType)) {
      return (
        <>
          <SelectConfig config={config} onChange={handleConfigChange} />
          <BranchingConfig
            config={config}
            onChange={handleConfigChange}
            fieldId={field.id}
          />
        </>
      );
    }
    if (field.fieldType === "file_upload") {
      return <FileUploadConfig config={config} onChange={handleConfigChange} />;
    }
    return null;
  }

  return (
    <ScrollArea className="h-full">
      <div className="p-4 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold text-sm">Field Properties</h2>
          <div className="flex items-center gap-1 text-xs text-muted-foreground">
            {saveStatus === "saving" && (
              <>
                <Loader2 className="h-3 w-3 animate-spin" />
                Saving...
              </>
            )}
            {saveStatus === "saved" && (
              <>
                <Check className="h-3 w-3" />
                Saved
              </>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <meta.icon className="h-4 w-4" />
          {meta.label}
        </div>

        <Separator />

        {/* Common fields */}
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="field-label" className="text-xs">
              Label
            </Label>
            <Input
              id="field-label"
              value={label}
              onChange={(e) => handleLabelChange(e.target.value)}
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="field-description" className="text-xs">
              Help Text
            </Label>
            <Textarea
              id="field-description"
              value={description}
              onChange={(e) => handleDescriptionChange(e.target.value)}
              rows={2}
              placeholder="Optional help text for submitters"
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="field-placeholder" className="text-xs">
              Placeholder
            </Label>
            <Input
              id="field-placeholder"
              value={placeholder}
              onChange={(e) => handlePlaceholderChange(e.target.value)}
              placeholder="Optional placeholder text"
            />
          </div>

          <div className="flex items-center gap-2">
            <Checkbox
              id="field-required"
              checked={required}
              onCheckedChange={(checked) =>
                handleRequiredChange(checked === true)
              }
            />
            <Label htmlFor="field-required" className="text-xs cursor-pointer">
              Required
            </Label>
          </div>

          {/* Branch assignment */}
          {availableBranches.length > 0 && (
            <div className="space-y-1.5">
              <Label className="text-xs">Branch</Label>
              <Select
                value={field.branchId ?? "__always__"}
                onValueChange={(v) =>
                  handleBranchIdChange(v === "__always__" ? null : v)
                }
              >
                <SelectTrigger className="h-8 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__always__">Always visible</SelectItem>
                  {availableBranches.map((ab) => (
                    <SelectItem key={ab.branchId} value={ab.branchId}>
                      {ab.sourceLabel} &rarr; {ab.branchName}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
        </div>

        {/* Type-specific config */}
        {renderTypeConfig() && (
          <>
            <Separator />
            <div className="space-y-3">
              <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                Type Settings
              </h3>
              {renderTypeConfig()}
            </div>
          </>
        )}

        {/* Conditional logic */}
        <Separator />
        <div className="space-y-3">
          <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
            Conditions
          </h3>
          <ConditionalRulesConfig
            rules={field.conditionalRules}
            onChange={handleConditionalRulesChange}
            fields={allFields}
            currentFieldKey={field.fieldKey}
          />
        </div>
      </div>
    </ScrollArea>
  );
}
