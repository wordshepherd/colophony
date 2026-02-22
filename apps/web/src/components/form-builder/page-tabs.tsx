"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  horizontalListSortingStrategy,
  useSortable,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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
import { Plus, MoreVertical, Pencil, Trash2, GripVertical } from "lucide-react";
import { cn } from "@/lib/utils";

/** Loose page type that accepts both Date and string for timestamp fields (tRPC v11 serialization). */
interface PageData {
  id: string;
  title: string;
  description: string | null;
  sortOrder: number;
  branchingRules: unknown;
}

interface PageTabsProps {
  formId: string;
  pages: PageData[];
  activePageId: string | null;
  onSelectPage: (pageId: string | null) => void;
  onAddPage: (title: string) => void;
  onUpdatePage: (pageId: string, data: { title?: string }) => void;
  onRemovePage: (pageId: string) => void;
  onReorderPages: (pageIds: string[]) => void;
  canEdit: boolean;
}

function SortablePageTab({
  page,
  isActive,
  onSelect,
  onRename,
  onDelete,
  canEdit,
}: {
  page: PageData;
  isActive: boolean;
  onSelect: () => void;
  onRename: (title: string) => void;
  onDelete: () => void;
  canEdit: boolean;
}) {
  const [isRenaming, setIsRenaming] = useState(false);
  const [renameValue, setRenameValue] = useState(page.title);
  const inputRef = useRef<HTMLInputElement>(null);

  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: page.id, disabled: !canEdit });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  useEffect(() => {
    if (isRenaming && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [isRenaming]);

  const handleRenameSubmit = useCallback(() => {
    const trimmed = renameValue.trim();
    if (trimmed && trimmed !== page.title) {
      onRename(trimmed);
    }
    setIsRenaming(false);
  }, [renameValue, page.title, onRename]);

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        "flex items-center gap-1 px-3 py-1.5 text-sm border-b-2 shrink-0 select-none",
        isActive
          ? "border-primary font-medium text-foreground"
          : "border-transparent text-muted-foreground hover:text-foreground hover:border-muted-foreground/30",
        isDragging && "opacity-50",
      )}
    >
      {canEdit && (
        <button
          type="button"
          className="cursor-grab touch-none text-muted-foreground hover:text-foreground"
          {...attributes}
          {...listeners}
        >
          <GripVertical className="h-3 w-3" />
        </button>
      )}

      {isRenaming ? (
        <Input
          ref={inputRef}
          value={renameValue}
          onChange={(e) => setRenameValue(e.target.value)}
          onBlur={handleRenameSubmit}
          onKeyDown={(e) => {
            if (e.key === "Enter") handleRenameSubmit();
            if (e.key === "Escape") setIsRenaming(false);
          }}
          className="h-6 w-24 text-xs px-1"
        />
      ) : (
        <button
          type="button"
          className="truncate max-w-[120px]"
          onClick={onSelect}
          onDoubleClick={() => {
            if (!canEdit) return;
            setRenameValue(page.title);
            setIsRenaming(true);
          }}
        >
          {page.title}
        </button>
      )}

      {canEdit && !isRenaming && (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              className="ml-0.5 text-muted-foreground hover:text-foreground"
            >
              <MoreVertical className="h-3 w-3" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start">
            <DropdownMenuItem
              onClick={() => {
                setRenameValue(page.title);
                setIsRenaming(true);
              }}
            >
              <Pencil className="mr-2 h-3 w-3" />
              Rename
            </DropdownMenuItem>
            <DropdownMenuItem className="text-destructive" onClick={onDelete}>
              <Trash2 className="mr-2 h-3 w-3" />
              Delete
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      )}
    </div>
  );
}

