"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { format } from "date-fns";
import { trpc } from "@/lib/trpc";
import { renderMergeFields } from "@/lib/tiptap-serialization";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import { ArrowLeft, Pencil, Trash2 } from "lucide-react";

interface ContractTemplateDetailProps {
  templateId: string;
}

export function ContractTemplateDetail({
  templateId,
}: ContractTemplateDetailProps) {
  const router = useRouter();
  const utils = trpc.useUtils();
  const [deleteOpen, setDeleteOpen] = useState(false);

  const { data: template, isPending: isLoading } =
    trpc.contractTemplates.getById.useQuery({ id: templateId });

  const deleteMutation = trpc.contractTemplates.delete.useMutation({
    onSuccess: () => {
      toast.success("Template deleted");
      utils.contractTemplates.list.invalidate();
      router.push("/slate/contracts/templates");
    },
    onError: (err) => toast.error(err.message),
  });

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-64" />
        <div className="grid gap-6 md:grid-cols-3">
          <Skeleton className="h-96 md:col-span-2" />
          <Skeleton className="h-48" />
        </div>
      </div>
    );
  }

  if (!template) {
    return (
      <div className="text-center py-12">
        <p className="text-muted-foreground">Template not found</p>
        <Link href="/slate/contracts/templates">
          <Button variant="link">Back to templates</Button>
        </Link>
      </div>
    );
  }

  const mergeFields = (template.mergeFields ?? []) as Array<{
    key: string;
    label: string;
    source: string;
    defaultValue?: string;
  }>;

  // Build preview with defaults or [key]
  const previewData: Record<string, string> = {};
  for (const field of mergeFields) {
    previewData[field.key] = field.defaultValue || `[${field.key}]`;
  }
  const previewBody = renderMergeFields(template.body, previewData);

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <Link
          href="/slate/contracts/templates"
          className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="mr-1 h-4 w-4" />
          Back to templates
        </Link>
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold">{template.name}</h1>
          <div className="flex items-center gap-2">
            <Link href={`/slate/contracts/templates/${templateId}/edit`}>
              <Button variant="outline">
                <Pencil className="mr-2 h-4 w-4" />
                Edit
              </Button>
            </Link>
            <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
              <AlertDialogTrigger asChild>
                <Button variant="destructive">
                  <Trash2 className="mr-2 h-4 w-4" />
                  Delete
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Delete Template</AlertDialogTitle>
                  <AlertDialogDescription>
                    Are you sure you want to delete &ldquo;{template.name}
                    &rdquo;? This action cannot be undone.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction
                    onClick={() => deleteMutation.mutate({ id: templateId })}
                    className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                  >
                    Delete
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-3">
        {/* Main — Body preview */}
        <Card className="md:col-span-2">
          <CardHeader>
            <CardTitle>Contract Body</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="prose prose-sm max-w-none whitespace-pre-wrap">
              {previewBody}
            </div>
          </CardContent>
        </Card>

        {/* Sidebar */}
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Details</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {template.description && (
                <div>
                  <p className="text-sm font-medium text-muted-foreground">
                    Description
                  </p>
                  <p className="text-sm mt-1">{template.description}</p>
                </div>
              )}
              <div>
                <p className="text-sm font-medium text-muted-foreground">
                  Default
                </p>
                <div className="mt-1">
                  {template.isDefault ? (
                    <Badge variant="secondary">Default Template</Badge>
                  ) : (
                    <span className="text-sm text-muted-foreground">No</span>
                  )}
                </div>
              </div>
              <div>
                <p className="text-sm font-medium text-muted-foreground">
                  Created
                </p>
                <p className="text-sm mt-1">
                  {format(new Date(template.createdAt), "PPP")}
                </p>
              </div>
              <div>
                <p className="text-sm font-medium text-muted-foreground">
                  Updated
                </p>
                <p className="text-sm mt-1">
                  {format(new Date(template.updatedAt), "PPP")}
                </p>
              </div>
            </CardContent>
          </Card>

          {mergeFields.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Merge Fields</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {mergeFields.map((field) => (
                    <div
                      key={field.key}
                      className="flex items-center justify-between text-sm"
                    >
                      <span>{field.label}</span>
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className="text-xs">
                          {field.source}
                        </Badge>
                        <code className="text-xs text-muted-foreground">
                          {`{{${field.key}}}`}
                        </code>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
