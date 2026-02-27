"use client";

import {
  useState,
  useRef,
  useCallback,
  useMemo,
  type MutableRefObject,
} from "react";
import { trpc } from "@/lib/trpc";
import { IssueSectionCard } from "./issue-section-card";
import { SortableIssueItem } from "./sortable-issue-item";
import { AddSectionDialog } from "./add-section-dialog";
import { AddItemDialog } from "./add-item-dialog";
import { Button } from "@/components/ui/button";
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
import { toast } from "sonner";
import { Plus, LayoutList } from "lucide-react";

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
  submissionTitle?: string | null;
};

interface IssueAssemblyProps {
  issueId: string;
  sections: WireSection[];
  items: WireItem[];
  isEditor: boolean;
  isAdmin: boolean;
}

export function IssueAssembly({
  issueId,
  sections,
  items,
  isEditor,
  isAdmin,
}: IssueAssemblyProps) {
  const [showAddSectionDialog, setShowAddSectionDialog] = useState(false);
  const [showAddItemDialog, setShowAddItemDialog] = useState(false);
  const utils = trpc.useUtils();
  const reorderTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const sectionChangeRef: MutableRefObject<boolean> = useRef(false);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  );

  const reorderMutation = trpc.issues.reorderItems.useMutation({
    onSuccess: () => {
      utils.issues.getItems.invalidate({ id: issueId });
    },
    onError: (err) => {
      toast.error(`Reorder failed: ${err.message}`);
      utils.issues.getItems.invalidate({ id: issueId });
    },
  });

  const removeItemMutation = trpc.issues.removeItem.useMutation({
    onSuccess: () => {
      if (!sectionChangeRef.current) {
        toast.success("Item removed");
      }
      utils.issues.getItems.invalidate({ id: issueId });
    },
    onError: (err) => {
      sectionChangeRef.current = false;
      toast.error(err.message);
    },
  });

  const removeSectionMutation = trpc.issues.removeSection.useMutation({
    onSuccess: () => {
      toast.success("Section removed");
      utils.issues.getSections.invalidate({ id: issueId });
      utils.issues.getItems.invalidate({ id: issueId });
    },
    onError: (err) => {
      toast.error(err.message);
    },
  });

  const addItemMutation = trpc.issues.addItem.useMutation({
    onSuccess: () => {
      utils.issues.getItems.invalidate({ id: issueId });
    },
    onError: (err) => {
      toast.error(`Failed to reassign item: ${err.message}`);
      utils.issues.getItems.invalidate({ id: issueId });
    },
  });

  const debouncedReorder = useCallback(
    (reorderData: { id: string; sortOrder: number }[]) => {
      if (reorderTimerRef.current) clearTimeout(reorderTimerRef.current);
      reorderTimerRef.current = setTimeout(() => {
        reorderMutation.mutate({ id: issueId, items: reorderData });
      }, 300);
    },
    [issueId, reorderMutation],
  );

  const handleRemoveItem = (itemId: string) => {
    removeItemMutation.mutate({ id: issueId, itemId });
  };

  const handleRemoveSection = (sectionId: string) => {
    removeSectionMutation.mutate({ id: issueId, sectionId });
  };

  const handleChangeSection = (
    itemId: string,
    pipelineItemId: string,
    newSectionId: string | null,
  ) => {
    sectionChangeRef.current = true;
    // Remove then re-add to change section
    removeItemMutation.mutate(
      { id: issueId, itemId },
      {
        onSuccess: () => {
          addItemMutation.mutate(
            {
              id: issueId,
              pipelineItemId,
              issueSectionId: newSectionId ?? undefined,
            },
            {
              onSuccess: () => {
                sectionChangeRef.current = false;
                const sectionName = newSectionId
                  ? (sections.find((s) => s.id === newSectionId)?.title ??
                    "section")
                  : "Unsectioned";
                toast.success(`Item moved to ${sectionName}`);
                utils.issues.getItems.invalidate({ id: issueId });
              },
              onError: () => {
                sectionChangeRef.current = false;
              },
            },
          );
        },
      },
    );
  };

  // Group items by section (memoized to avoid recalc on every drag event)
  const sortedSections = useMemo(
    () => [...sections].sort((a, b) => a.sortOrder - b.sortOrder),
    [sections],
  );
  const unsectionedItems = useMemo(
    () =>
      items
        .filter((i) => !i.issueSectionId)
        .sort((a, b) => a.sortOrder - b.sortOrder),
    [items],
  );
  const existingPipelineIds = useMemo(
    () => new Set(items.map((i) => i.pipelineItemId)),
    [items],
  );

  // Unsectioned DnD handlers
  const handleUnsectionedDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const oldIndex = unsectionedItems.findIndex((i) => i.id === active.id);
    const newIndex = unsectionedItems.findIndex((i) => i.id === over.id);
    if (oldIndex === -1 || newIndex === -1) return;

    const reordered = [...unsectionedItems];
    const [moved] = reordered.splice(oldIndex, 1);
    reordered.splice(newIndex, 0, moved);

    debouncedReorder(
      reordered.map((item, idx) => ({ id: item.id, sortOrder: idx })),
    );
  };

  const handleUnsectionedMoveUp = (index: number) => {
    if (index === 0) return;
    const reordered = [...unsectionedItems];
    [reordered[index - 1], reordered[index]] = [
      reordered[index],
      reordered[index - 1],
    ];
    debouncedReorder(
      reordered.map((item, idx) => ({ id: item.id, sortOrder: idx })),
    );
  };

  const handleUnsectionedMoveDown = (index: number) => {
    if (index >= unsectionedItems.length - 1) return;
    const reordered = [...unsectionedItems];
    [reordered[index], reordered[index + 1]] = [
      reordered[index + 1],
      reordered[index],
    ];
    debouncedReorder(
      reordered.map((item, idx) => ({ id: item.id, sortOrder: idx })),
    );
  };

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      {(isAdmin || isEditor) && (
        <div className="flex items-center gap-2">
          {isAdmin && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowAddSectionDialog(true)}
            >
              <LayoutList className="mr-2 h-4 w-4" />
              Add Section
            </Button>
          )}
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowAddItemDialog(true)}
          >
            <Plus className="mr-2 h-4 w-4" />
            Add Items
          </Button>
        </div>
      )}

      {/* Sections */}
      {sortedSections.map((section) => {
        const sectionItems = items.filter(
          (i) => i.issueSectionId === section.id,
        );
        return (
          <IssueSectionCard
            key={section.id}
            section={section}
            items={sectionItems}
            issueId={issueId}
            allSections={sections}
            isEditor={isEditor}
            isAdmin={isAdmin}
            onRemoveSection={handleRemoveSection}
            onRemoveItem={handleRemoveItem}
            onChangeSection={handleChangeSection}
            onReorder={debouncedReorder}
          />
        );
      })}

      {/* Unsectioned items */}
      {unsectionedItems.length > 0 && (
        <div className="space-y-2">
          <h3 className="text-sm font-medium text-muted-foreground">
            Unsectioned ({unsectionedItems.length})
          </h3>
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={handleUnsectionedDragEnd}
          >
            <SortableContext
              items={unsectionedItems.map((i) => i.id)}
              strategy={verticalListSortingStrategy}
            >
              <div className="space-y-2">
                {unsectionedItems.map((item, idx) => (
                  <SortableIssueItem
                    key={item.id}
                    item={item}
                    sections={sections}
                    isFirst={idx === 0}
                    isLast={idx === unsectionedItems.length - 1}
                    isEditor={isEditor}
                    isAdmin={isAdmin}
                    onMoveUp={() => handleUnsectionedMoveUp(idx)}
                    onMoveDown={() => handleUnsectionedMoveDown(idx)}
                    onRemove={() => handleRemoveItem(item.id)}
                    onChangeSection={(newSectionId) =>
                      handleChangeSection(
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
        </div>
      )}

      {/* Empty state */}
      {items.length === 0 && sections.length === 0 && (
        <div className="flex flex-col items-center justify-center py-12 text-center">
          <LayoutList className="h-12 w-12 text-muted-foreground mb-4" />
          <p className="text-lg font-medium">No content yet</p>
          <p className="text-sm text-muted-foreground mt-1">
            Add sections and pipeline items to assemble this issue.
          </p>
        </div>
      )}

      {/* Dialogs */}
      <AddSectionDialog
        issueId={issueId}
        open={showAddSectionDialog}
        onOpenChange={setShowAddSectionDialog}
        existingSortOrders={sections.map((s) => s.sortOrder)}
      />
      <AddItemDialog
        issueId={issueId}
        open={showAddItemDialog}
        onOpenChange={setShowAddItemDialog}
        existingPipelineIds={existingPipelineIds}
        sections={sections}
      />
    </div>
  );
}
