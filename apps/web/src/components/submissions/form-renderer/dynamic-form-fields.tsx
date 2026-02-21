"use client";

import { trpc } from "@/lib/trpc";
import { useFormContext } from "react-hook-form";
import { useConditionalFields } from "@/hooks/use-conditional-fields";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Skeleton } from "@/components/ui/skeleton";
import { DynamicFormField } from "./dynamic-form-field";
import type { FormFieldForRenderer } from "./build-form-schema";

interface DynamicFormFieldsProps {
  formDefinitionId: string;
  disabled: boolean;
}

export function DynamicFormFields({
  formDefinitionId,
  disabled,
}: DynamicFormFieldsProps) {
  const {
    data: formDefinition,
    isPending,
    error,
  } = trpc.forms.getById.useQuery({ id: formDefinitionId });

  // Must call hooks before any early returns (rules of hooks)
  const formCtx = useFormContext();
  const watchedFormData = formCtx?.watch("formData") as
    | Record<string, unknown>
    | undefined;

  if (isPending) {
    return (
      <Card>
        <CardHeader>
          <Skeleton className="h-6 w-48" />
          <Skeleton className="h-4 w-72 mt-1" />
        </CardHeader>
        <CardContent className="space-y-6">
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Alert variant="destructive">
        <AlertDescription>
          Failed to load form: {error.message}
        </AlertDescription>
      </Alert>
    );
  }

  if (!formDefinition) return null;

  const fields = [...formDefinition.fields].sort(
    (a, b) => a.sortOrder - b.sortOrder,
  ) as FormFieldForRenderer[];

  return (
    <ConditionalFieldRenderer
      formDefinition={formDefinition}
      fields={fields}
      formValues={watchedFormData ?? {}}
      disabled={disabled}
    />
  );
}

/** Inner component to use the hook unconditionally. */
function ConditionalFieldRenderer({
  formDefinition,
  fields,
  formValues,
  disabled,
}: {
  formDefinition: { name: string; description: string | null };
  fields: FormFieldForRenderer[];
  formValues: Record<string, unknown>;
  disabled: boolean;
}) {
  const visibilityMap = useConditionalFields(fields, formValues);

  return (
    <Card>
      <CardHeader>
        <CardTitle>{formDefinition.name}</CardTitle>
        {formDefinition.description && (
          <CardDescription>{formDefinition.description}</CardDescription>
        )}
      </CardHeader>
      <CardContent className="space-y-6">
        {fields.map((field) => {
          const vis = visibilityMap.get(field.fieldKey);
          if (vis && !vis.visible) return null;

          const effectiveField =
            vis?.required && !field.required
              ? { ...field, required: true }
              : field;

          return (
            <DynamicFormField
              key={field.fieldKey}
              field={effectiveField}
              disabled={disabled}
            />
          );
        })}
      </CardContent>
    </Card>
  );
}
