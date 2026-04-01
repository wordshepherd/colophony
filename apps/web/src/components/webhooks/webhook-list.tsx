"use client";

import { useState } from "react";
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
import { Plus, Webhook } from "lucide-react";

const SKELETON_ITEMS = Array.from({ length: 5 });

export function WebhookList() {
  const { isAdmin } = useOrganization();
  const [page, setPage] = useState(1);

  const { data, isPending: isLoading } = trpc.webhooks.list.useQuery({
    page,
    limit: 20,
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="rounded-lg bg-primary/10 p-2">
            <Webhook className="h-5 w-5 text-primary" />
          </div>
          <h1 className="text-2xl font-bold">Webhooks</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Send real-time notifications to external services when events happen
            — like a new submission arriving or a decision being made.
          </p>
        </div>
        {isAdmin && (
          <Link href="/webhooks/new">
            <Button>
              <Plus className="mr-2 h-4 w-4" />
              New Webhook
            </Button>
          </Link>
        )}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Endpoints</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-2">
              {SKELETON_ITEMS.map((_, i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          ) : !data?.items.length ? (
            <div className="text-center py-12">
              <p className="text-muted-foreground">
                No webhook endpoints configured. Webhooks let external tools
                (Slack, Zapier, custom apps) react to events automatically.
              </p>
              {isAdmin && (
                <Link href="/webhooks/new">
                  <Button variant="link">
                    Create your first webhook endpoint
                  </Button>
                </Link>
              )}
            </div>
          ) : (
            <>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>URL</TableHead>
                    <TableHead>Events</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Created</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.items.map((endpoint) => (
                    <TableRow key={endpoint.id}>
                      <TableCell>
                        <Link
                          href={`/webhooks/${endpoint.id}`}
                          className="font-medium hover:underline font-mono text-sm"
                        >
                          {endpoint.url.length > 60
                            ? endpoint.url.slice(0, 60) + "..."
                            : endpoint.url}
                        </Link>
                        {endpoint.description && (
                          <p className="text-xs text-muted-foreground mt-0.5">
                            {endpoint.description}
                          </p>
                        )}
                      </TableCell>
                      <TableCell>
                        <Badge variant="secondary">
                          {(endpoint.eventTypes as string[]).length} event
                          {(endpoint.eventTypes as string[]).length !== 1
                            ? "s"
                            : ""}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <span
                            className={`inline-block h-2 w-2 rounded-full ${
                              endpoint.status === "ACTIVE"
                                ? "bg-status-success"
                                : "bg-status-info"
                            }`}
                          />
                          <span className="text-sm">{endpoint.status}</span>
                        </div>
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {format(new Date(endpoint.createdAt), "PP")}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>

              {data.total > 20 && (
                <div className="flex justify-center gap-2 mt-4">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    disabled={page === 1}
                  >
                    Previous
                  </Button>
                  <span className="flex items-center text-sm text-muted-foreground">
                    Page {page} of {Math.ceil(data.total / 20)}
                  </span>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setPage((p) => p + 1)}
                    disabled={page * 20 >= data.total}
                  >
                    Next
                  </Button>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
