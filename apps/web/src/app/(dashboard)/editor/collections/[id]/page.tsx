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
import {
  DetailPane,
  type WorkspaceContext,
} from "@/components/editor/detail-pane";
import {
  ArrowLeft,
  BookOpen,
  EyeOff,
  List,
  Pencil,
  Plus,
  Trash2,
  Users,
} from "lucide-react";

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
  const [selectedItemId, setSelectedItemId] = useState<string | null>(null);

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
      if (selectedItemId === itemId) setSelectedItemId(null);
    },
    [id, removeItemMutation, selectedItemId],
  );

  const handleItemClick = useCallback((itemId: string) => {
    setSelectedItemId((prev) => (prev === itemId ? null : itemId));
  }, []);

  const selectedItem = items.find((i) => i.id === selectedItemId);
  const isReadingMode = selectedItem != null;

  const workspaceContext: WorkspaceContext | undefined = selectedItem
    ? {
        collectionId: id,
        itemId: selectedItem.id,
        readingAnchor: selectedItem.readingAnchor as {
          nodeIndex: number;
          charOffset: number;
        } | null,
      }
    : undefined;

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
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="shrink-0 space-y-4 pb-4">
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
            {isReadingMode && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => setSelectedItemId(null)}
              >
                <List className="mr-1.5 h-3.5 w-3.5" />
                Manage
              </Button>
            )}
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
      </div>

      {/* Content area: management mode or reading mode */}
      {isReadingMode && selectedItem ? (
        <div className="flex-1 flex gap-4 min-h-0">
          {/* Item rail */}
          <div className="w-64 shrink-0 overflow-y-auto border rounded-lg p-2 space-y-1">
            {items.map((item) => (
              <button
                key={item.id}
                onClick={() => handleItemClick(item.id)}
                className={`w-full text-left px-3 py-2 rounded-md text-sm truncate transition-colors ${
                  item.id === selectedItemId
                    ? "bg-primary/10 text-primary font-medium"
                    : "text-muted-foreground hover:bg-muted"
                }`}
              >
                {item.readingAnchor ? (
                  <BookOpen className="inline h-3 w-3 mr-1.5 opacity-60" />
                ) : null}
                {item.submissionTitle ?? "Untitled"}
              </button>
            ))}
          </div>

          {/* Reading pane */}
          <div className="flex-1 min-w-0 border rounded-lg overflow-hidden">
            <DetailPane
              submissionId={selectedItem.submissionId}
              mode="deep-read"
              workspaceContext={workspaceContext}
            />
          </div>
        </div>
      ) : (
        <div className="space-y-4">
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
                    <div
                      key={item.id}
                      onClick={(e) => {
                        // Only enter reading mode if clicking the card body,
                        // not action buttons (notes, remove, drag handle)
                        if (
                          (e.target as HTMLElement).closest(
                            "button, [role='button']",
                          )
                        )
                          return;
                        handleItemClick(item.id);
                      }}
                      className="cursor-pointer"
                    >
                      <SortableCollectionItem
                        item={item}
                        onUpdateNotes={handleUpdateNotes}
                        onRemove={handleRemoveItem}
                      />
                    </div>
                  ))}
                </div>
              </SortableContext>
            </DndContext>
          )}
        </div>
      )}

      <AddSubmissionDialog
        open={showAddDialog}
        onOpenChange={setShowAddDialog}
        excludeIds={existingIds}
        onSelect={(submissionId) => {
          addItemMutation.mutate({ id, submissionId });
        }}
      />

      {/* key forces remount so form state syncs with loaded collection */}
      <CollectionForm
        key={collection.id}
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
