"use client";

import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Button } from "@/components/ui/button";
import { FIELD_TYPE_META } from "./field-type-meta";
import {
  GripVertical,
  Trash2,
  ChevronUp,
  ChevronDown,
  Asterisk,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { FormFieldType } from "@colophony/types";

interface SortableField {
  id: string;
  fieldType: FormFieldType;
  label: string;
  required: boolean;
}

interface SortableFieldItemProps {
  field: SortableField;
  isSelected: boolean;
  isFirst: boolean;
  isLast: boolean;
  onSelect: () => void;
  onRemove: () => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
}

export function SortableFieldItem({
  field,
  isSelected,
  isFirst,
  isLast,
  onSelect,
  onRemove,
  onMoveUp,
  onMoveDown,
}: SortableFieldItemProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: field.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  const meta = FIELD_TYPE_META[field.fieldType];
  const Icon = meta.icon;

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        "flex items-center gap-2 rounded-lg border p-3 bg-background transition-colors",
        isSelected && "ring-2 ring-primary border-primary",
        isDragging && "opacity-50",
      )}
    >
      <button
        className="cursor-grab touch-none text-muted-foreground hover:text-foreground"
        aria-label="Drag to reorder"
        {...attributes}
        {...listeners}
      >
        <GripVertical className="h-4 w-4" />
      </button>

      <button
        className="flex-1 flex items-center gap-2 text-left min-w-0"
        onClick={onSelect}
        type="button"
      >
        <Icon className="h-4 w-4 text-muted-foreground shrink-0" />
        <span className="text-sm font-medium truncate">{field.label}</span>
        {field.required && (
          <Asterisk className="h-3 w-3 text-destructive shrink-0" />
        )}
        <span className="text-xs text-muted-foreground shrink-0">
          {meta.label}
        </span>
      </button>

      <div className="flex items-center gap-0.5 shrink-0">
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7"
          disabled={isFirst}
          onClick={onMoveUp}
          aria-label="Move up"
        >
          <ChevronUp className="h-3 w-3" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7"
          disabled={isLast}
          onClick={onMoveDown}
          aria-label="Move down"
        >
          <ChevronDown className="h-3 w-3" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7 text-muted-foreground hover:text-destructive"
          onClick={onRemove}
          aria-label="Remove field"
        >
          <Trash2 className="h-3 w-3" />
        </Button>
      </div>
    </div>
  );
}
