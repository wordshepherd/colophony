"use client";

import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { JournalAutocomplete } from "./journal-autocomplete";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";

const formSchema = z.object({
  journalName: z.string().min(1, "Journal name is required").max(500),
  journalDirectoryId: z.string().uuid().optional(),
  manuscriptId: z.string().uuid().optional(),
  status: z.enum([
    "draft",
    "sent",
    "in_review",
    "hold",
    "accepted",
    "rejected",
    "withdrawn",
    "no_response",
    "revise",
    "unknown",
  ]),
  sentAt: z.string().optional(),
  respondedAt: z.string().optional(),
  method: z.string().max(100).optional(),
  notes: z.string().optional(),
});

type FormData = z.infer<typeof formSchema>;

const STATUS_OPTIONS = [
  { value: "draft", label: "Draft" },
  { value: "sent", label: "Sent" },
  { value: "in_review", label: "In Review" },
  { value: "hold", label: "On Hold" },
  { value: "accepted", label: "Accepted" },
  { value: "rejected", label: "Rejected" },
  { value: "withdrawn", label: "Withdrawn" },
  { value: "no_response", label: "No Response" },
  { value: "revise", label: "Revise" },
];

interface ExternalSubmissionFormProps {
  initialData?: {
    id: string;
    journalName: string;
    journalDirectoryId?: string | null;
    manuscriptId?: string | null;
    status: string;
    sentAt?: string | Date | null;
    respondedAt?: string | Date | null;
    method?: string | null;
    notes?: string | null;
  };
}

export function ExternalSubmissionForm({
  initialData,
}: ExternalSubmissionFormProps) {
  const router = useRouter();
  const utils = trpc.useUtils();
  const isEdit = !!initialData;

  const form = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      journalName: initialData?.journalName ?? "",
      journalDirectoryId: initialData?.journalDirectoryId ?? undefined,
      manuscriptId: initialData?.manuscriptId ?? undefined,
      status: (initialData?.status as FormData["status"]) ?? "sent",
      sentAt: initialData?.sentAt
        ? new Date(initialData.sentAt).toISOString().slice(0, 16)
        : undefined,
      respondedAt: initialData?.respondedAt
        ? new Date(initialData.respondedAt).toISOString().slice(0, 16)
        : undefined,
      method: initialData?.method ?? undefined,
      notes: initialData?.notes ?? undefined,
    },
  });

  const createMutation = trpc.externalSubmissions.create.useMutation({
    onSuccess: () => {
      utils.externalSubmissions.list.invalidate();
      utils.workspace.stats.invalidate();
      router.push("/workspace/external");
    },
  });

  const updateMutation = trpc.externalSubmissions.update.useMutation({
    onSuccess: () => {
      utils.externalSubmissions.list.invalidate();
      utils.externalSubmissions.getById.invalidate();
      utils.workspace.stats.invalidate();
      router.push(`/workspace/external/${initialData!.id}`);
    },
  });

  const isPending = createMutation.isPending || updateMutation.isPending;
  const mutationError = createMutation.error || updateMutation.error;

  function onSubmit(data: FormData) {
    const payload = {
      ...data,
      sentAt: data.sentAt ? new Date(data.sentAt).toISOString() : undefined,
      respondedAt: data.respondedAt
        ? new Date(data.respondedAt).toISOString()
        : undefined,
    };

    if (isEdit) {
      updateMutation.mutate({ id: initialData!.id, data: payload });
    } else {
      createMutation.mutate(payload);
    }
  }

  // Manuscript selector
  const { data: manuscripts } = trpc.manuscripts.list.useQuery({
    page: 1,
    limit: 100,
  });

  return (
    <div className="space-y-6 max-w-2xl">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Link href="/workspace/external">
          <Button variant="ghost" size="icon">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <div>
          <h1 className="text-2xl font-bold">
            {isEdit ? "Edit Submission" : "Track External Submission"}
          </h1>
          <p className="text-muted-foreground">
            {isEdit
              ? "Update submission details"
              : "Record a submission to an external journal"}
          </p>
        </div>
      </div>

      {mutationError && (
        <p className="text-destructive text-sm">{mutationError.message}</p>
      )}

      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
          {/* Journal name */}
          <FormField
            control={form.control}
            name="journalName"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Journal Name</FormLabel>
                <FormControl>
                  <JournalAutocomplete
                    value={field.value}
                    onChange={(name, directoryId) => {
                      field.onChange(name);
                      if (directoryId) {
                        form.setValue("journalDirectoryId", directoryId);
                      }
                    }}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          {/* Manuscript */}
          <FormField
            control={form.control}
            name="manuscriptId"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Manuscript (optional)</FormLabel>
                <Select
                  value={field.value ?? "none"}
                  onValueChange={(v) =>
                    field.onChange(v === "none" ? undefined : v)
                  }
                >
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue placeholder="Select manuscript..." />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    <SelectItem value="none">None</SelectItem>
                    {manuscripts?.items.map((ms) => (
                      <SelectItem key={ms.id} value={ms.id}>
                        {ms.title ?? "Untitled"}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />

          {/* Status */}
          <FormField
            control={form.control}
            name="status"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Status</FormLabel>
                <Select value={field.value} onValueChange={field.onChange}>
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {STATUS_OPTIONS.map((opt) => (
                      <SelectItem key={opt.value} value={opt.value}>
                        {opt.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />

          {/* Dates */}
          <div className="grid grid-cols-2 gap-4">
            <FormField
              control={form.control}
              name="sentAt"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Sent Date</FormLabel>
                  <FormControl>
                    <Input type="datetime-local" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="respondedAt"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Response Date</FormLabel>
                  <FormControl>
                    <Input type="datetime-local" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>

          {/* Method */}
          <FormField
            control={form.control}
            name="method"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Submission Method (optional)</FormLabel>
                <FormControl>
                  <Input
                    placeholder="e.g., Submittable, email, postal"
                    {...field}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          {/* Notes */}
          <FormField
            control={form.control}
            name="notes"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Notes (optional)</FormLabel>
                <FormControl>
                  <Textarea
                    placeholder="Any notes about this submission..."
                    {...field}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          {/* Submit */}
          <div className="flex gap-3">
            <Button type="submit" disabled={isPending}>
              {isPending
                ? "Saving..."
                : isEdit
                  ? "Update Submission"
                  : "Track Submission"}
            </Button>
            <Link href="/workspace/external">
              <Button type="button" variant="outline">
                Cancel
              </Button>
            </Link>
          </div>
        </form>
      </Form>
    </div>
  );
}
