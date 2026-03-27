"use client";

import { Button } from "@/components/ui/button";
import { GripVertical, MessageSquare, Trash2 } from "lucide-react";
import { ItemNotesPopover } from "./item-notes-popover";

interface CollectionItemCardProps {
  item: {
    id: string;
    submissionId: string;
    notes: string | null;
    color: string | null;
    submissionTitle?: string | null;
  };
  onUpdateNotes: (itemId: string, notes: string | null) => void;
  onRemove: (itemId: string) => void;
  dragHandleProps?: React.HTMLAttributes<HTMLButtonElement>;
}

export function CollectionItemCard({
  item,
  onUpdateNotes,
  onRemove,
  dragHandleProps,
}: CollectionItemCardProps) {
  return (
    <div className="flex items-center gap-2 rounded-md border bg-card p-3 shadow-sm">
      <button
        className="cursor-grab touch-none text-muted-foreground hover:text-foreground"
        {...dragHandleProps}
        aria-label="Drag to reorder"
      >
        <GripVertical className="h-4 w-4" />
      </button>

      {item.color && (
        <div
          className="h-4 w-1.5 rounded-full shrink-0"
          style={{ backgroundColor: item.color }}
        />
      )}

      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium truncate">
          {item.submissionTitle ?? "Untitled Submission"}
        </p>
        {item.notes && (
          <p className="text-xs text-muted-foreground truncate mt-0.5">
            {item.notes}
          </p>
        )}
      </div>

      <div className="flex items-center gap-1 shrink-0">
        <ItemNotesPopover
          notes={item.notes}
          onSave={(notes) => onUpdateNotes(item.id, notes)}
        >
          <Button variant="ghost" size="icon" className="h-7 w-7">
            <MessageSquare
              className={`h-3.5 w-3.5 ${item.notes ? "text-primary" : ""}`}
            />
            <span className="sr-only">Notes</span>
          </Button>
        </ItemNotesPopover>

        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7 text-muted-foreground hover:text-destructive"
          onClick={() => onRemove(item.id)}
        >
          <Trash2 className="h-3.5 w-3.5" />
          <span className="sr-only">Remove</span>
        </Button>
      </div>
    </div>
  );
}
