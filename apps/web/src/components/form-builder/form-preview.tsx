"use client";

import { useState, useCallback } from "react";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { useConditionalFields } from "@/hooks/use-conditional-fields";
import type { FormFieldType, ConditionalRule } from "@colophony/types";

interface PreviewFieldData {
  id: string;
  fieldKey: string;
  fieldType: FormFieldType;
  label: string;
  description: string | null;
  placeholder: string | null;
  required: boolean;
  config: Record<string, unknown> | null;
  conditionalRules?: ConditionalRule[] | null;
  branchId?: string | null;
}

interface FormPreviewProps {
  form: {
    name: string;
    description: string | null;
    fields: PreviewFieldData[];
  };
}

function PreviewField({
  field,
  value,
  onChange,
}: {
  field: PreviewFieldData;
  value?: unknown;
  onChange?: (value: unknown) => void;
}) {
  const config = (field.config ?? {}) as Record<string, unknown>;
  const options =
    (config.options as Array<{ label: string; value: string }>) ?? [];

  switch (field.fieldType) {
    case "section_header":
      return (
        <div className="pt-4">
          <h3 className="text-lg font-semibold">{field.label}</h3>
          {field.description && (
            <p className="text-sm text-muted-foreground">{field.description}</p>
          )}
          <Separator className="mt-2" />
        </div>
      );

    case "info_text":
      return (
        <div className="rounded-lg bg-muted p-3 text-sm">
          {field.description ?? field.label}
        </div>
      );

    case "textarea":
    case "rich_text":
      return (
        <div className="space-y-1.5">
          <Label>
            {field.label}
            {field.required && <span className="text-destructive ml-1">*</span>}
          </Label>
          {field.description && (
            <p className="text-xs text-muted-foreground">{field.description}</p>
          )}
          <Textarea
            placeholder={field.placeholder ?? ""}
            rows={4}
            value={(value as string) ?? ""}
            onChange={(e) => onChange?.(e.target.value)}
          />
        </div>
      );

    case "select":
      return (
        <div className="space-y-1.5">
          <Label>
            {field.label}
            {field.required && <span className="text-destructive ml-1">*</span>}
          </Label>
          {field.description && (
            <p className="text-xs text-muted-foreground">{field.description}</p>
          )}
          <Select
            value={(value as string) ?? ""}
            onValueChange={(v) => onChange?.(v)}
          >
            <SelectTrigger>
              <SelectValue placeholder={field.placeholder ?? "Select..."} />
            </SelectTrigger>
            <SelectContent>
              {options.map((opt) => (
                <SelectItem key={opt.value} value={opt.value}>
                  {opt.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      );

    case "radio":
      return (
        <div className="space-y-1.5">
          <Label>
            {field.label}
            {field.required && <span className="text-destructive ml-1">*</span>}
          </Label>
          {field.description && (
            <p className="text-xs text-muted-foreground">{field.description}</p>
          )}
          <div className="space-y-2">
            {options.map((opt) => (
              <div key={opt.value} className="flex items-center gap-2">
                <input
                  type="radio"
                  name={field.fieldKey}
                  checked={(value as string) === opt.value}
                  onChange={() => onChange?.(opt.value)}
                />
                <Label className="font-normal">{opt.label}</Label>
              </div>
            ))}
          </div>
        </div>
      );

    case "checkbox":
      return (
        <div className="flex items-center gap-2">
          <Checkbox
            checked={!!value}
            onCheckedChange={(checked) => onChange?.(checked === true)}
          />
          <Label className="font-normal">
            {field.label}
            {field.required && <span className="text-destructive ml-1">*</span>}
          </Label>
        </div>
      );

    case "checkbox_group":
    case "multi_select":
      return (
        <div className="space-y-1.5">
          <Label>
            {field.label}
            {field.required && <span className="text-destructive ml-1">*</span>}
          </Label>
          {field.description && (
            <p className="text-xs text-muted-foreground">{field.description}</p>
          )}
          <div className="space-y-2">
            {options.map((opt) => (
              <div key={opt.value} className="flex items-center gap-2">
                <Checkbox disabled />
                <Label className="font-normal">{opt.label}</Label>
              </div>
            ))}
          </div>
        </div>
      );

    case "file_upload":
      return (
        <div className="space-y-1.5">
          <Label>
            {field.label}
            {field.required && <span className="text-destructive ml-1">*</span>}
          </Label>
          {field.description && (
            <p className="text-xs text-muted-foreground">{field.description}</p>
          )}
          <div className="border-2 border-dashed rounded-lg p-6 text-center text-sm text-muted-foreground">
            Drag and drop files here, or click to browse
          </div>
        </div>
      );

    default:
      return (
        <div className="space-y-1.5">
          <Label>
            {field.label}
            {field.required && <span className="text-destructive ml-1">*</span>}
          </Label>
          {field.description && (
            <p className="text-xs text-muted-foreground">{field.description}</p>
          )}
          <Input
            type={
              field.fieldType === "number"
                ? "number"
                : field.fieldType === "email"
                  ? "email"
                  : field.fieldType === "url"
                    ? "url"
                    : field.fieldType === "date"
                      ? "date"
                      : "text"
            }
            placeholder={field.placeholder ?? ""}
            value={(value as string) ?? ""}
            onChange={(e) => onChange?.(e.target.value)}
          />
        </div>
      );
  }
}

export function FormPreview({ form }: FormPreviewProps) {
  const [previewValues, setPreviewValues] = useState<Record<string, unknown>>(
    {},
  );

  const handlePreviewChange = useCallback(
    (fieldKey: string, value: unknown) => {
      setPreviewValues((prev) => ({ ...prev, [fieldKey]: value }));
    },
    [],
  );

  const visibilityMap = useConditionalFields(form.fields, previewValues);

  return (
    <ScrollArea className="flex-1">
      <div className="max-w-2xl mx-auto p-6 space-y-6">
        <div className="space-y-2">
          <h1 className="text-2xl font-bold">{form.name}</h1>
          {form.description && (
            <p className="text-muted-foreground">{form.description}</p>
          )}
        </div>
        <Separator />
        <div className="space-y-6">
          {form.fields.map((field) => {
            const vis = visibilityMap.get(field.fieldKey);
            if (vis && !vis.visible) return null;

            const effectiveRequired =
              field.required || (vis?.required ?? false);

            return (
              <PreviewField
                key={field.id}
                field={{ ...field, required: effectiveRequired }}
                value={previewValues[field.fieldKey]}
                onChange={(val) => handlePreviewChange(field.fieldKey, val)}
              />
            );
          })}
        </div>
        {form.fields.length === 0 && (
          <p className="text-center text-muted-foreground py-12">
            No fields to preview. Add fields in the editor.
          </p>
        )}
      </div>
    </ScrollArea>
  );
}
