"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { formatDistanceToNow } from "date-fns";
import {
  ArrowLeft,
  FileText,
  Loader2,
  MoreHorizontal,
  Plus,
  Send,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { GroupStatusBadge } from "./group-status-badge";
import { AddSubmissionDialog } from "./add-submission-dialog";

interface SimsubGroupDetailProps {
  groupId: string;
}

export function SimsubGroupDetail({ groupId }: SimsubGroupDetailProps) {
  const router = useRouter();
  const utils = trpc.useUtils();
  const [addOpen, setAddOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);

  const {
    data: group,
    isPending: isLoading,
    error,
  } = trpc.simsubGroups.getById.useQuery({ id: groupId });

  const updateMutation = trpc.simsubGroups.update.useMutation({
    onSuccess: () => {
      toast.success("Group updated");
      utils.simsubGroups.getById.invalidate({ id: groupId });
      utils.simsubGroups.list.invalidate();
    },
    onError: (err) => toast.error(err.message),
  });

  const deleteMutation = trpc.simsubGroups.delete.useMutation({
    onSuccess: () => {
      toast.success("Group deleted");
      utils.simsubGroups.list.invalidate();
      router.push("/workspace/sim-sub");
    },
    onError: (err) => toast.error(err.message),
  });

  const removeMutation = trpc.simsubGroups.removeSubmission.useMutation({
    onSuccess: () => {
      toast.success("Submission removed from group");
      utils.simsubGroups.getById.invalidate({ id: groupId });
      utils.simsubGroups.availableSubmissions.invalidate({ groupId });
      utils.simsubGroups.availableExternalSubmissions.invalidate({ groupId });
    },
    onError: (err) => toast.error(err.message),
  });

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-48" />
        <Skeleton className="h-64" />
      </div>
    );
  }

  if (error || !group) {
    return (
      <div className="text-center py-12">
        <p className="text-destructive">
          {error?.message ?? "Group not found"}
        </p>
        <Link href="/workspace/sim-sub">
          <Button variant="outline" className="mt-4">
            Back to groups
          </Button>
        </Link>
      </div>
    );
  }

  const isActive = group.status === "ACTIVE";

  return (
    <div className="space-y-6 max-w-4xl">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Link href="/workspace/sim-sub">
          <Button variant="ghost" size="icon">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold truncate">{group.name}</h1>
            <GroupStatusBadge status={group.status} />
          </div>
          {group.manuscriptTitle && (
            <p className="text-sm text-muted-foreground mt-1">
              Manuscript: {group.manuscriptTitle}
            </p>
          )}
        </div>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="icon">
              <MoreHorizontal className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            {isActive && (
              <>
                <DropdownMenuItem
                  onClick={() =>
                    updateMutation.mutate({
                      id: groupId,
                      status: "RESOLVED",
                    })
                  }
                >
                  Mark as Resolved
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() =>
                    updateMutation.mutate({
                      id: groupId,
                      status: "WITHDRAWN",
                    })
                  }
                >
                  Mark as Withdrawn
                </DropdownMenuItem>
                <DropdownMenuSeparator />
              </>
            )}
            <DropdownMenuItem
              className="text-destructive"
              onClick={() => setDeleteOpen(true)}
            >
              <Trash2 className="mr-2 h-4 w-4" />
              Delete Group
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Notes */}
      {group.notes && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Notes
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm whitespace-pre-wrap">{group.notes}</p>
          </CardContent>
        </Card>
      )}

      {/* Linked submissions */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Linked Submissions</CardTitle>
              <CardDescription>
                {group.submissions.length} submission
                {group.submissions.length !== 1 ? "s" : ""} in this group
              </CardDescription>
            </div>
            {isActive && (
              <Button
                size="sm"
                variant="outline"
                onClick={() => setAddOpen(true)}
              >
                <Plus className="mr-2 h-4 w-4" />
                Add
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {group.submissions.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <FileText className="mx-auto h-8 w-8 mb-2" />
              <p className="text-sm">
                No submissions linked yet.{" "}
                {isActive && "Add submissions to track them together."}
              </p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-8">Type</TableHead>
                  <TableHead>Title / Journal</TableHead>
                  <TableHead>Magazine</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Date</TableHead>
                  {isActive && <TableHead className="w-10" />}
                </TableRow>
              </TableHeader>
              <TableBody>
                {group.submissions.map((sub) => (
                  <TableRow key={sub.id}>
                    <TableCell>
                      {sub.type === "colophony" ? (
                        <FileText className="h-4 w-4 text-muted-foreground" />
                      ) : (
                        <Send className="h-4 w-4 text-muted-foreground" />
                      )}
                    </TableCell>
                    <TableCell className="font-medium">
                      {sub.type === "colophony"
                        ? (sub.submissionTitle ?? "Untitled")
                        : (sub.journalName ?? "Unknown journal")}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {sub.type === "colophony"
                        ? (sub.magazineName ?? "—")
                        : "External"}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className="text-xs">
                        {sub.type === "colophony"
                          ? (sub.submissionStatus ?? "—")
                          : (sub.externalStatus ?? "—")}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-muted-foreground text-sm">
                      {(() => {
                        const date =
                          sub.type === "colophony"
                            ? sub.submittedAt
                            : sub.sentAt;
                        return date
                          ? formatDistanceToNow(new Date(date), {
                              addSuffix: true,
                            })
                          : "—";
                      })()}
                    </TableCell>
                    {isActive && (
                      <TableCell>
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 text-muted-foreground hover:text-destructive"
                            >
                              <Trash2 className="h-3 w-3" />
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>
                                Remove Submission
                              </AlertDialogTitle>
                              <AlertDialogDescription>
                                Remove this submission from the group? The
                                submission itself will not be affected.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Cancel</AlertDialogCancel>
                              <AlertDialogAction
                                onClick={() =>
                                  removeMutation.mutate({
                                    groupId,
                                    submissionId: sub.submissionId ?? undefined,
                                    externalSubmissionId:
                                      sub.externalSubmissionId ?? undefined,
                                  })
                                }
                              >
                                Remove
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </TableCell>
                    )}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Dialogs */}
      <AddSubmissionDialog
        groupId={groupId}
        open={addOpen}
        onOpenChange={setAddOpen}
      />

      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Group</AlertDialogTitle>
            <AlertDialogDescription>
              Permanently delete &ldquo;{group.name}&rdquo;? This will remove
              the group and all submission links. The submissions themselves
              will not be affected.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={deleteMutation.isPending}
              onClick={() => deleteMutation.mutate({ id: groupId })}
            >
              {deleteMutation.isPending && (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              )}
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