export function PageTabs({
  pages,
  activePageId,
  onSelectPage,
  onAddPage,
  onUpdatePage,
  onRemovePage,
  onReorderPages,
  canEdit,
}: PageTabsProps) {
  const [isAddingPage, setIsAddingPage] = useState(false);
  const [newPageTitle, setNewPageTitle] = useState("");
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);
  const addInputRef = useRef<HTMLInputElement>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor),
  );

  useEffect(() => {
    if (isAddingPage && addInputRef.current) {
      addInputRef.current.focus();
    }
  }, [isAddingPage]);

  const sortedPages = [...pages].sort((a, b) => a.sortOrder - b.sortOrder);
  const pageIds = sortedPages.map((p) => p.id);

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const oldIndex = pageIds.indexOf(active.id as string);
    const newIndex = pageIds.indexOf(over.id as string);
    if (oldIndex === -1 || newIndex === -1) return;

    const newIds = [...pageIds];
    const [removed] = newIds.splice(oldIndex, 1);
    newIds.splice(newIndex, 0, removed);
    onReorderPages(newIds);
  };

  const handleAddSubmit = useCallback(() => {
    const trimmed = newPageTitle.trim();
    if (trimmed) {
      onAddPage(trimmed);
      setNewPageTitle("");
    }
    setIsAddingPage(false);
  }, [newPageTitle, onAddPage]);

  // Don't render tabs when no pages exist
  if (pages.length === 0 && !isAddingPage) {
    return canEdit ? (
      <div className="border-b px-4 py-1.5">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-7 text-xs"
          onClick={() => setIsAddingPage(true)}
        >
          <Plus className="mr-1 h-3 w-3" />
          Add Page
        </Button>
      </div>
    ) : null;
  }

  return (
    <>
      <div className="border-b px-4 flex items-center gap-1 overflow-x-auto">
        {/* "All Fields" tab — shows unassigned fields */}
        <button
          type="button"
          className={cn(
            "px-3 py-1.5 text-sm border-b-2 shrink-0",
            activePageId === null
              ? "border-primary font-medium text-foreground"
              : "border-transparent text-muted-foreground hover:text-foreground hover:border-muted-foreground/30",
          )}
          onClick={() => onSelectPage(null)}
        >
          All Fields
        </button>

        <div className="w-px h-5 bg-border mx-1 shrink-0" />

        {/* Page tabs */}
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={handleDragEnd}
        >
          <SortableContext
            items={pageIds}
            strategy={horizontalListSortingStrategy}
          >
            {sortedPages.map((page) => (
              <SortablePageTab
                key={page.id}
                page={page}
                isActive={activePageId === page.id}
                onSelect={() => onSelectPage(page.id)}
                onRename={(title) => onUpdatePage(page.id, { title })}
                onDelete={() => setDeleteTarget(page.id)}
                canEdit={canEdit}
              />
            ))}
          </SortableContext>
        </DndContext>

        {/* Add page */}
        {canEdit && (
          <>
            {isAddingPage ? (
              <div className="flex items-center gap-1 shrink-0 px-1">
                <Input
                  ref={addInputRef}
                  value={newPageTitle}
                  onChange={(e) => setNewPageTitle(e.target.value)}
                  onBlur={handleAddSubmit}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") handleAddSubmit();
                    if (e.key === "Escape") {
                      setNewPageTitle("");
                      setIsAddingPage(false);
                    }
                  }}
                  placeholder="Page title"
                  className="h-6 w-24 text-xs px-1"
                />
              </div>
            ) : (
              <button
                type="button"
                className="p-1.5 text-muted-foreground hover:text-foreground shrink-0"
                onClick={() => setIsAddingPage(true)}
              >
                <Plus className="h-4 w-4" />
              </button>
            )}
          </>
        )}
      </div>

      {/* Delete confirmation dialog */}
      <AlertDialog
        open={deleteTarget !== null}
        onOpenChange={(open: boolean) => !open && setDeleteTarget(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete page?</AlertDialogTitle>
            <AlertDialogDescription>
              Fields on this page will become unassigned and appear under
              &quot;All Fields&quot;. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (deleteTarget) {
                  onRemovePage(deleteTarget);
                  if (activePageId === deleteTarget) onSelectPage(null);
                }
                setDeleteTarget(null);
              }}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
