"use client";

import { useState, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { trpc } from "@/lib/trpc";
import {
  DynamicFormFields,
  buildFormFieldsSchema,
  mapFieldErrorsToForm,
} from "./form-renderer";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Separator } from "@/components/ui/separator";
import { FileUpload } from "./file-upload";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";

const formSchema = z.object({
  title: z.string().min(1, "Title is required").max(500),
  content: z.string().max(50000).optional(),
  coverLetter: z.string().max(10000).optional(),
});

interface SubmissionFormProps {
  mode: "create" | "edit";
  submissionId?: string;
}

export function SubmissionForm({ mode, submissionId }: SubmissionFormProps) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const utils = trpc.useUtils();

  // Fetch existing submission for edit mode
  const { data: existingSubmission, isPending: isLoadingSubmission } =
    trpc.submissions.getById.useQuery(
      { id: submissionId! },
      { enabled: mode === "edit" && !!submissionId },
    );

  // Fetch files for the submission (v2: listBySubmission)
  const { data: existingFiles } = trpc.files.listBySubmission.useQuery(
    { submissionId: submissionId! },
    { enabled: mode === "edit" && !!submissionId },
  );

  // Fetch form definition when submission has one
  const formDefinitionId = existingSubmission?.formDefinitionId;
  const { data: formDefinition } = trpc.forms.getById.useQuery(
    { id: formDefinitionId ?? "" },
    { enabled: !!formDefinitionId },
  );

  // Build dynamic schema from form definition fields
  const { schema: formDataSchema, defaultValues: formDataDefaults } = useMemo(
    () =>
      formDefinition
        ? buildFormFieldsSchema(formDefinition.fields)
        : { schema: z.object({}), defaultValues: {} },
    [formDefinition],
  );
  const fullSchema = useMemo(
    () => formSchema.extend({ formData: formDataSchema }),
    [formDataSchema],
  );

  const form = useForm({
    resolver: zodResolver(fullSchema),
    defaultValues: {
      title: "",
      content: "",
      coverLetter: "",
      formData: formDataDefaults,
    },
  });

  // Populate form when editing (re-runs when formDefinition loads to apply defaults)
  useEffect(() => {
    if (existingSubmission && mode === "edit") {
      form.reset({
        title: existingSubmission.title ?? "",
        content: existingSubmission.content ?? "",
        coverLetter: existingSubmission.coverLetter ?? "",
        formData: {
          ...formDataDefaults,
          ...(existingSubmission.formData as Record<string, unknown> | null),
        },
      });
    }
  }, [existingSubmission, mode, form, formDefinition, formDataDefaults]);

  // Create mutation
  const createMutation = trpc.submissions.create.useMutation({
    onSuccess: (data) => {
      toast.success("Submission created");
      router.push(`/submissions/${data.id}`);
    },
    onError: (err) => {
      setError(err.message);
    },
  });

  // Update mutation (v2: flattened input)
  const updateMutation = trpc.submissions.update.useMutation({
    onSuccess: () => {
      toast.success("Submission saved");
      utils.submissions.getById.invalidate({ id: submissionId! });
    },
    onError: (err) => {
      setError(err.message);
    },
  });

  // Submit mutation (for submitting draft)
  const submitMutation = trpc.submissions.submit.useMutation({
    onSuccess: async () => {
      toast.success("Submission submitted!");
      await utils.submissions.getById.invalidate({ id: submissionId! });
      await utils.submissions.getHistory.invalidate({
        submissionId: submissionId!,
      });
      router.push(`/submissions/${submissionId}`);
    },
    onError: (err) => {
      // Map field-level validation errors to form fields; fall back to generic error
      if (!mapFieldErrorsToForm(err, form.setError)) {
        setError(err.message);
      }
    },
  });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const onSubmit = async (data: any) => {
    setError(null);
    const { formData, ...rest } = data;

    if (mode === "create") {
      await createMutation.mutateAsync({ ...rest, formData });
    } else if (submissionId) {
      // v2: flattened input — { id, ...data } instead of { id, data }
      await updateMutation.mutateAsync({
        id: submissionId,
        ...rest,
        formData,
      });
    }
  };

  const handleSubmitForReview = async () => {
    if (!submissionId) return;

    // Validate form first
    const isValid = await form.trigger();
    if (!isValid) return;

    // Save changes first (v2: flattened input)
    const data = form.getValues();
    const { formData, ...rest } = data;
    await updateMutation.mutateAsync({
      id: submissionId,
      ...rest,
      formData,
    });

    // Check for pending/infected files
    if (
      existingFiles?.some(
        (f) => f.scanStatus === "PENDING" || f.scanStatus === "SCANNING",
      )
    ) {
      toast.error("Please wait for file scans to complete");
      return;
    }

    if (existingFiles?.some((f) => f.scanStatus === "INFECTED")) {
      toast.error("Please remove infected files before submitting");
      return;
    }

    // Submit (field errors mapped in onError callback)
    await submitMutation.mutateAsync({ id: submissionId });
  };

  const isLoading =
    createMutation.isPending ||
    updateMutation.isPending ||
    submitMutation.isPending;

  const canEdit = existingSubmission?.status === "DRAFT" || mode === "create";

  if (mode === "edit" && isLoadingSubmission) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (mode === "edit" && existingSubmission && !canEdit) {
    return (
      <Alert>
        <AlertDescription>
          This submission cannot be edited because it has already been
          submitted.
        </AlertDescription>
      </Alert>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">
          {mode === "create" ? "New Submission" : "Edit Submission"}
        </h1>
        <p className="text-muted-foreground">
          {mode === "create"
            ? "Create a new submission for review"
            : "Make changes to your draft submission"}
        </p>
      </div>

      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Submission Details</CardTitle>
              <CardDescription>
                Provide the details for your submission
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <FormField
                control={form.control}
                name="title"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Title *</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="Enter submission title"
                        disabled={!canEdit}
                        {...field}
                      />
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
                        placeholder="Enter your submission content (optional if uploading files)"
                        className="min-h-[200px]"
                        disabled={!canEdit}
                        {...field}
                      />
                    </FormControl>
                    <FormDescription>
                      You can paste your text here or upload files below
                    </FormDescription>
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
                        placeholder="Optional cover letter or notes for the editors"
                        className="min-h-[100px]"
                        disabled={!canEdit}
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </CardContent>
          </Card>

          {/* Dynamic form fields — shown when submission links to a form */}
          {formDefinitionId && (
            <DynamicFormFields
              formDefinitionId={formDefinitionId}
              disabled={!canEdit}
            />
          )}

          {/* File upload - only shown after creation */}
          {mode === "edit" && submissionId && (
            <Card>
              <CardHeader>
                <CardTitle>Files</CardTitle>
                <CardDescription>
                  Upload supporting documents for your submission
                </CardDescription>
              </CardHeader>
              <CardContent>
                <FileUpload submissionId={submissionId} disabled={!canEdit} />
              </CardContent>
            </Card>
          )}

          <Separator />

          {/* Actions */}
          <div className="flex justify-between">
            <Button
              type="button"
              variant="outline"
              onClick={() => router.back()}
            >
              Cancel
            </Button>

            <div className="flex gap-2">
              <Button type="submit" disabled={isLoading || !canEdit}>
                {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {mode === "create" ? "Create Draft" : "Save Draft"}
              </Button>

              {mode === "edit" && submissionId && (
                <Button
                  type="button"
                  onClick={handleSubmitForReview}
                  disabled={isLoading || !canEdit}
                >
                  {submitMutation.isPending && (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  )}
                  Submit for Review
                </Button>
              )}
            </div>
          </div>
        </form>
      </Form>
    </div>
  );
}
