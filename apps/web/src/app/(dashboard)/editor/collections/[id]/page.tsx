"use client";

import { use, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  DndContext,
  closestCenter,
  PointerSensor,
  KeyboardSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  arrayMove,
} from "@dnd-kit/sortable";
import { SortableCollectionItem } from "@/components/collections/sortable-collection-item";
import { AddSubmissionDialog } from "@/components/collections/add-submission-dialog";
import { CollectionForm } from "@/components/collections/collection-form";
import { ArrowLeft, EyeOff, Pencil, Plus, Trash2, Users } from "lucide-react";

export default function CollectionDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const router = useRouter();
  const utils = trpc.useUtils();

  const [showAddDialog, setShowAddDialog] = useState(false);
  const [showEditForm, setShowEditForm] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  const { data: collection, isPending: isLoadingCollection } =
    trpc.collections.getById.useQuery({ id });
  const { data: items = [], isPending: isLoadingItems } =
    trpc.collections.getItems.useQuery({ id });

  const addItemMutation = trpc.collections.addItem.useMutation({
    onSuccess: () => utils.collections.getItems.invalidate({ id }),
  });

  const updateItemMutation = trpc.collections.updateItem.useMutation({
    onSuccess: () => utils.collections.getItems.invalidate({ id }),
  });

  const removeItemMutation = trpc.collections.removeItem.useMutation({
    onSuccess: () => utils.collections.getItems.invalidate({ id }),
  });

  const reorderMutation = trpc.collections.reorderItems.useMutation({
    onSuccess: () => utils.collections.getItems.invalidate({ id }),
  });

  const updateCollectionMutation = trpc.collections.update.useMutation({
    onSuccess: () => {
      utils.collections.getById.invalidate({ id });
      setShowEditForm(false);
    },
  });

  const deleteMutation = trpc.collections.delete.useMutation({
    onSuccess: () => router.push("/editor/collections"),
  });

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  );

  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      const { active, over } = event;
      if (!over || active.id === over.id) return;

      const oldIndex = items.findIndex((i) => i.id === active.id);
      const newIndex = items.findIndex((i) => i.id === over.id);
      if (oldIndex === -1 || newIndex === -1) return;

      const reordered = arrayMove(items, oldIndex, newIndex);
      reorderMutation.mutate({
        id,
        items: reordered.map((item, idx) => ({
          id: item.id,
          position: idx,
        })),
      });
    },
    [items, id, reorderMutation],
  );

  const handleUpdateNotes = useCallback(
    (itemId: string, notes: string | null) => {
      updateItemMutation.mutate({ id, itemId, notes });
    },
    [id, updateItemMutation],
  );

  const handleRemoveItem = useCallback(
    (itemId: string) => {
      removeItemMutation.mutate({ id, itemId });
    },
    [id, removeItemMutation],
  );

  const existingIds = new Set(items.map((i) => i.submissionId));

  if (isLoadingCollection) {
    return (
      <div className="space-y-4">
        <div className="h-8 w-48 bg-muted animate-pulse rounded" />
        <div className="h-4 w-96 bg-muted animate-pulse rounded" />
      </div>
    );
  }

  if (!collection) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        Collection not found.
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => router.push("/editor/collections")}
        >
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold tracking-tight truncate">
              {collection.name}
            </h1>
            {collection.visibility === "private" ? (
              <EyeOff className="h-4 w-4 text-muted-foreground shrink-0" />
            ) : (
              <Users className="h-4 w-4 text-muted-foreground shrink-0" />
            )}
            <Badge variant="secondary" className="shrink-0">
              {collection.typeHint.replace("_", " ")}
            </Badge>
          </div>
          {collection.description && (
            <p className="text-sm text-muted-foreground mt-1">
              {collection.description}
            </p>
          )}
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowEditForm(true)}
          >
            <Pencil className="mr-1.5 h-3.5 w-3.5" />
            Edit
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="text-destructive hover:text-destructive"
            onClick={() => setShowDeleteConfirm(true)}
          >
            <Trash2 className="mr-1.5 h-3.5 w-3.5" />
            Delete
          </Button>
        </div>
      </div>

      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          {items.length} item{items.length !== 1 ? "s" : ""}
        </p>
        <Button
          size="sm"
          onClick={() => setShowAddDialog(true)}
          data-testid="add-submission-btn"
        >
          <Plus className="mr-1.5 h-3.5 w-3.5" />
          Add Submission
        </Button>
      </div>

      {isLoadingItems ? (
        <div className="space-y-2">
          {Array.from({ length: 3 }, (_, i) => (
            <div
              key={i}
              className="h-16 rounded-md border bg-muted animate-pulse"
            />
          ))}
        </div>
      ) : items.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground border rounded-lg">
          No submissions in this collection yet.
        </div>
      ) : (
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={handleDragEnd}
        >
          <SortableContext
            items={items.map((i) => i.id)}
            strategy={verticalListSortingStrategy}
          >
            <div className="space-y-2">
              {items.map((item) => (
                <SortableCollectionItem
                  key={item.id}
                  item={item}
                  onUpdateNotes={handleUpdateNotes}
                  onRemove={handleRemoveItem}
                />
              ))}
            </div>
          </SortableContext>
        </DndContext>
      )}

      <AddSubmissionDialog
        open={showAddDialog}
        onOpenChange={setShowAddDialog}
        excludeIds={existingIds}
        onSelect={(submissionId) => {
          addItemMutation.mutate({ id, submissionId });
        }}
      />

      <CollectionForm
        open={showEditForm}
        onOpenChange={setShowEditForm}
        title="Edit Collection"
        initialValues={collection}
        onSubmit={(data) => updateCollectionMutation.mutate({ id, ...data })}
        isSubmitting={updateCollectionMutation.isPending}
      />

      <AlertDialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Collection</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete &ldquo;{collection.name}&rdquo;?
              This will remove all items from the collection. The submissions
              themselves will not be deleted.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => deleteMutation.mutate({ id })}
            >
              {deleteMutation.isPending ? "Deleting..." : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
