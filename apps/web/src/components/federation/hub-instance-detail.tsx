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
  active: "border-status-success text-status-success",
  suspended: "border-status-warning text-status-warning",
  revoked: "border-status-error text-status-error",
};

interface HubInstanceDetailProps {
  instanceId: string;
}

export function HubInstanceDetail({ instanceId }: HubInstanceDetailProps) {
  const utils = trpc.useUtils();

  const {
    data: instance,
    isPending: isLoading,
    error,
  } = trpc.hub.getInstanceById.useQuery({ id: instanceId });

  const suspendMutation = trpc.hub.suspendInstance.useMutation({
    onSuccess: () => {
      toast.success("Instance suspended");
      utils.hub.getInstanceById.invalidate({ id: instanceId });
      utils.hub.listInstances.invalidate();
    },
    onError: (err) => toast.error(err.message),
  });

  const revokeMutation = trpc.hub.revokeInstance.useMutation({
    onSuccess: () => {
      toast.success("Instance revoked");
      utils.hub.getInstanceById.invalidate({ id: instanceId });
      utils.hub.listInstances.invalidate();
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

  if (error || !instance) {
    return (
      <div className="space-y-6">
        <Button variant="ghost" size="sm" asChild>
          <Link href="/federation/hub">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Hub
          </Link>
        </Button>
        <p className="text-muted-foreground">Instance not found.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Button variant="ghost" size="sm" asChild>
        <Link href="/federation/hub">
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to Hub
        </Link>
      </Button>

      <div className="flex items-center gap-3">
        <h1 className="text-2xl font-bold">{instance.domain}</h1>
        <Badge
          variant="outline"
          className={STATUS_COLORS[instance.status] ?? ""}
        >
          {instance.status}
        </Badge>
      </div>

      {/* Info card */}
      <Card>
        <CardHeader>
          <CardTitle>Instance Information</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div className="space-y-3">
              <div>
                <span className="text-sm font-medium text-muted-foreground">
                  Instance URL
                </span>
                <p className="text-sm">
                  <a
                    href={instance.instanceUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-primary hover:underline"
                  >
                    {instance.instanceUrl}
                  </a>
                </p>
              </div>
              <div>
                <span className="text-sm font-medium text-muted-foreground">
                  Last Seen
                </span>
                <p className="text-sm">
                  {instance.lastSeenAt
                    ? format(new Date(instance.lastSeenAt), "PPpp")
                    : "Never"}
                </p>
              </div>
              <div>
                <span className="text-sm font-medium text-muted-foreground">
                  Registered
                </span>
                <p className="text-sm">
                  {format(new Date(instance.createdAt), "PPpp")}
                </p>
              </div>
            </div>
            <div className="space-y-3">
              <div>
                <span className="text-sm font-medium text-muted-foreground">
                  Metadata
                </span>
                {instance.metadata ? (
                  <pre className="mt-1 max-h-48 overflow-auto rounded bg-muted p-2 text-xs">
                    {JSON.stringify(instance.metadata, null, 2)}
                  </pre>
                ) : (
                  <p className="text-sm text-muted-foreground">None</p>
                )}
              </div>
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
          {instance.status === "active" && (
            <div className="flex gap-3">
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant="outline">Suspend</Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Suspend Instance</AlertDialogTitle>
                    <AlertDialogDescription>
                      Suspending <strong>{instance.domain}</strong> will
                      temporarily disable its hub access. You can revoke it
                      permanently later.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction
                      onClick={() => suspendMutation.mutate({ id: instanceId })}
                    >
                      Suspend
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>

              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant="destructive">Revoke</Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Revoke Instance</AlertDialogTitle>
                    <AlertDialogDescription>
                      Revoking <strong>{instance.domain}</strong> will
                      permanently remove its hub registration. This cannot be
                      undone.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction
                      onClick={() => revokeMutation.mutate({ id: instanceId })}
                    >
                      Revoke
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>
          )}

          {instance.status === "suspended" && (
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="destructive">Revoke</Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Revoke Instance</AlertDialogTitle>
                  <AlertDialogDescription>
                    Revoking <strong>{instance.domain}</strong> will permanently
                    remove its hub registration. This cannot be undone.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction
                    onClick={() => revokeMutation.mutate({ id: instanceId })}
                  >
                    Revoke
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          )}

          {instance.status === "revoked" && (
            <p className="text-sm text-muted-foreground">
              This instance has been revoked. No actions available.
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
