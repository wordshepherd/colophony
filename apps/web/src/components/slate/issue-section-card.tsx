"use client";

import { useState } from "react";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensors,
  useSensor,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { SortableIssueItem } from "./sortable-issue-item";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Trash2 } from "lucide-react";

/** Wire-format types (dates serialized as strings over tRPC) */
type WireSection = {
  id: string;
  issueId: string;
  title: string;
  sortOrder: number;
  createdAt: string;
};
type WireItem = {
  id: string;
  issueId: string;
  pipelineItemId: string;
  issueSectionId: string | null;
  sortOrder: number;
  createdAt: string;
};

interface IssueSectionCardProps {
  section: WireSection;
  items: WireItem[];
  issueId: string;
  allSections: WireSection[];
  isEditor: boolean;
  onRemoveSection: (sectionId: string) => void;
  onRemoveItem: (itemId: string) => void;
  onChangeSection: (
    itemId: string,
    pipelineItemId: string,
    newSectionId: string | null,
  ) => void;
  onReorder: (items: { id: string; sortOrder: number }[]) => void;
}

export function IssueSectionCard({
  section,
  items,
  allSections,
  isEditor,
  onRemoveSection,
  onRemoveItem,
  onChangeSection,
  onReorder,
}: IssueSectionCardProps) {
  const [confirmOpen, setConfirmOpen] = useState(false);
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  );

  const sorted = [...items].sort((a, b) => a.sortOrder - b.sortOrder);

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const oldIndex = sorted.findIndex((i) => i.id === active.id);
    const newIndex = sorted.findIndex((i) => i.id === over.id);
    if (oldIndex === -1 || newIndex === -1) return;

    const reordered = [...sorted];
    const [moved] = reordered.splice(oldIndex, 1);
    reordered.splice(newIndex, 0, moved);

    onReorder(reordered.map((item, idx) => ({ id: item.id, sortOrder: idx })));
  };

  const handleMoveUp = (index: number) => {
    if (index === 0) return;
    const reordered = [...sorted];
    [reordered[index - 1], reordered[index]] = [
      reordered[index],
      reordered[index - 1],
    ];
    onReorder(reordered.map((item, idx) => ({ id: item.id, sortOrder: idx })));
  };

  const handleMoveDown = (index: number) => {
    if (index >= sorted.length - 1) return;
    const reordered = [...sorted];
    [reordered[index], reordered[index + 1]] = [
      reordered[index + 1],
      reordered[index],
    ];
    onReorder(reordered.map((item, idx) => ({ id: item.id, sortOrder: idx })));
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <div className="flex items-center gap-2">
          <CardTitle className="text-base">{section.title}</CardTitle>
          <Badge variant="secondary" className="text-xs">
            {items.length}
          </Badge>
        </div>
        {isEditor && (
          <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
            <AlertDialogTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7 text-muted-foreground hover:text-destructive"
              >
                <Trash2 className="h-3 w-3" />
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Remove Section</AlertDialogTitle>
                <AlertDialogDescription>
                  Remove &ldquo;{section.title}&rdquo;? Items in this section
                  will become unsectioned.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction onClick={() => onRemoveSection(section.id)}>
                  Remove
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        )}
      </CardHeader>
      <CardContent>
        {sorted.length > 0 ? (
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={handleDragEnd}
          >
            <SortableContext
              items={sorted.map((i) => i.id)}
              strategy={verticalListSortingStrategy}
            >
              <div className="space-y-2">
                {sorted.map((item, idx) => (
                  <SortableIssueItem
                    key={item.id}
                    item={item}
                    sections={allSections}
                    isFirst={idx === 0}
                    isLast={idx === sorted.length - 1}
                    isEditor={isEditor}
                    onMoveUp={() => handleMoveUp(idx)}
                    onMoveDown={() => handleMoveDown(idx)}
                    onRemove={() => onRemoveItem(item.id)}
                    onChangeSection={(newSectionId) =>
                      onChangeSection(
                        item.id,
                        item.pipelineItemId,
                        newSectionId,
                      )
                    }
                  />
                ))}
              </div>
            </SortableContext>
          </DndContext>
        ) : (
          <p className="text-sm text-muted-foreground py-4 text-center">
            No items in this section
          </p>
        )}
      </CardContent>
    </Card>
  );
}
