"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { formatDistanceToNow } from "date-fns";
import { trpc } from "@/lib/trpc";
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
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Skeleton } from "@/components/ui/skeleton";
import { ManuscriptVersionFiles } from "./manuscript-version-files";
import { toast } from "sonner";
import {
  ArrowLeft,
  Edit2,
  Trash2,
  Plus,
  Loader2,
  ExternalLink,
} from "lucide-react";

interface ManuscriptDetailProps {
  manuscriptId: string;
}

export function ManuscriptDetail({ manuscriptId }: ManuscriptDetailProps) {
  const router = useRouter();
  const utils = trpc.useUtils();

  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [showNewVersionDialog, setShowNewVersionDialog] = useState(false);
  const [editTitle, setEditTitle] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [newVersionLabel, setNewVersionLabel] = useState("");

  const {
    data: manuscript,
    isPending: isLoading,
    error,
  } = trpc.manuscripts.getDetail.useQuery({ id: manuscriptId });

  const { data: relatedSubmissions } =
    trpc.manuscripts.getRelatedSubmissions.useQuery(
      { manuscriptId },
      { enabled: !!manuscript },
    );

  const deleteMutation = trpc.manuscripts.delete.useMutation({
    onSuccess: () => {
      toast.success("Manuscript deleted");
      utils.manuscripts.list.invalidate();
      router.push("/manuscripts");
    },
    onError: (err) => {
      toast.error(err.message);
    },
  });

  const updateMutation = trpc.manuscripts.update.useMutation({
    onSuccess: () => {
      toast.success("Manuscript updated");
      utils.manuscripts.getDetail.invalidate({ id: manuscriptId });
      utils.manuscripts.getById.invalidate({ id: manuscriptId });
      utils.manuscripts.list.invalidate();
      setShowEditDialog(false);
    },
    onError: (err) => {
      toast.error(err.message);
    },
  });

  const createVersionMutation = trpc.manuscripts.createVersion.useMutation({
    onSuccess: () => {
      toast.success("New version created");
      utils.manuscripts.getDetail.invalidate({ id: manuscriptId });
      setShowNewVersionDialog(false);
      setNewVersionLabel("");
    },
    onError: (err) => {
      toast.error(err.message);
    },
  });

  const handleOpenEditDialog = () => {
    if (manuscript) {
      setEditTitle(manuscript.title);
      setEditDescription(manuscript.description ?? "");
      setShowEditDialog(true);
    }
  };

  const handleUpdate = async () => {
    if (!editTitle.trim()) return;
    await updateMutation.mutateAsync({
      id: manuscriptId,
      data: {
        title: editTitle.trim(),
        description: editDescription.trim() || null,
      },
    });
  };

  const handleCreateVersion = async () => {
    await createVersionMutation.mutateAsync({
      manuscriptId,
      label: newVersionLabel.trim() || undefined,
    });
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-4 w-96" />
        <Skeleton className="h-64" />
      </div>
    );
  }

  if (error) {
    return (
      <Alert variant="destructive">
        <AlertDescription>
          {error.message.includes("not found")
            ? "Manuscript not found."
            : `Failed to load manuscript: ${error.message}`}
        </AlertDescription>
      </Alert>
    );
  }

  if (!manuscript) return null;

  // Backend returns versions ASC by versionNumber; display newest first
  const versionsNewestFirst = [...manuscript.versions].reverse();

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <Button
          variant="ghost"
          size="sm"
          className="mb-4"
          onClick={() => router.push("/manuscripts")}
        >
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to manuscripts
        </Button>

        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold">{manuscript.title}</h1>
            <p className="text-sm text-muted-foreground">
              Created{" "}
              {formatDistanceToNow(new Date(manuscript.createdAt), {
                addSuffix: true,
              })}
            </p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={handleOpenEditDialog}>
              <Edit2 className="mr-2 h-4 w-4" />
              Edit
            </Button>
            <Dialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
              <DialogTrigger asChild>
                <Button variant="destructive" size="sm">
                  <Trash2 className="mr-2 h-4 w-4" />
                  Delete
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Delete Manuscript</DialogTitle>
                  <DialogDescription>
                    This will permanently delete this manuscript, all its
                    versions, and all associated files. Submissions linked to
                    this manuscript will lose their file references. This action
                    cannot be undone.
                  </DialogDescription>
                </DialogHeader>
                <DialogFooter>
                  <Button
                    variant="outline"
                    onClick={() => setShowDeleteDialog(false)}
                  >
                    Cancel
                  </Button>
                  <Button
                    variant="destructive"
                    onClick={() => deleteMutation.mutate({ id: manuscriptId })}
                    disabled={deleteMutation.isPending}
                  >
                    {deleteMutation.isPending && (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    )}
                    Delete
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Main content */}
        <div className="lg:col-span-2 space-y-6">
          {/* Description */}
          {manuscript.description && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Description</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                  {manuscript.description}
                </p>
              </CardContent>
            </Card>
          )}

          {/* Versions */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold">Versions</h2>
              <Dialog
                open={showNewVersionDialog}
                onOpenChange={setShowNewVersionDialog}
              >
                <DialogTrigger asChild>
                  <Button size="sm">
                    <Plus className="mr-2 h-4 w-4" />
                    New Version
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Create New Version</DialogTitle>
                    <DialogDescription>
                      Create a new version to upload revised files.
                    </DialogDescription>
                  </DialogHeader>
                  <div className="space-y-4 py-4">
                    <div>
                      <label className="text-sm font-medium">
                        Label (optional)
                      </label>
                      <Input
                        placeholder="e.g., Revised after feedback"
                        value={newVersionLabel}
                        onChange={(e) => setNewVersionLabel(e.target.value)}
                      />
                    </div>
                  </div>
                  <DialogFooter>
                    <Button
                      variant="outline"
                      onClick={() => setShowNewVersionDialog(false)}
                    >
                      Cancel
                    </Button>
                    <Button
                      onClick={handleCreateVersion}
                      disabled={createVersionMutation.isPending}
                    >
                      {createVersionMutation.isPending && (
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      )}
                      Create Version
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </div>

            {versionsNewestFirst.map((version) => (
              <Card key={version.id}>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-base">
                      Version {version.versionNumber}
                      {version.label && (
                        <span className="ml-2 text-sm font-normal text-muted-foreground">
                          — {version.label}
                        </span>
                      )}
                    </CardTitle>
                    <Badge variant="secondary">
                      {version.files.length} file
                      {version.files.length !== 1 ? "s" : ""}
                    </Badge>
                  </div>
                  <CardDescription>
                    Created{" "}
                    {formatDistanceToNow(new Date(version.createdAt), {
                      addSuffix: true,
                    })}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <ManuscriptVersionFiles
                    manuscriptVersionId={version.id}
                    files={version.files}
                    readOnly={version !== versionsNewestFirst[0]}
                    onFileChange={() =>
                      utils.manuscripts.getDetail.invalidate({
                        id: manuscriptId,
                      })
                    }
                  />
                </CardContent>
              </Card>
            ))}

            {versionsNewestFirst.length === 0 && (
              <p className="text-sm text-muted-foreground text-center py-4">
                No versions yet.
              </p>
            )}
          </div>
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Related submissions */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Related Submissions</CardTitle>
            </CardHeader>
            <CardContent>
              {!relatedSubmissions || relatedSubmissions.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  No submissions linked to this manuscript.
                </p>
              ) : (
                <div className="space-y-3">
                  {relatedSubmissions.map((sub) => (
                    <Link
                      key={sub.id}
                      href={`/submissions/${sub.id}`}
                      className="flex items-start gap-2 p-2 rounded-lg hover:bg-accent transition-colors"
                    >
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">
                          {sub.title ?? "Untitled"}
                        </p>
                        <div className="flex items-center gap-2 mt-1">
                          <Badge variant="outline" className="text-xs">
                            {sub.status}
                          </Badge>
                          <Badge variant="secondary" className="text-xs">
                            v{sub.versionNumber}
                          </Badge>
                        </div>
                      </div>
                      <ExternalLink className="h-3 w-3 text-muted-foreground flex-shrink-0 mt-1" />
                    </Link>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Edit dialog */}
      <Dialog open={showEditDialog} onOpenChange={setShowEditDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Manuscript</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <label className="text-sm font-medium">Title *</label>
              <Input
                value={editTitle}
                onChange={(e) => setEditTitle(e.target.value)}
                placeholder="Manuscript title"
              />
            </div>
            <div>
              <label className="text-sm font-medium">Description</label>
              <Textarea
                value={editDescription}
                onChange={(e) => setEditDescription(e.target.value)}
                placeholder="Optional description"
                className="min-h-[80px]"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowEditDialog(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleUpdate}
              disabled={updateMutation.isPending || !editTitle.trim()}
            >
              {updateMutation.isPending && (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              )}
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
