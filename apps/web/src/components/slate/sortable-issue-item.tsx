"use client";

import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { GripVertical, Trash2, ChevronUp, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

/** Wire-format types (dates serialized as strings over tRPC) */
type WireSection = {
  id: string;
  title: string;
};
type WireItem = {
  id: string;
  pipelineItemId: string;
  issueSectionId: string | null;
  submissionTitle?: string | null;
};

interface SortableIssueItemProps {
  item: WireItem;
  sections: WireSection[];
  isFirst: boolean;
  isLast: boolean;
  isEditor: boolean;
  isAdmin: boolean;
  onMoveUp: () => void;
  onMoveDown: () => void;
  onRemove: () => void;
  onChangeSection: (newSectionId: string | null) => void;
}

const UNSECTIONED_VALUE = "__unsectioned__";

export function SortableIssueItem({
  item,
  sections,
  isFirst,
  isLast,
  isEditor,
  isAdmin,
  onMoveUp,
  onMoveDown,
  onRemove,
  onChangeSection,
}: SortableIssueItemProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: item.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        "flex items-center gap-2 rounded-lg border p-3 bg-background transition-colors",
        isDragging && "opacity-50",
      )}
    >
      {isAdmin && (
        <button
          className="cursor-grab touch-none text-muted-foreground hover:text-foreground"
          aria-label="Drag to reorder"
          {...attributes}
          {...listeners}
        >
          <GripVertical className="h-4 w-4" />
        </button>
      )}

      <span className="text-sm text-muted-foreground min-w-0 truncate">
        {item.submissionTitle ?? item.pipelineItemId.slice(0, 8) + "\u2026"}
      </span>

      {isEditor && (
        <Select
          value={item.issueSectionId ?? UNSECTIONED_VALUE}
          onValueChange={(v) =>
            onChangeSection(v === UNSECTIONED_VALUE ? null : v)
          }
        >
          <SelectTrigger className="w-[140px] h-8 text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={UNSECTIONED_VALUE}>Unsectioned</SelectItem>
            {sections.map((s) => (
              <SelectItem key={s.id} value={s.id}>
                {s.title}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}

      <div className="flex items-center gap-0.5 shrink-0 ml-auto">
        {isAdmin && (
          <>
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
          </>
        )}
        {isEditor && (
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 text-muted-foreground hover:text-destructive"
            onClick={onRemove}
            aria-label="Remove item"
          >
            <Trash2 className="h-3 w-3" />
          </Button>
        )}
      </div>
    </div>
  );
}
