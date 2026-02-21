"use client";

import { trpc } from "@/lib/trpc";
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
import { Separator } from "@/components/ui/separator";
import type { FormFieldForRenderer } from "./build-form-schema";

interface ReadOnlyFormFieldsProps {
  formDefinitionId: string;
  formData: Record<string, unknown>;
}

export function ReadOnlyFormFields({
  formDefinitionId,
  formData,
}: ReadOnlyFormFieldsProps) {
  const {
    data: formDefinition,
    isPending,
    error,
  } = trpc.forms.getById.useQuery({ id: formDefinitionId });

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
    <ReadOnlyFieldRenderer
      formDefinition={formDefinition}
      fields={fields}
      formData={formData}
    />
  );
}

/** Inner component to keep useConditionalFields unconditional (hooks safety). */
function ReadOnlyFieldRenderer({
  formDefinition,
  fields,
  formData,
}: {
  formDefinition: { name: string; description: string | null };
  fields: FormFieldForRenderer[];
  formData: Record<string, unknown>;
}) {
  const visibilityMap = useConditionalFields(fields, formData);

  return (
    <Card>
      <CardHeader>
        <CardTitle>{formDefinition.name}</CardTitle>
        {formDefinition.description && (
          <CardDescription>{formDefinition.description}</CardDescription>
        )}
      </CardHeader>
      <CardContent className="space-y-4">
        {fields.map((field) => {
          const vis = visibilityMap.get(field.fieldKey);
          if (vis && !vis.visible) return null;

          return (
            <ReadOnlyFieldValue
              key={field.fieldKey}
              field={field}
              value={formData[field.fieldKey]}
            />
          );
        })}
      </CardContent>
    </Card>
  );
}

function ReadOnlyFieldValue({
  field,
  value,
}: {
  field: FormFieldForRenderer;
  value: unknown;
}) {
  const config = (field.config ?? {}) as Record<string, unknown>;
  const options =
    (config.options as Array<{ label: string; value: string }>) ?? [];

  switch (field.fieldType) {
    case "section_header":
      return (
        <div className="pt-4">
          <h3 className="text-lg font-semibold">{field.label}</h3>
          {field.description && (
            <p className="text-sm text-muted-foreground">{field.description}</p>
          )}
          <Separator className="mt-2" />
        </div>
      );

    case "info_text":
      return (
        <div className="rounded-lg bg-muted p-3 text-sm text-muted-foreground">
          {field.description ?? field.label}
        </div>
      );

    case "file_upload":
      return null;

    case "checkbox": {
      const checked = value === true;
      return (
        <div className="space-y-1">
          <p className="text-sm font-medium">{field.label}</p>
          <p className="text-sm">{checked ? "Yes" : "No"}</p>
        </div>
      );
    }

    case "select":
    case "radio": {
      const rawValue = value as string | undefined | null;
      const optionLabel = options.find((o) => o.value === rawValue)?.label;
      return (
        <div className="space-y-1">
          <p className="text-sm font-medium">{field.label}</p>
          {rawValue ? (
            <p className="text-sm">{optionLabel ?? rawValue}</p>
          ) : (
            <p className="text-sm text-muted-foreground">Not provided</p>
          )}
        </div>
      );
    }

    case "multi_select":
    case "checkbox_group": {
      const values = Array.isArray(value) ? (value as string[]) : [];
      const labels = values.map(
        (v) => options.find((o) => o.value === v)?.label ?? v,
      );
      return (
        <div className="space-y-1">
          <p className="text-sm font-medium">{field.label}</p>
          {labels.length > 0 ? (
            <p className="text-sm">{labels.join(", ")}</p>
          ) : (
            <p className="text-sm text-muted-foreground">Not provided</p>
          )}
        </div>
      );
    }

    default: {
      const displayValue =
        value !== undefined && value !== null && value !== ""
          ? String(value)
          : null;
      return (
        <div className="space-y-1">
          <p className="text-sm font-medium">{field.label}</p>
          {displayValue ? (
            <p className="text-sm">{displayValue}</p>
          ) : (
            <p className="text-sm text-muted-foreground">Not provided</p>
          )}
        </div>
      );
    }
  }
}
