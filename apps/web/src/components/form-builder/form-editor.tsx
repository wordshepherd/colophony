"use client";

import { useState, useCallback } from "react";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import { sortableKeyboardCoordinates } from "@dnd-kit/sortable";
import { useFormBuilder } from "@/hooks/use-form-builder";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { FormStatusBadge } from "./form-status-badge";
import { FieldPalette } from "./field-palette";
import { FormCanvas } from "./form-canvas";
import { FieldPropertiesPanel } from "./field-properties-panel";
import { FormPreview } from "./form-preview";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Send,
  Archive,
  Copy,
  Trash2,
  Eye,
  EyeOff,
  ArrowLeft,
  Loader2,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import type { UpdateFormFieldInput } from "@colophony/types";

interface FormEditorProps {
  formId: string;
}

export function FormEditor({ formId }: FormEditorProps) {
  const router = useRouter();
  const {
    form,
    isLoading,
    error,
    selectedFieldId,
    setSelectedFieldId,
    isPreviewMode,
    togglePreview,
    addField,
    updateForm,
    publishForm,
    archiveForm,
    duplicateForm,
    deleteForm,
    updateField,
    removeField,
    reorderFields,
  } = useFormBuilder(formId);

  const [editingName, setEditingName] = useState(false);
  const [nameValue, setNameValue] = useState("");

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  );

  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      const { active, over } = event;
      if (!over || active.id === over.id || !form) return;

      const fieldIds = form.fields.map((f) => f.id);
      const oldIndex = fieldIds.indexOf(active.id as string);
      const newIndex = fieldIds.indexOf(over.id as string);

      if (oldIndex === -1 || newIndex === -1) return;

      const newIds = [...fieldIds];
      const [removed] = newIds.splice(oldIndex, 1);
      newIds.splice(newIndex, 0, removed);

      reorderFields.mutate({ id: formId, fieldIds: newIds });
    },
    [form, formId, reorderFields],
  );

  const handleUpdateField = useCallback(
    (fieldId: string, data: UpdateFormFieldInput) => {
      updateField.mutate({ id: formId, fieldId, ...data });
    },
    [formId, updateField],
  );

  const handleNameSave = useCallback(() => {
    const trimmed = nameValue.trim();
    if (trimmed && trimmed !== form?.name) {
      updateForm.mutate({ id: formId, name: trimmed });
    }
    setEditingName(false);
  }, [nameValue, form?.name, formId, updateForm]);

  const handleDelete = useCallback(() => {
    deleteForm.mutate(
      { id: formId },
      {
        onSuccess: () => {
          toast.success("Form deleted");
          router.push("/editor/forms");
        },
      },
    );
  }, [formId, deleteForm, router]);

  if (isLoading) {
    return (
      <div className="h-full p-6 space-y-4">
        <Skeleton className="h-10 w-64" />
        <div className="flex gap-4 h-[calc(100vh-12rem)]">
          <Skeleton className="w-56 h-full" />
          <Skeleton className="flex-1 h-full" />
          <Skeleton className="w-72 h-full" />
        </div>
      </div>
    );
  }

  if (error || !form) {
    return (
      <div className="text-center py-12">
        <p className="text-destructive">{error?.message ?? "Form not found"}</p>
        <Link href="/editor/forms">
          <Button variant="outline" className="mt-4">
            Back to Forms
          </Button>
        </Link>
      </div>
    );
  }

  const canEdit = form.status === "DRAFT";
  const selectedField = form.fields.find((f) => f.id === selectedFieldId);

  return (
    <div className="h-full flex flex-col">
      {/* Header bar */}
      <div className="flex items-center gap-3 border-b px-4 py-2 shrink-0">
        <Link
          href="/editor/forms"
          className="text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" />
        </Link>

        {editingName && canEdit ? (
          <Input
            value={nameValue}
            onChange={(e) => setNameValue(e.target.value)}
            onBlur={handleNameSave}
            onKeyDown={(e) => {
              if (e.key === "Enter") handleNameSave();
              if (e.key === "Escape") setEditingName(false);
            }}
            className="max-w-xs h-8 text-sm font-semibold"
            autoFocus
          />
        ) : (
          <button
            className="text-sm font-semibold hover:underline"
            onClick={() => {
              if (!canEdit) return;
              setNameValue(form.name);
              setEditingName(true);
            }}
          >
            {form.name}
          </button>
        )}

        <FormStatusBadge status={form.status} />

        <div className="flex-1" />

        <Button variant="outline" size="sm" onClick={togglePreview}>
          {isPreviewMode ? (
            <EyeOff className="mr-1 h-3 w-3" />
          ) : (
            <Eye className="mr-1 h-3 w-3" />
          )}
          {isPreviewMode ? "Editor" : "Preview"}
        </Button>

        {canEdit && (
          <Button
            size="sm"
            onClick={() => publishForm.mutate({ id: formId })}
            disabled={publishForm.isPending}
          >
            {publishForm.isPending ? (
              <Loader2 className="mr-1 h-3 w-3 animate-spin" />
            ) : (
              <Send className="mr-1 h-3 w-3" />
            )}
            Publish
          </Button>
        )}

        {form.status === "PUBLISHED" && (
          <Button
            variant="outline"
            size="sm"
            onClick={() => archiveForm.mutate({ id: formId })}
            disabled={archiveForm.isPending}
          >
            <Archive className="mr-1 h-3 w-3" />
            Archive
          </Button>
        )}

        <Button
          variant="outline"
          size="sm"
          onClick={() => duplicateForm.mutate({ id: formId })}
          disabled={duplicateForm.isPending}
        >
          <Copy className="mr-1 h-3 w-3" />
          Duplicate
        </Button>

        {canEdit && (
          <Button
            variant="outline"
            size="sm"
            className="text-destructive"
            onClick={handleDelete}
            disabled={deleteForm.isPending}
          >
            <Trash2 className="mr-1 h-3 w-3" />
            Delete
          </Button>
        )}
      </div>

      {/* Main content */}
      {isPreviewMode ? (
        <FormPreview form={form} />
      ) : (
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={handleDragEnd}
        >
          <div className="flex flex-1 min-h-0">
            {/* Left: Palette */}
            <div className="w-56 border-r shrink-0">
              <FieldPalette onAddField={addField} disabled={!canEdit} />
            </div>

            {/* Center: Canvas */}
            <div className="flex-1 flex flex-col p-4">
              {!canEdit && (
                <div className="mb-3 rounded-lg bg-muted px-3 py-2 text-sm text-muted-foreground">
                  This form is {form.status.toLowerCase()} and cannot be edited.
                  Duplicate it to make changes.
                </div>
              )}
              <FormCanvas
                fields={form.fields}
                selectedFieldId={selectedFieldId}
                onSelectField={setSelectedFieldId}
                onRemoveField={(fieldId) =>
                  removeField.mutate({ id: formId, fieldId })
                }
                onReorder={(fieldIds) =>
                  reorderFields.mutate({ id: formId, fieldIds })
                }
              />
            </div>

            {/* Right: Properties */}
            <div className="w-72 border-l shrink-0">
              {selectedField ? (
                <FieldPropertiesPanel
                  field={selectedField}
                  onUpdate={handleUpdateField}
                  isSaving={updateField.isPending}
                />
              ) : (
                <div className="flex items-center justify-center h-full text-sm text-muted-foreground p-4 text-center">
                  Select a field to edit its properties
                </div>
              )}
            </div>
          </div>
        </DndContext>
      )}
    </div>
  );
}
