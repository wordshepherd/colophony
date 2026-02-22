"use client";

import { useFormContext } from "react-hook-form";
import { useConditionalFields } from "@/hooks/use-conditional-fields";
import { useWizardForm } from "@/hooks/use-wizard-form";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { FormStepper } from "@/components/ui/form-stepper";
import { DynamicFormField } from "./form-renderer/dynamic-form-field";
import { getPageFieldPaths } from "./form-renderer/build-page-schema";
import type { FormFieldForRenderer } from "./form-renderer/build-form-schema";
import type { PageBranchingRule } from "@colophony/types";
import { Loader2, ArrowLeft, ArrowRight, Send } from "lucide-react";

/** Loose form definition type compatible with tRPC serialization (dates as strings). */
interface WizardFormDefinition {
  name: string;
  description: string | null;
  fields: Array<{
    fieldKey: string;
    fieldType: string;
    label: string;
    description: string | null;
    placeholder: string | null;
    required: boolean;
    config: Record<string, unknown> | null;
    conditionalRules?: unknown;
    branchId?: string | null;
    pageId?: string | null;
    sortOrder: number;
  }>;
  pages: Array<{
    id: string;
    title: string;
    description: string | null;
    sortOrder: number;
    branchingRules: PageBranchingRule[] | null;
  }>;
}

interface WizardFormFieldsProps {
  formDefinition: WizardFormDefinition;
  disabled: boolean;
  onAutoSave: () => Promise<string | undefined>;
  isSaving: boolean;
  onSubmitForReview: () => Promise<void>;
  isSubmitting: boolean;
}

export function WizardFormFields({
  formDefinition,
  disabled,
  onAutoSave,
  isSaving,
  onSubmitForReview,
  isSubmitting,
}: WizardFormFieldsProps) {
  const formCtx = useFormContext();
  const watchedFormData =
    (formCtx.watch("formData") as Record<string, unknown>) ?? {};

  const fields = [...formDefinition.fields].sort(
    (a, b) => a.sortOrder - b.sortOrder,
  ) as FormFieldForRenderer[];

  const {
    wizardPages,
    currentStep,
    completedSteps,
    isLastStep,
    isFirstStep,
    goToNext,
    goToPrevious,
    goToStep,
    currentPageFields,
    currentPage,
    markCurrentCompleted,
  } = useWizardForm({
    pages: formDefinition.pages,
    fields,
    formValues: watchedFormData,
  });

  const visibilityMap = useConditionalFields(
    currentPageFields,
    watchedFormData,
  );

  const stepperSteps = wizardPages.map((p) => ({
    id: p.id ?? "__general__",
    title: p.title,
  }));

  const handleNext = async () => {
    // Per-page validation
    const paths = getPageFieldPaths(currentPageFields);
    if (paths.length > 0) {
      const isValid = await formCtx.trigger(paths);
      if (!isValid) return;
    }

    // Auto-save
    try {
      await onAutoSave();
    } catch {
      return;
    }

    markCurrentCompleted();
    goToNext();
  };

  const handleSubmit = async () => {
    // Validate current page
    const paths = getPageFieldPaths(currentPageFields);
    if (paths.length > 0) {
      const isValid = await formCtx.trigger(paths);
      if (!isValid) return;
    }

    await onSubmitForReview();
  };

  const isLoading = isSaving || isSubmitting;

  return (
    <div className="space-y-4">
      <FormStepper
        steps={stepperSteps}
        currentStepIndex={currentStep}
        completedStepIndices={completedSteps}
        onStepClick={goToStep}
        disabled={disabled}
      />

      <Card>
        <CardHeader>
          <CardTitle>{currentPage.title}</CardTitle>
          {currentPage.description && (
            <CardDescription>{currentPage.description}</CardDescription>
          )}
        </CardHeader>
        <CardContent className="space-y-6">
          {currentPageFields.map((field) => {
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

      <div className="flex justify-between">
        <Button
          type="button"
          variant="outline"
          onClick={goToPrevious}
          disabled={isFirstStep || isLoading || disabled}
        >
          <ArrowLeft className="mr-1 h-4 w-4" />
          Back
        </Button>

        {isLastStep ? (
          <Button
            type="button"
            onClick={handleSubmit}
            disabled={isLoading || disabled}
          >
            {isSubmitting && <Loader2 className="mr-1 h-4 w-4 animate-spin" />}
            <Send className="mr-1 h-4 w-4" />
            Submit for Review
          </Button>
        ) : (
          <Button
            type="button"
            onClick={handleNext}
            disabled={isLoading || disabled}
          >
            {isSaving && <Loader2 className="mr-1 h-4 w-4 animate-spin" />}
            Next
            <ArrowRight className="ml-1 h-4 w-4" />
          </Button>
        )}
      </div>
    </div>
  );
}
