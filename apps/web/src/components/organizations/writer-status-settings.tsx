"use client";

import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { trpc } from "@/lib/trpc";
import { useOrganization } from "@/hooks/use-organization";
import {
  DEFAULT_WRITER_STATUS_LABELS,
  WRITER_STATUS_DESCRIPTIONS,
  writerStatusSchema,
  type WriterStatus,
  type UpdateOrganizationInput,
} from "@colophony/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { toast } from "sonner";
import { Loader2, RotateCcw } from "lucide-react";

const WRITER_STATUSES = writerStatusSchema.options;

type FormData = Record<WriterStatus, string>;

export function WriterStatusSettings() {
  const { isAdmin } = useOrganization();
  const utils = trpc.useUtils();

  const { data: org } = trpc.organizations.get.useQuery();

  const currentLabels =
    ((org?.settings as Record<string, unknown>)?.writerStatusLabels as
      | Partial<Record<WriterStatus, string>>
      | undefined) ?? {};

  const form = useForm<FormData>({
    defaultValues: Object.fromEntries(
      WRITER_STATUSES.map((s) => [s, ""]),
    ) as FormData,
  });

  useEffect(() => {
    if (org) {
      const values = Object.fromEntries(
        WRITER_STATUSES.map((s) => [s, currentLabels[s] ?? ""]),
      ) as FormData;
      form.reset(values);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [org]);

  const updateMutation = trpc.organizations.update.useMutation({
    onSuccess: () => {
      utils.organizations.get.invalidate();
      toast.success("Writer status names updated");
    },
    onError: (err) => {
      toast.error(err.message);
    },
  });

  const onSubmit = (data: FormData) => {
    // Only include non-empty overrides (empty = use default)
    const overrides: Record<string, string> = {};
    for (const status of WRITER_STATUSES) {
      const value = data[status].trim();
      if (value && value !== DEFAULT_WRITER_STATUS_LABELS[status]) {
        overrides[status] = value;
      }
    }

    const { writerStatusLabels: _, ...rest } =
      (org?.settings as UpdateOrganizationInput["settings"]) ?? {};
    const settings =
      Object.keys(overrides).length > 0
        ? { ...rest, writerStatusLabels: overrides }
        : rest;
    updateMutation.mutate({ settings });
  };

  const handleReset = () => {
    form.reset(
      Object.fromEntries(WRITER_STATUSES.map((s) => [s, ""])) as FormData,
    );
    const { writerStatusLabels: _, ...rest } =
      (org?.settings as UpdateOrganizationInput["settings"]) ?? {};
    updateMutation.mutate({ settings: rest });
  };

  if (!isAdmin) return null;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Writer-Facing Status Names</CardTitle>
        <CardDescription>
          Customize how submission statuses appear to writers. Each label covers
          one or more internal editorial states.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
          {WRITER_STATUSES.map((status) => (
            <div key={status} className="flex items-start gap-4">
              <div className="flex-1">
                <Label
                  htmlFor={`status-${status}`}
                  className="text-sm font-medium"
                >
                  {DEFAULT_WRITER_STATUS_LABELS[status]}
                </Label>
                <Input
                  id={`status-${status}`}
                  placeholder={DEFAULT_WRITER_STATUS_LABELS[status]}
                  {...form.register(status)}
                  className="mt-1"
                />
              </div>
              <p className="flex-1 text-xs text-muted-foreground pt-6">
                {WRITER_STATUS_DESCRIPTIONS[status]}
              </p>
            </div>
          ))}

          <div className="flex gap-2 pt-2">
            <Button type="submit" disabled={updateMutation.isPending}>
              {updateMutation.isPending && (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              )}
              Save
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={handleReset}
              disabled={updateMutation.isPending}
            >
              <RotateCcw className="mr-2 h-4 w-4" />
              Reset to Defaults
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
