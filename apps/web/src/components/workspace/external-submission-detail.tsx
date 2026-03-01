"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
import { Skeleton } from "@/components/ui/skeleton";
import { CsrStatusBadge } from "./csr-status-badge";
import { ExternalSubmissionForm } from "./external-submission-form";
import { ArrowLeft, Pencil, Trash2 } from "lucide-react";
import { format } from "date-fns";

interface ExternalSubmissionDetailProps {
  id: string;
}

export function ExternalSubmissionDetail({
  id,
}: ExternalSubmissionDetailProps) {
  const router = useRouter();
  const utils = trpc.useUtils();
  const [isEditing, setIsEditing] = useState(false);

  const {
    data: submission,
    isPending: isLoading,
    error,
  } = trpc.externalSubmissions.getById.useQuery({ id });

  const deleteMutation = trpc.externalSubmissions.delete.useMutation({
    onSuccess: () => {
      utils.externalSubmissions.list.invalidate();
      utils.workspace.stats.invalidate();
      router.push("/workspace/external");
    },
  });

  if (isLoading) {
    return (
      <div className="space-y-4 max-w-2xl">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-64" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-12">
        <p className="text-destructive">
          Failed to load submission: {error.message}
        </p>
      </div>
    );
  }

  if (!submission) {
    return (
      <div className="text-center py-12">
        <p className="text-muted-foreground">Submission not found.</p>
      </div>
    );
  }

  if (isEditing) {
    return <ExternalSubmissionForm initialData={submission} />;
  }

  return (
    <div className="space-y-6 max-w-2xl">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link href="/workspace/external">
            <Button variant="ghost" size="icon">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
          <div>
            <h1 className="text-2xl font-bold">{submission.journalName}</h1>
            <CsrStatusBadge status={submission.status} />
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setIsEditing(true)}>
            <Pencil className="mr-2 h-4 w-4" />
            Edit
          </Button>
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="destructive">
                <Trash2 className="mr-2 h-4 w-4" />
                Delete
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Delete submission?</AlertDialogTitle>
                <AlertDialogDescription>
                  This will permanently delete this external submission record.
                  This action cannot be undone.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction
                  onClick={() => deleteMutation.mutate({ id })}
                  disabled={deleteMutation.isPending}
                >
                  {deleteMutation.isPending ? "Deleting..." : "Delete"}
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </div>

      {/* Details */}
      <Card>
        <CardHeader>
          <CardTitle>Submission Details</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <p className="font-medium text-muted-foreground">Status</p>
              <CsrStatusBadge status={submission.status} />
            </div>
            {submission.method && (
              <div>
                <p className="font-medium text-muted-foreground">Method</p>
                <p>{submission.method}</p>
              </div>
            )}
            {submission.sentAt && (
              <div>
                <p className="font-medium text-muted-foreground">Sent</p>
                <p>{format(new Date(submission.sentAt), "PPP")}</p>
              </div>
            )}
            {submission.respondedAt && (
              <div>
                <p className="font-medium text-muted-foreground">Response</p>
                <p>{format(new Date(submission.respondedAt), "PPP")}</p>
              </div>
            )}
            <div>
              <p className="font-medium text-muted-foreground">Created</p>
              <p>{format(new Date(submission.createdAt), "PPP")}</p>
            </div>
            <div>
              <p className="font-medium text-muted-foreground">Updated</p>
              <p>{format(new Date(submission.updatedAt), "PPP")}</p>
            </div>
          </div>
          {submission.notes && (
            <div>
              <p className="font-medium text-muted-foreground text-sm">Notes</p>
              <p className="text-sm whitespace-pre-wrap">{submission.notes}</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
