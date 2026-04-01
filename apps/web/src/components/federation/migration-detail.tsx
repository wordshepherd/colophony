"use client";

import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { trpc } from "@/lib/trpc";
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
import { format } from "date-fns";

const STATUS_COLORS: Record<string, string> = {
  PENDING: "border-status-warning text-status-warning",
  PENDING_APPROVAL: "border-status-held text-status-held",
  APPROVED: "border-status-info text-status-info",
  BUNDLE_SENT: "border-status-info text-status-info",
  PROCESSING: "border-status-info text-status-info",
  COMPLETED: "border-status-success text-status-success",
  REJECTED: "border-status-error text-status-error",
  FAILED: "border-status-error text-status-error",
  EXPIRED: "border-status-info text-status-info",
  CANCELLED: "border-status-info text-status-info",
};

const TERMINAL_STATUSES = new Set([
  "COMPLETED",
  "REJECTED",
  "FAILED",
  "EXPIRED",
  "CANCELLED",
]);

interface MigrationDetailProps {
  migrationId: string;
}

export function MigrationDetail({ migrationId }: MigrationDetailProps) {
  const utils = trpc.useUtils();

  const {
    data: migration,
    isPending: isLoading,
    error,
  } = trpc.migrations.getById.useQuery({ id: migrationId });

  const approveMutation = trpc.migrations.approve.useMutation({
    onSuccess: () => {
      toast.success("Migration approved");
      utils.migrations.getById.invalidate({ id: migrationId });
      utils.migrations.list.invalidate();
      utils.migrations.listPending.invalidate();
    },
    onError: (err) => toast.error(err.message),
  });

  const rejectMutation = trpc.migrations.reject.useMutation({
    onSuccess: () => {
      toast.success("Migration rejected");
      utils.migrations.getById.invalidate({ id: migrationId });
      utils.migrations.list.invalidate();
      utils.migrations.listPending.invalidate();
    },
    onError: (err) => toast.error(err.message),
  });

  const cancelMutation = trpc.migrations.cancel.useMutation({
    onSuccess: () => {
      toast.success("Migration cancelled");
      utils.migrations.getById.invalidate({ id: migrationId });
      utils.migrations.list.invalidate();
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

  if (error || !migration) {
    return (
      <div className="space-y-6">
        <Button variant="ghost" size="sm" asChild>
          <Link href="/federation/migrations">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Migrations
          </Link>
        </Button>
        <p className="text-muted-foreground">Migration not found.</p>
      </div>
    );
  }

  const canApproveReject =
    migration.status === "PENDING_APPROVAL" &&
    migration.direction === "outbound";
  const canCancel = !TERMINAL_STATUSES.has(migration.status);

  return (
    <div className="space-y-6">
      <Button variant="ghost" size="sm" asChild>
        <Link href="/federation/migrations">
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to Migrations
        </Link>
      </Button>

      <div className="flex items-center gap-3">
        <h1 className="text-2xl font-bold">Migration Detail</h1>
        <Badge
          variant="outline"
          className={STATUS_COLORS[migration.status] ?? ""}
        >
          {migration.status.replace(/_/g, " ")}
        </Badge>
      </div>

      {/* Info card */}
      <Card>
        <CardHeader>
          <CardTitle>Migration Information</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div className="space-y-3">
              <div>
                <span className="text-sm font-medium text-muted-foreground">
                  Direction
                </span>
                <p className="text-sm capitalize">{migration.direction}</p>
              </div>
              <div>
                <span className="text-sm font-medium text-muted-foreground">
                  User DID
                </span>
                <p className="text-sm font-mono">{migration.userDid ?? "—"}</p>
              </div>
              <div>
                <span className="text-sm font-medium text-muted-foreground">
                  Peer User DID
                </span>
                <p className="text-sm font-mono">
                  {migration.peerUserDid ?? "—"}
                </p>
              </div>
              <div>
                <span className="text-sm font-medium text-muted-foreground">
                  Peer Domain
                </span>
                <p className="text-sm">{migration.peerDomain}</p>
              </div>
              <div>
                <span className="text-sm font-medium text-muted-foreground">
                  Peer Instance URL
                </span>
                <p className="text-sm">{migration.peerInstanceUrl ?? "—"}</p>
              </div>
            </div>
            <div className="space-y-3">
              <div>
                <span className="text-sm font-medium text-muted-foreground">
                  Callback URL
                </span>
                <p className="text-sm font-mono text-xs break-all">
                  {migration.callbackUrl ?? "—"}
                </p>
              </div>
              <div>
                <span className="text-sm font-medium text-muted-foreground">
                  Created
                </span>
                <p className="text-sm">
                  {format(new Date(migration.createdAt), "PPpp")}
                </p>
              </div>
              <div>
                <span className="text-sm font-medium text-muted-foreground">
                  Approved
                </span>
                <p className="text-sm">
                  {migration.approvedAt
                    ? format(new Date(migration.approvedAt), "PPpp")
                    : "—"}
                </p>
              </div>
              <div>
                <span className="text-sm font-medium text-muted-foreground">
                  Completed
                </span>
                <p className="text-sm">
                  {migration.completedAt
                    ? format(new Date(migration.completedAt), "PPpp")
                    : "—"}
                </p>
              </div>
              {migration.failureReason && (
                <div>
                  <span className="text-sm font-medium text-muted-foreground">
                    Failure Reason
                  </span>
                  <p className="text-sm text-destructive">
                    {migration.failureReason}
                  </p>
                </div>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Actions */}
      <Card>
        <CardHeader>
          <CardTitle>Actions</CardTitle>
        </CardHeader>
        <CardContent>
          {canApproveReject && (
            <div className="flex gap-3">
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button>Approve</Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Approve Migration</AlertDialogTitle>
                    <AlertDialogDescription>
                      This will approve the identity migration from{" "}
                      <strong>{migration.peerDomain}</strong>. The migration
                      process will proceed.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction
                      onClick={() =>
                        approveMutation.mutate({ id: migrationId })
                      }
                    >
                      Approve
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>

              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant="destructive">Reject</Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Reject Migration</AlertDialogTitle>
                    <AlertDialogDescription>
                      Are you sure you want to reject this migration? This
                      action cannot be undone.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction
                      onClick={() => rejectMutation.mutate({ id: migrationId })}
                    >
                      Reject
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>
          )}

          {!canApproveReject && canCancel && (
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="destructive">Cancel Migration</Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Cancel Migration</AlertDialogTitle>
                  <AlertDialogDescription>
                    Are you sure you want to cancel this migration? This action
                    cannot be undone.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Keep Migration</AlertDialogCancel>
                  <AlertDialogAction
                    onClick={() => cancelMutation.mutate({ id: migrationId })}
                  >
                    Cancel Migration
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          )}

          {TERMINAL_STATUSES.has(migration.status) && (
            <p className="text-sm text-muted-foreground">
              This migration has reached a terminal state (
              {migration.status.toLowerCase().replace(/_/g, " ")}). No actions
              available.
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
