"use client";

import { useState, useEffect, useMemo, useRef, useCallback } from "react";
import { useDebounce } from "@/hooks/use-debounce";
import { useForm, useFormContext, FormProvider } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import {
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { DynamicFormField } from "@/components/submissions/form-renderer/dynamic-form-field";
import {
  buildFormFieldsSchema,
  buildConditionalFormSchema,
  type FormFieldForRenderer,
} from "@/components/submissions/form-renderer/build-form-schema";
import { getPageFieldPaths } from "@/components/submissions/form-renderer/build-page-schema";
import { useConditionalFields } from "@/hooks/use-conditional-fields";
import { useWizardForm } from "@/hooks/use-wizard-form";
import { EmbedUploadSection, type UploadState } from "./embed-upload-section";
import { Loader2, ArrowLeft, ArrowRight, Send } from "lucide-react";
import type {
  EmbedFormResponse,
  EmbedPrepareUploadResponse,
  PageBranchingRule,
} from "@colophony/types";

interface EmbedFormStepProps {
  formDefinition: NonNullable<EmbedFormResponse["form"]>;
  uploadContext: EmbedPrepareUploadResponse | null;
  token: string;
  apiUrl: string;
  identity: { email: string; name?: string };
  onSubmit: (data: {
    title: string;
    content?: string;
    coverLetter?: string;
    formData?: Record<string, unknown>;
    manuscriptVersionId?: string;
  }) => Promise<void>;
  isSubmitting: boolean;
}

const baseFormSchema = z.object({
  title: z.string().min(1, "Title is required").max(500),
  content: z.string().max(50000).optional(),
  coverLetter: z.string().max(10000).optional(),
});

export function EmbedFormStep({
  formDefinition,
  uploadContext,
  token,
  apiUrl,
  identity,
  onSubmit,
  isSubmitting,
}: EmbedFormStepProps) {
  const [uploadState, setUploadState] = useState<UploadState>({
    isUploading: false,
    hasInfected: false,
    allClean: false,
    fileCount: 0,
  });

  const fields = useMemo(
    () =>
      [...(formDefinition.fields as FormFieldForRenderer[])].sort(
        (a, b) =>
          ((a as unknown as { sortOrder: number }).sortOrder ?? 0) -
          ((b as unknown as { sortOrder: number }).sortOrder ?? 0),
      ),
    [formDefinition.fields],
  );

  const pages = formDefinition.pages as Array<{
    id: string;
    title: string;
    description: string | null;
    sortOrder: number;
    branchingRules: PageBranchingRule[] | null;
  }>;

  const isWizard = pages.length > 1;
  const hasFileUploadField = fields.some((f) => f.fieldType === "file_upload");

  // Build static defaults
  const { defaultValues: formDataDefaults } = useMemo(
    () => buildFormFieldsSchema(fields),
    [fields],
  );

  // schemaRef pattern from submission-form.tsx
  const schemaRef = useRef(
    baseFormSchema.extend({ formData: z.object({}).passthrough() }),
  );

  const form = useForm({
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    resolver: async (values: any, context: any, options: any) => {
      const resolver = zodResolver(schemaRef.current);
      return resolver(values, context, options);
    },
    defaultValues: {
      title: "",
      content: "",
      coverLetter: "",
      formData: formDataDefaults,
    },
  });

  // Rebuild schema reactively on formData changes (debounced to avoid thrashing)
  const watchedFormData = form.watch("formData") as Record<string, unknown>;
  const debouncedFormData = useDebounce(watchedFormData, 300);

  useEffect(() => {
    const { schema: conditionalSchema } = buildConditionalFormSchema(
      fields,
      debouncedFormData ?? {},
    );
    schemaRef.current = baseFormSchema.extend({ formData: conditionalSchema });
  }, [fields, debouncedFormData]);

  const handleUploadStateChange = useCallback((state: UploadState) => {
    setUploadState(state);
  }, []);

  const submitDisabled =
    isSubmitting ||
    uploadState.isUploading ||
    uploadState.hasInfected ||
    (uploadState.fileCount > 0 && !uploadState.allClean);

  const handleFormSubmit = form.handleSubmit(async (values) => {
    await onSubmit({
      title: values.title,
      content: values.content || undefined,
      coverLetter: values.coverLetter || undefined,
      formData: values.formData as Record<string, unknown>,
      manuscriptVersionId: uploadContext?.manuscriptVersionId,
    });
  });

  if (isWizard) {
    return (
      <FormProvider {...form}>
        <form onSubmit={handleFormSubmit}>
          <WizardFormContent
            fields={fields}
            pages={pages}
            watchedFormData={watchedFormData ?? {}}
            uploadContext={uploadContext}
            hasFileUploadField={hasFileUploadField}
            token={token}
            apiUrl={apiUrl}
            identity={identity}
            onUploadStateChange={handleUploadStateChange}
            isSubmitting={isSubmitting}
            submitDisabled={submitDisabled}
          />
        </form>
      </FormProvider>
    );
  }

  // Flat mode
  return (
    <FormProvider {...form}>
      <FlatFormContent
        fields={fields}
        watchedFormData={watchedFormData ?? {}}
        uploadContext={uploadContext}
        hasFileUploadField={hasFileUploadField}
        token={token}
        apiUrl={apiUrl}
        identity={identity}
        onUploadStateChange={handleUploadStateChange}
        isSubmitting={isSubmitting}
        submitDisabled={submitDisabled}
        onSubmit={handleFormSubmit}
      />
    </FormProvider>
  );
}

// ---------------------------------------------------------------------------
// Flat form (single page or no pages)
// ---------------------------------------------------------------------------

interface FlatFormContentProps {
  fields: FormFieldForRenderer[];
  watchedFormData: Record<string, unknown>;
  uploadContext: EmbedPrepareUploadResponse | null;
  hasFileUploadField: boolean;
  token: string;
  apiUrl: string;
  identity: { email: string; name?: string };
  onUploadStateChange: (state: UploadState) => void;
  isSubmitting: boolean;
  submitDisabled: boolean;
  onSubmit: () => void;
}

function FlatFormContent({
  fields,
  watchedFormData,
  uploadContext,
  hasFileUploadField,
  token,
  apiUrl,
  identity,
  onUploadStateChange,
  isSubmitting,
  submitDisabled,
  onSubmit,
}: FlatFormContentProps) {
  const form = useFormContext();
  const visibilityMap = useConditionalFields(fields, watchedFormData);

  return (
    <form onSubmit={onSubmit} className="space-y-6">
      <FormField
        control={form.control}
        name="title"
        render={({ field }) => (
          <FormItem>
            <FormLabel>
              Title <span className="text-destructive">*</span>
            </FormLabel>
            <FormControl>
              <Input placeholder="Submission title" {...field} />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />

      <FormField
        control={form.control}
        name="content"
        render={({ field }) => (
          <FormItem>
            <FormLabel>Content</FormLabel>
            <FormControl>
              <Textarea
                placeholder="Your submission content (optional)"
                rows={4}
                {...field}
              />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />

      <FormField
        control={form.control}
        name="coverLetter"
        render={({ field }) => (
          <FormItem>
            <FormLabel>Cover Letter</FormLabel>
            <FormControl>
              <Textarea
                placeholder="Cover letter (optional)"
                rows={3}
                {...field}
              />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />

      {fields.map((field) => {
        const vis = visibilityMap.get(field.fieldKey);
        if (vis && !vis.visible) return null;
        if (field.fieldType === "file_upload") return null;

        const effectiveField =
          vis?.required && !field.required
            ? { ...field, required: true }
            : field;

        return (
          <DynamicFormField
            key={field.fieldKey}
            field={effectiveField}
            disabled={isSubmitting}
          />
        );
      })}

      {hasFileUploadField && uploadContext && (
        <EmbedUploadSection
          token={token}
          apiUrl={apiUrl}
          uploadContext={uploadContext}
          identity={identity}
          disabled={isSubmitting}
          onUploadStateChange={onUploadStateChange}
        />
      )}

      <Button type="submit" className="w-full" disabled={submitDisabled}>
        {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
        <Send className="mr-1 h-4 w-4" />
        Submit
      </Button>
    </form>
  );
}

// ---------------------------------------------------------------------------
// Wizard form (multiple pages)
// ---------------------------------------------------------------------------

interface WizardFormContentProps {
  fields: FormFieldForRenderer[];
  pages: Array<{
    id: string;
    title: string;
    description: string | null;
    sortOrder: number;
    branchingRules: PageBranchingRule[] | null;
  }>;
  watchedFormData: Record<string, unknown>;
  uploadContext: EmbedPrepareUploadResponse | null;
  hasFileUploadField: boolean;
  token: string;
  apiUrl: string;
  identity: { email: string; name?: string };
  onUploadStateChange: (state: UploadState) => void;
  isSubmitting: boolean;
  submitDisabled: boolean;
}

function WizardFormContent({
  fields,
  pages,
  watchedFormData,
  uploadContext,
  hasFileUploadField,
  token,
  apiUrl,
  identity,
  onUploadStateChange,
  isSubmitting,
  submitDisabled,
}: WizardFormContentProps) {
  const formCtx = useFormContext();

  const {
    wizardPages,
    currentStep,
    isLastStep,
    isFirstStep,
    goToNext,
    goToPrevious,
    currentPageFields,
    currentPage,
    markCurrentCompleted,
  } = useWizardForm({
    pages,
    fields,
    formValues: watchedFormData,
  });

  const allFieldsVisibility = useConditionalFields(fields, watchedFormData);
  const currentPageFieldKeys = new Set(
    currentPageFields.map((f) => f.fieldKey),
  );
  const visibilityMap = new Map(
    [...allFieldsVisibility].filter(([key]) => currentPageFieldKeys.has(key)),
  );

  const handleNext = async () => {
    const paths = getPageFieldPaths(currentPageFields);
    if (paths.length > 0) {
      const isValid = await formCtx.trigger(paths);
      if (!isValid) return;
    }
    markCurrentCompleted();
    goToNext();
  };

  return (
    <div className="space-y-4">
      {/* Page indicator */}
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <span>
          Page {currentStep + 1} of {wizardPages.length}
        </span>
        <span className="font-medium text-foreground">{currentPage.title}</span>
      </div>

      {currentPage.description && (
        <p className="text-sm text-muted-foreground">
          {currentPage.description}
        </p>
      )}

      {/* First page includes title/content/coverLetter */}
      {currentStep === 0 && (
        <div className="space-y-6">
          <FormField
            control={formCtx.control}
            name="title"
            render={({ field }) => (
              <FormItem>
                <FormLabel>
                  Title <span className="text-destructive">*</span>
                </FormLabel>
                <FormControl>
                  <Input placeholder="Submission title" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={formCtx.control}
            name="content"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Content</FormLabel>
                <FormControl>
                  <Textarea
                    placeholder="Your submission content (optional)"
                    rows={4}
                    {...field}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={formCtx.control}
            name="coverLetter"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Cover Letter</FormLabel>
                <FormControl>
                  <Textarea
                    placeholder="Cover letter (optional)"
                    rows={3}
                    {...field}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>
      )}

      {/* Dynamic fields for current page */}
      <div className="space-y-6">
        {currentPageFields.map((field) => {
          const vis = visibilityMap.get(field.fieldKey);
          if (vis && !vis.visible) return null;
          if (field.fieldType === "file_upload") return null;

          const effectiveField =
            vis?.required && !field.required
              ? { ...field, required: true }
              : field;

          return (
            <DynamicFormField
              key={field.fieldKey}
              field={effectiveField}
              disabled={isSubmitting}
            />
          );
        })}
      </div>

      {/* File uploads on last step */}
      {isLastStep && hasFileUploadField && uploadContext && (
        <EmbedUploadSection
          token={token}
          apiUrl={apiUrl}
          uploadContext={uploadContext}
          identity={identity}
          disabled={isSubmitting}
          onUploadStateChange={onUploadStateChange}
        />
      )}

      {/* Navigation */}
      <div className="flex justify-between pt-4">
        <Button
          type="button"
          variant="outline"
          onClick={goToPrevious}
          disabled={isFirstStep || isSubmitting}
        >
          <ArrowLeft className="mr-1 h-4 w-4" />
          Back
        </Button>

        {isLastStep ? (
          <Button type="submit" disabled={submitDisabled}>
            {isSubmitting && <Loader2 className="mr-1 h-4 w-4 animate-spin" />}
            <Send className="mr-1 h-4 w-4" />
            Submit
          </Button>
        ) : (
          <Button type="button" onClick={handleNext} disabled={isSubmitting}>
            Next
            <ArrowRight className="ml-1 h-4 w-4" />
          </Button>
        )}
      </div>
    </div>
  );
}
