"use client";

import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { CollectionItemCard } from "./collection-item-card";

interface SortableCollectionItemProps {
  item: {
    id: string;
    submissionId: string;
    notes: string | null;
    color: string | null;
    submissionTitle?: string | null;
  };
  onUpdateNotes: (itemId: string, notes: string | null) => void;
  onRemove: (itemId: string) => void;
}

export function SortableCollectionItem({
  item,
  onUpdateNotes,
  onRemove,
}: SortableCollectionItemProps) {
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
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div ref={setNodeRef} style={style}>
      <CollectionItemCard
        item={item}
        onUpdateNotes={onUpdateNotes}
        onRemove={onRemove}
        dragHandleProps={{ ...attributes, ...listeners }}
      />
    </div>
  );
}
