"use client";

import { useState, useCallback } from "react";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import type { FormFieldType } from "@colophony/types";

export function useFormBuilder(formId: string) {
  const [selectedFieldId, setSelectedFieldId] = useState<string | null>(null);
  const [isPreviewMode, setIsPreviewMode] = useState(false);

  const utils = trpc.useUtils();

  const formQuery = trpc.forms.getById.useQuery({ id: formId });

  const invalidateForm = useCallback(() => {
    utils.forms.getById.invalidate({ id: formId });
    utils.forms.list.invalidate();
  }, [utils, formId]);

  const updateFormMutation = trpc.forms.update.useMutation({
    onSuccess: () => invalidateForm(),
    onError: (err) => toast.error(err.message),
  });

  const publishMutation = trpc.forms.publish.useMutation({
    onSuccess: () => {
      invalidateForm();
      toast.success("Form published");
    },
    onError: (err) => toast.error(err.message),
  });

  const archiveMutation = trpc.forms.archive.useMutation({
    onSuccess: () => {
      invalidateForm();
      toast.success("Form archived");
    },
    onError: (err) => toast.error(err.message),
  });

  const duplicateMutation = trpc.forms.duplicate.useMutation({
    onSuccess: () => {
      invalidateForm();
      toast.success("Form duplicated");
    },
    onError: (err) => toast.error(err.message),
  });

  const deleteMutation = trpc.forms.delete.useMutation({
    onError: (err) => toast.error(err.message),
  });

  const addFieldMutation = trpc.forms.addField.useMutation({
    onSuccess: (newField) => {
      invalidateForm();
      setSelectedFieldId(newField.id);
    },
    onError: (err) => toast.error(err.message),
  });

  const updateFieldMutation = trpc.forms.updateField.useMutation({
    onSuccess: () => invalidateForm(),
    onError: (err) => toast.error(err.message),
  });

  const removeFieldMutation = trpc.forms.removeField.useMutation({
    onSuccess: (removed) => {
      if (selectedFieldId === removed.id) setSelectedFieldId(null);
      invalidateForm();
    },
    onError: (err) => toast.error(err.message),
  });

  const reorderFieldsMutation = trpc.forms.reorderFields.useMutation({
    onSuccess: () => invalidateForm(),
    onError: (err) => toast.error(err.message),
  });

  const addField = useCallback(
    (fieldType: FormFieldType) => {
      const fields = formQuery.data?.fields ?? [];
      const typeCount = fields.filter((f) => f.fieldType === fieldType).length;
      const fieldKey = `${fieldType}_${typeCount + 1}`;
      const label =
        fieldType.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()) +
        (typeCount > 0 ? ` ${typeCount + 1}` : "");

      addFieldMutation.mutate({
        id: formId,
        fieldKey,
        fieldType,
        label,
        sortOrder: fields.length,
      });
    },
    [formId, formQuery.data?.fields, addFieldMutation],
  );

  const togglePreview = useCallback(() => {
    setIsPreviewMode((prev) => !prev);
    setSelectedFieldId(null);
  }, []);

  return {
    form: formQuery.data,
    isLoading: formQuery.isPending,
    error: formQuery.error,
    selectedFieldId,
    setSelectedFieldId,
    isPreviewMode,
    togglePreview,
    addField,
    updateForm: updateFormMutation,
    publishForm: publishMutation,
    archiveForm: archiveMutation,
    duplicateForm: duplicateMutation,
    deleteForm: deleteMutation,
    addFieldMutation,
    updateField: updateFieldMutation,
    removeField: removeFieldMutation,
    reorderFields: reorderFieldsMutation,
  };
}
