"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { format } from "date-fns";
import { trpc } from "@/lib/trpc";
import { useOrganization } from "@/hooks/use-organization";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
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
import {
  ArrowLeft,
  Loader2,
  RefreshCw,
  RotateCcw,
  Send,
  Trash2,
} from "lucide-react";
import { SecretDisplayDialog } from "./secret-display-dialog";

const STATUS_COLORS: Record<string, string> = {
  QUEUED: "bg-yellow-500",
  DELIVERING: "bg-blue-500",
  DELIVERED: "bg-green-500",
  FAILED: "bg-red-500",
};

interface WebhookDetailProps {
  endpointId: string;
}

export function WebhookDetail({ endpointId }: WebhookDetailProps) {
  const router = useRouter();
  const utils = trpc.useUtils();
  const { isAdmin } = useOrganization();
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [rotateOpen, setRotateOpen] = useState(false);
  const [secret, setSecret] = useState<string | null>(null);
  const [secretDialogOpen, setSecretDialogOpen] = useState(false);
  const [deliveryPage, setDeliveryPage] = useState(1);

  const { data: endpoint, isPending: isLoading } =
    trpc.webhooks.getById.useQuery({ id: endpointId });

  const { data: deliveries, isPending: deliveriesLoading } =
    trpc.webhooks.deliveries.useQuery({
      endpointId,
      page: deliveryPage,
      limit: 20,
    });

  const deleteMutation = trpc.webhooks.delete.useMutation({
    onSuccess: () => {
      toast.success("Webhook endpoint deleted");
      router.push("/webhooks");
    },
    onError: (err) => toast.error(err.message),
  });

  const rotateMutation = trpc.webhooks.rotateSecret.useMutation({
    onSuccess: (data) => {
      if (data?.secret) {
        setSecret(data.secret);
        setSecretDialogOpen(true);
      }
      utils.webhooks.getById.invalidate({ id: endpointId });
      toast.success("Secret rotated");
    },
    onError: (err) => toast.error(err.message),
  });

  const testMutation = trpc.webhooks.test.useMutation({
    onSuccess: () => {
      toast.success("Test webhook sent");
      utils.webhooks.deliveries.invalidate({ endpointId });
    },
    onError: (err) => toast.error(err.message),
  });

  const retryMutation = trpc.webhooks.retryDelivery.useMutation({
    onSuccess: () => {
      toast.success("Delivery queued for retry");
      utils.webhooks.deliveries.invalidate({ endpointId });
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

  if (!endpoint) {
    return (
      <div className="text-center py-12">
        <p className="text-muted-foreground">Webhook endpoint not found</p>
        <Link href="/webhooks">
          <Button variant="link">Back to webhooks</Button>
        </Link>
      </div>
    );
  }

  const eventTypes = endpoint.eventTypes as string[];

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <Link
          href="/webhooks"
          className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="mr-1 h-4 w-4" />
          Back to webhooks
        </Link>
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold font-mono text-sm break-all">
            {endpoint.url}
          </h1>
          {isAdmin && (
            <div className="flex items-center gap-2 shrink-0 ml-4">
              <Button
                variant="outline"
                onClick={() => testMutation.mutate({ id: endpointId })}
                disabled={testMutation.isPending}
              >
                {testMutation.isPending ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Send className="mr-2 h-4 w-4" />
                )}
                Test
              </Button>

              <AlertDialog open={rotateOpen} onOpenChange={setRotateOpen}>
                <AlertDialogTrigger asChild>
                  <Button variant="outline">
                    <RotateCcw className="mr-2 h-4 w-4" />
                    Rotate Secret
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Rotate Secret</AlertDialogTitle>
                    <AlertDialogDescription>
                      This will generate a new signing secret. The old secret
                      will stop working immediately. Make sure to update your
                      endpoint.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction
                      onClick={() => rotateMutation.mutate({ id: endpointId })}
                    >
                      Rotate
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>

              <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
                <AlertDialogTrigger asChild>
                  <Button variant="destructive">
                    <Trash2 className="mr-2 h-4 w-4" />
                    Delete
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Delete Webhook</AlertDialogTitle>
                    <AlertDialogDescription>
                      This will permanently delete this webhook endpoint and all
                      its delivery history. This action cannot be undone.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction
                      onClick={() => deleteMutation.mutate({ id: endpointId })}
                      className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                    >
                      Delete
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>
          )}
        </div>
      </div>

      {/* Endpoint details */}
      <div className="grid gap-6 md:grid-cols-3">
        <Card className="md:col-span-2">
          <CardHeader>
            <CardTitle>Event Subscriptions</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {eventTypes.map((event) => (
                <Badge key={event} variant="outline">
                  {event}
                </Badge>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Details</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {endpoint.description && (
              <div>
                <p className="text-sm font-medium text-muted-foreground">
                  Description
                </p>
                <p className="text-sm mt-1">{endpoint.description}</p>
              </div>
            )}
            <div>
              <p className="text-sm font-medium text-muted-foreground">
                Status
              </p>
              <div className="flex items-center gap-2 mt-1">
                <span
                  className={`inline-block h-2 w-2 rounded-full ${
                    endpoint.status === "ACTIVE"
                      ? "bg-green-500"
                      : "bg-gray-300"
                  }`}
                />
                <span className="text-sm">{endpoint.status}</span>
              </div>
            </div>
            <div>
              <p className="text-sm font-medium text-muted-foreground">
                Created
              </p>
              <p className="text-sm mt-1">
                {format(new Date(endpoint.createdAt), "PPP")}
              </p>
            </div>
            <div>
              <p className="text-sm font-medium text-muted-foreground">
                Updated
              </p>
              <p className="text-sm mt-1">
                {format(new Date(endpoint.updatedAt), "PPP")}
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Delivery log */}
      <Card>
        <CardHeader>
          <CardTitle>Delivery Log</CardTitle>
        </CardHeader>
        <CardContent>
          {deliveriesLoading ? (
            <div className="space-y-2">
              {Array.from({ length: 5 }).map((_, i) => (
                <Skeleton key={i} className="h-10 w-full" />
              ))}
            </div>
          ) : !deliveries?.items.length ? (
            <p className="text-center py-8 text-muted-foreground">
              No deliveries yet
            </p>
          ) : (
            <>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Event</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>HTTP</TableHead>
                    <TableHead>Attempts</TableHead>
                    <TableHead>Time</TableHead>
                    {isAdmin && <TableHead />}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {deliveries.items.map((delivery) => (
                    <TableRow key={delivery.id}>
                      <TableCell className="font-mono text-sm">
                        {delivery.eventType}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <span
                            className={`inline-block h-2 w-2 rounded-full ${
                              STATUS_COLORS[delivery.status] ?? "bg-gray-300"
                            }`}
                          />
                          <span className="text-sm">{delivery.status}</span>
                        </div>
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {delivery.httpStatusCode ?? "—"}
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {delivery.attempts}
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {format(new Date(delivery.createdAt), "PP p")}
                      </TableCell>
                      {isAdmin && (
                        <TableCell>
                          {delivery.status === "FAILED" && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() =>
                                retryMutation.mutate({
                                  deliveryId: delivery.id,
                                })
                              }
                              disabled={retryMutation.isPending}
                            >
                              <RefreshCw className="h-4 w-4" />
                            </Button>
                          )}
                        </TableCell>
                      )}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>

              {deliveries.total > 20 && (
                <div className="flex justify-center gap-2 mt-4">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setDeliveryPage((p) => Math.max(1, p - 1))}
                    disabled={deliveryPage === 1}
                  >
                    Previous
                  </Button>
                  <span className="flex items-center text-sm text-muted-foreground">
                    Page {deliveryPage} of {Math.ceil(deliveries.total / 20)}
                  </span>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setDeliveryPage((p) => p + 1)}
                    disabled={deliveryPage * 20 >= deliveries.total}
                  >
                    Next
                  </Button>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>

      {secret && (
        <SecretDisplayDialog
          open={secretDialogOpen}
          onOpenChange={setSecretDialogOpen}
          secret={secret}
          title="New Webhook Secret"
        />
      )}
    </div>
  );
}
