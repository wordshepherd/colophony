"use client";

import {
  SortableContext,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { SortableFieldItem } from "./sortable-field-item";
import { ScrollArea } from "@/components/ui/scroll-area";
import { LayoutList } from "lucide-react";
import { useMemo } from "react";
import { extractBranchingConfig, type FormFieldType } from "@colophony/types";

interface CanvasField {
  id: string;
  fieldKey: string;
  fieldType: FormFieldType;
  label: string;
  description: string | null;
  placeholder: string | null;
  required: boolean;
  sortOrder: number;
  config: Record<string, unknown> | null;
  branchId: string | null;
}

interface FormCanvasProps {
  fields: CanvasField[];
  selectedFieldId: string | null;
  onSelectField: (id: string) => void;
  onRemoveField: (id: string) => void;
  onReorder: (fieldIds: string[]) => void;
}

export function FormCanvas({
  fields,
  selectedFieldId,
  onSelectField,
  onRemoveField,
  onReorder,
}: FormCanvasProps) {
  const fieldIds = fields.map((f) => f.id);

  // Build branchId → branchName map from all fields' branching configs
  const branchNameMap = useMemo(() => {
    const map = new Map<string, string>();
    for (const f of fields) {
      const bc = extractBranchingConfig(f.config);
      if (!bc?.enabled) continue;
      for (const branch of bc.branches) {
        map.set(branch.id, branch.name);
      }
    }
    return map;
  }, [fields]);

  // Set of fields that have branching enabled (source fields)
  const branchingFieldIds = useMemo(() => {
    const set = new Set<string>();
    for (const f of fields) {
      const bc = extractBranchingConfig(f.config);
      if (bc?.enabled) set.add(f.id);
    }
    return set;
  }, [fields]);

  function handleMoveUp(index: number) {
    if (index === 0) return;
    const newIds = [...fieldIds];
    [newIds[index - 1], newIds[index]] = [newIds[index], newIds[index - 1]];
    onReorder(newIds);
  }

  function handleMoveDown(index: number) {
    if (index === fieldIds.length - 1) return;
    const newIds = [...fieldIds];
    [newIds[index], newIds[index + 1]] = [newIds[index + 1], newIds[index]];
    onReorder(newIds);
  }

  if (fields.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center border rounded-lg bg-muted/30">
        <div className="text-center py-12">
          <LayoutList className="mx-auto h-12 w-12 text-muted-foreground" />
          <h3 className="mt-4 text-lg font-semibold">No fields yet</h3>
          <p className="text-sm text-muted-foreground">
            Click a field type in the palette to add it.
          </p>
        </div>
      </div>
    );
  }

  return (
    <ScrollArea className="flex-1 border rounded-lg bg-muted/30">
      <div className="p-4 space-y-2">
        <SortableContext
          items={fieldIds}
          strategy={verticalListSortingStrategy}
        >
          {fields.map((field, index) => (
            <SortableFieldItem
              key={field.id}
              field={{
                ...field,
                hasBranching: branchingFieldIds.has(field.id),
              }}
              branchName={
                field.branchId
                  ? (branchNameMap.get(field.branchId) ?? null)
                  : null
              }
              isSelected={field.id === selectedFieldId}
              isFirst={index === 0}
              isLast={index === fields.length - 1}
              onSelect={() => onSelectField(field.id)}
              onRemove={() => onRemoveField(field.id)}
              onMoveUp={() => handleMoveUp(index)}
              onMoveDown={() => handleMoveDown(index)}
            />
          ))}
        </SortableContext>
      </div>
    </ScrollArea>
  );
}
