"use client";

import { useState } from "react";
import Link from "next/link";
import { format, formatDistanceToNow } from "date-fns";
import { trpc } from "@/lib/trpc";
import { useOrganization } from "@/hooks/use-organization";
import { PublicationStatusBadge } from "./publication-status-badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import { ArrowLeft, Edit, Archive } from "lucide-react";

interface PublicationDetailProps {
  publicationId: string;
}

export function PublicationDetail({ publicationId }: PublicationDetailProps) {
  const { isAdmin } = useOrganization();
  const [showArchiveDialog, setShowArchiveDialog] = useState(false);
  const utils = trpc.useUtils();

  const { data: publication, isPending: isLoading } =
    trpc.publications.getById.useQuery({ id: publicationId });

  const archiveMutation = trpc.publications.archive.useMutation({
    onSuccess: () => {
      toast.success("Publication archived");
      utils.publications.getById.invalidate({ id: publicationId });
      utils.publications.list.invalidate();
    },
    onError: (err) => {
      toast.error(err.message);
    },
  });

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-48 w-full" />
      </div>
    );
  }

  if (!publication) {
    return (
      <div className="text-center py-12">
        <p className="text-muted-foreground">Publication not found</p>
        <Link href="/slate/publications">
          <Button variant="link">Back to publications</Button>
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="space-y-1">
          <Link
            href="/slate/publications"
            className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="mr-1 h-4 w-4" />
            Back to publications
          </Link>
          <h1 className="text-2xl font-bold">{publication.name}</h1>
          <div className="flex items-center gap-2">
            <PublicationStatusBadge status={publication.status} />
          </div>
        </div>

        {isAdmin && (
          <div className="flex gap-2">
            <Link href={`/slate/publications/${publicationId}/edit`}>
              <Button variant="outline">
                <Edit className="mr-2 h-4 w-4" />
                Edit
              </Button>
            </Link>
            {publication.status === "ACTIVE" && (
              <Button
                variant="outline"
                onClick={() => setShowArchiveDialog(true)}
              >
                <Archive className="mr-2 h-4 w-4" />
                Archive
              </Button>
            )}
          </div>
        )}
      </div>

      {/* Content */}
      <div className="grid gap-6 md:grid-cols-3">
        <div className="md:col-span-2 space-y-6">
          {/* Details */}
          <Card>
            <CardHeader>
              <CardTitle>Details</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <p className="text-sm font-medium text-muted-foreground">
                  Description
                </p>
                <p className="text-sm mt-1">
                  {publication.description || "No description provided"}
                </p>
              </div>
              <div>
                <p className="text-sm font-medium text-muted-foreground">
                  Slug
                </p>
                <p className="text-sm mt-1 font-mono">/{publication.slug}</p>
              </div>
            </CardContent>
          </Card>

          {/* Settings */}
          <Card>
            <CardHeader>
              <CardTitle>Settings</CardTitle>
            </CardHeader>
            <CardContent>
              {publication.settings ? (
                <pre className="text-xs bg-muted p-4 rounded-lg overflow-auto max-h-64">
                  {JSON.stringify(publication.settings, null, 2)}
                </pre>
              ) : (
                <p className="text-sm text-muted-foreground">
                  No settings configured
                </p>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Metadata</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div>
                <p className="text-sm font-medium text-muted-foreground">
                  Created
                </p>
                <p className="text-sm mt-1">
                  {format(new Date(publication.createdAt), "PPP")}
                </p>
              </div>
              <div>
                <p className="text-sm font-medium text-muted-foreground">
                  Last Updated
                </p>
                <p className="text-sm mt-1">
                  {formatDistanceToNow(new Date(publication.updatedAt), {
                    addSuffix: true,
                  })}
                </p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Archive confirmation dialog */}
      <Dialog open={showArchiveDialog} onOpenChange={setShowArchiveDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Archive publication?</DialogTitle>
            <DialogDescription>
              This will archive &ldquo;{publication.name}&rdquo;. Archived
              publications are hidden from active lists but can still be viewed.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowArchiveDialog(false)}
            >
              Cancel
            </Button>
            <Button
              onClick={() => {
                archiveMutation.mutate({ id: publicationId });
                setShowArchiveDialog(false);
              }}
              disabled={archiveMutation.isPending}
            >
              {archiveMutation.isPending ? "Archiving..." : "Archive"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
