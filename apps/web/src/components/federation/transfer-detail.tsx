"use client";

import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
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
import { format } from "date-fns";

const STATUS_COLORS: Record<string, string> = {
  PENDING: "border-status-warning text-status-warning",
  FILES_REQUESTED: "border-status-info text-status-info",
  COMPLETED: "border-status-success text-status-success",
  REJECTED: "border-status-error text-status-error",
  FAILED: "border-status-error text-status-error",
  CANCELLED: "border-status-info text-status-info",
  EXPIRED: "border-status-info text-status-info",
};

const CANCELLABLE_STATUSES = new Set(["PENDING", "FILES_REQUESTED"]);

interface TransferDetailProps {
  transferId: string;
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function TransferDetail({ transferId }: TransferDetailProps) {
  const utils = trpc.useUtils();

  const {
    data: transfer,
    isPending: isLoading,
    error,
  } = trpc.transfers.getById.useQuery({ id: transferId });

  const cancelMutation = trpc.transfers.cancel.useMutation({
    onSuccess: () => {
      toast.success("Transfer cancelled");
      utils.transfers.getById.invalidate({ id: transferId });
      utils.transfers.list.invalidate();
    },
    onError: (err) => toast.error(err.message),
  });

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (error || !transfer) {
    return (
      <div className="space-y-6">
        <Button variant="ghost" size="sm" asChild>
          <Link href="/federation/transfers">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Transfers
          </Link>
        </Button>
        <p className="text-muted-foreground">Transfer not found.</p>
      </div>
    );
  }

  const fileManifest = (transfer.fileManifest ?? []) as Array<{
    filename: string;
    mimeType: string;
    size: number;
  }>;

  return (
    <div className="space-y-6">
      <Button variant="ghost" size="sm" asChild>
        <Link href="/federation/transfers">
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to Transfers
        </Link>
      </Button>

      <div className="flex items-center gap-3">
        <h1 className="text-2xl font-bold">Transfer Detail</h1>
        <Badge
          variant="outline"
          className={STATUS_COLORS[transfer.status] ?? ""}
        >
          {transfer.status.replace(/_/g, " ")}
        </Badge>
      </div>

      {/* Info card */}
      <Card>
        <CardHeader>
          <CardTitle>Transfer Information</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div className="space-y-3">
              <div>
                <span className="text-sm font-medium text-muted-foreground">
                  Submission ID
                </span>
                <p className="text-sm font-mono">{transfer.submissionId}</p>
              </div>
              <div>
                <span className="text-sm font-medium text-muted-foreground">
                  Target Domain
                </span>
                <p className="text-sm">{transfer.targetDomain}</p>
              </div>
              <div>
                <span className="text-sm font-medium text-muted-foreground">
                  Submitter DID
                </span>
                <p className="text-sm font-mono">
                  {transfer.submitterDid ?? "—"}
                </p>
              </div>
              <div>
                <span className="text-sm font-medium text-muted-foreground">
                  Content Fingerprint
                </span>
                <p className="text-sm font-mono">
                  {transfer.contentFingerprint ?? "—"}
                </p>
              </div>
            </div>
            <div className="space-y-3">
              <div>
                <span className="text-sm font-medium text-muted-foreground">
                  Token Expires
                </span>
                <p className="text-sm">
                  {transfer.tokenExpiresAt
                    ? format(new Date(transfer.tokenExpiresAt), "PPpp")
                    : "—"}
                </p>
              </div>
              <div>
                <span className="text-sm font-medium text-muted-foreground">
                  Created
                </span>
                <p className="text-sm">
                  {format(new Date(transfer.createdAt), "PPpp")}
                </p>
              </div>
              <div>
                <span className="text-sm font-medium text-muted-foreground">
                  Completed
                </span>
                <p className="text-sm">
                  {transfer.completedAt
                    ? format(new Date(transfer.completedAt), "PPpp")
                    : "—"}
                </p>
              </div>
              {transfer.failureReason && (
                <div>
                  <span className="text-sm font-medium text-muted-foreground">
                    Failure Reason
                  </span>
                  <p className="text-sm text-destructive">
                    {transfer.failureReason}
                  </p>
                </div>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* File manifest */}
      {fileManifest.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>File Manifest</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Filename</TableHead>
                  <TableHead>MIME Type</TableHead>
                  <TableHead>Size</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {fileManifest.map((file, i) => (
                  <TableRow key={i}>
                    <TableCell>{file.filename}</TableCell>
                    <TableCell className="text-muted-foreground">
                      {file.mimeType}
                    </TableCell>
                    <TableCell>{formatBytes(file.size)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {/* Cancel action */}
      {CANCELLABLE_STATUSES.has(transfer.status) && (
        <Card>
          <CardHeader>
            <CardTitle>Actions</CardTitle>
          </CardHeader>
          <CardContent>
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="destructive">Cancel Transfer</Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Cancel Transfer</AlertDialogTitle>
                  <AlertDialogDescription>
                    Are you sure you want to cancel this transfer to{" "}
                    <strong>{transfer.targetDomain}</strong>? This action cannot
                    be undone.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Keep Transfer</AlertDialogCancel>
                  <AlertDialogAction
                    onClick={() => cancelMutation.mutate({ id: transferId })}
                  >
                    Cancel Transfer
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
