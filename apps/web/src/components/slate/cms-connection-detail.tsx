"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { format } from "date-fns";
import { trpc } from "@/lib/trpc";
import {
  getAdapterLabel,
  getAdapterConfigFields,
  maskConfigValue,
} from "@/lib/cms-utils";
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
import { ArrowLeft, Loader2, Pencil, Trash2, Wifi } from "lucide-react";

function friendlyCmsError(raw?: string | null): string {
  if (!raw) return "Connection test failed";
  const lower = raw.toLowerCase();
  if (
    lower.includes("fetch failed") ||
    lower.includes("enotfound") ||
    lower.includes("econnrefused")
  ) {
    return "Could not connect to CMS. Please verify the site URL is correct and the server is reachable.";
  }
  if (
    lower.includes("401") ||
    lower.includes("403") ||
    lower.includes("unauthorized")
  ) {
    return "Authentication failed. Please check your credentials.";
  }
  if (lower.includes("404")) {
    return "API endpoint not found. Please verify the site URL.";
  }
  return raw;
}

interface CmsConnectionDetailProps {
  connectionId: string;
}

export function CmsConnectionDetail({
  connectionId,
}: CmsConnectionDetailProps) {
  const router = useRouter();
  const utils = trpc.useUtils();
  const [deleteOpen, setDeleteOpen] = useState(false);

  const { data: connection, isPending: isLoading } =
    trpc.cmsConnections.getById.useQuery({ id: connectionId });

  const publicationId = connection?.publicationId ?? undefined;
  const { data: publication } = trpc.publications.getById.useQuery(
    { id: publicationId! },
    { enabled: !!publicationId },
  );

  const deleteMutation = trpc.cmsConnections.delete.useMutation({
    onSuccess: () => {
      toast.success("Connection deleted");
      utils.cmsConnections.list.invalidate();
      router.push("/slate/cms");
    },
    onError: (err) => toast.error(err.message),
  });

  const testMutation = trpc.cmsConnections.test.useMutation({
    onSuccess: (result) => {
      if (result.success) {
        toast.success("Connection test successful");
      } else {
        toast.error(friendlyCmsError(result.error));
      }
    },
    onError: (err) => toast.error(friendlyCmsError(err.message)),
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

  if (!connection) {
    return (
      <div className="text-center py-12">
        <p className="text-muted-foreground">Connection not found</p>
        <Link href="/slate/cms">
          <Button variant="link">Back to connections</Button>
        </Link>
      </div>
    );
  }

  const configFields = getAdapterConfigFields(connection.adapterType);

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <Link
          href="/slate/cms"
          className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="mr-1 h-4 w-4" />
          Back to connections
        </Link>
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold">{connection.name}</h1>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              onClick={() => testMutation.mutate({ id: connectionId })}
              disabled={testMutation.isPending}
            >
              {testMutation.isPending ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Wifi className="mr-2 h-4 w-4" />
              )}
              Test Connection
            </Button>
            <Link href={`/slate/cms/${connectionId}/edit`}>
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
                  <AlertDialogTitle>Delete Connection</AlertDialogTitle>
                  <AlertDialogDescription>
                    Are you sure you want to delete &ldquo;{connection.name}
                    &rdquo;? This action cannot be undone.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction
                    onClick={() => deleteMutation.mutate({ id: connectionId })}
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
        {/* Main — Configuration */}
        <Card className="md:col-span-2">
          <CardHeader>
            <CardTitle>Configuration</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {configFields.map((field) => {
                const value = connection.config[field.key];
                return (
                  <div key={field.key}>
                    <p className="text-sm font-medium text-muted-foreground">
                      {field.label}
                    </p>
                    <p className="text-sm mt-1 font-mono">
                      {maskConfigValue(value, field.type)}
                    </p>
                  </div>
                );
              })}
              {configFields.length === 0 && (
                <p className="text-sm text-muted-foreground">
                  No configuration fields
                </p>
              )}
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
              <div>
                <p className="text-sm font-medium text-muted-foreground">
                  Adapter
                </p>
                <div className="mt-1">
                  <Badge variant="outline">
                    {getAdapterLabel(connection.adapterType)}
                  </Badge>
                </div>
              </div>
              <div>
                <p className="text-sm font-medium text-muted-foreground">
                  Publication
                </p>
                <p className="text-sm mt-1">
                  {publication ? publication.name : "Org-wide"}
                </p>
              </div>
              <div>
                <p className="text-sm font-medium text-muted-foreground">
                  Status
                </p>
                <div className="flex items-center gap-2 mt-1">
                  <span
                    className={`inline-block h-2 w-2 rounded-full ${connection.isActive ? "bg-status-success" : "bg-status-info"}`}
                  />
                  <span className="text-sm">
                    {connection.isActive ? "Active" : "Inactive"}
                  </span>
                </div>
              </div>
              <div>
                <p className="text-sm font-medium text-muted-foreground">
                  Last Sync
                </p>
                <p className="text-sm mt-1">
                  {connection.lastSyncAt
                    ? format(new Date(connection.lastSyncAt), "PPP")
                    : "Never"}
                </p>
              </div>
              <div>
                <p className="text-sm font-medium text-muted-foreground">
                  Created
                </p>
                <p className="text-sm mt-1">
                  {format(new Date(connection.createdAt), "PPP")}
                </p>
              </div>
              <div>
                <p className="text-sm font-medium text-muted-foreground">
                  Updated
                </p>
                <p className="text-sm mt-1">
                  {format(new Date(connection.updatedAt), "PPP")}
                </p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
