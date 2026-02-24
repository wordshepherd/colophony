"use client";

import type { MergeFieldDefinition } from "@colophony/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Plus, Trash2 } from "lucide-react";

interface MergeFieldManagerProps {
  fields: MergeFieldDefinition[];
  onChange: (fields: MergeFieldDefinition[]) => void;
}

function slugify(label: string): string {
  return label
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_|_$/g, "");
}

export function MergeFieldManager({
  fields,
  onChange,
}: MergeFieldManagerProps) {
  const addField = () => {
    onChange([
      ...fields,
      { key: "", label: "", source: "manual", defaultValue: "" },
    ]);
  };

  const removeField = (index: number) => {
    onChange(fields.filter((_, i) => i !== index));
  };

  const updateField = (
    index: number,
    updates: Partial<MergeFieldDefinition>,
  ) => {
    const updated = fields.map((f, i) => {
      if (i !== index) return f;
      const merged = { ...f, ...updates };
      // Auto-slugify key from label if label changed and key is empty or was auto-generated
      if (
        updates.label !== undefined &&
        (!f.key || f.key === slugify(f.label))
      ) {
        merged.key = slugify(updates.label);
      }
      return merged;
    });
    onChange(updated);
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium">Merge Fields</p>
        <Button type="button" variant="outline" size="sm" onClick={addField}>
          <Plus className="mr-1 h-3 w-3" />
          Add Field
        </Button>
      </div>

      {fields.length === 0 && (
        <p className="text-sm text-muted-foreground">
          No merge fields defined. Add fields to insert dynamic values into the
          contract body.
        </p>
      )}

      {fields.map((field, index) => (
        <div key={index} className="flex items-start gap-2">
          <div className="flex-1 space-y-2">
            <div className="grid grid-cols-2 gap-2">
              <Input
                placeholder="Label"
                value={field.label}
                onChange={(e) => updateField(index, { label: e.target.value })}
              />
              <Input
                placeholder="Key"
                value={field.key}
                onChange={(e) =>
                  updateField(index, {
                    key: e.target.value.replace(/[^a-z0-9_]/gi, ""),
                  })
                }
              />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <Select
                value={field.source}
                onValueChange={(value: "auto" | "manual") =>
                  updateField(index, { source: value })
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="auto">Auto</SelectItem>
                  <SelectItem value="manual">Manual</SelectItem>
                </SelectContent>
              </Select>
              <Input
                placeholder="Default value (optional)"
                value={field.defaultValue ?? ""}
                onChange={(e) =>
                  updateField(index, {
                    defaultValue: e.target.value || undefined,
                  })
                }
              />
            </div>
          </div>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => removeField(index)}
            className="mt-1"
          >
            <Trash2 className="h-4 w-4 text-destructive" />
          </Button>
        </div>
      ))}
    </div>
  );
}
