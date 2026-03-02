"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowLeft, Filter, ChevronDown, ChevronUp } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { format } from "date-fns";

const ACTION_GROUPS = [
  "USER_CREATED",
  "ORG_CREATED",
  "SUBMISSION_CREATED",
  "FEDERATION_TRUST_INITIATED",
  "SIMSUB_CHECK_PERFORMED",
  "TRANSFER_INITIATED",
  "MIGRATION_REQUESTED",
  "HUB_INSTANCE_REGISTERED",
  "AUDIT_ACCESSED",
] as const;

const RESOURCE_OPTIONS = [
  "user",
  "organization",
  "submission",
  "federation",
  "simsub",
  "transfer",
  "migration",
  "hub",
  "audit",
] as const;

interface AuditEvent {
  id: string;
  action: string;
  resource: string;
  resourceId: string | null;
  actorId: string | null;
  ipAddress: string | null;
  userAgent: string | null;
  method: string | null;
  route: string | null;
  oldValue: unknown;
  newValue: unknown;
  createdAt: string;
}

export function AuditLogViewer() {
  const [page, setPage] = useState(1);
  const [action, setAction] = useState<string>("all");
  const [resource, setResource] = useState<string>("all");
  const [actorId, setActorId] = useState("");
  const [resourceId, setResourceId] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [selectedEvent, setSelectedEvent] = useState<AuditEvent | null>(null);

  const queryInput = {
    page,
    limit: 25,
    ...(action !== "all" ? { action } : {}),
    ...(resource !== "all" ? { resource } : {}),
    ...(actorId ? { actorId } : {}),
    ...(resourceId ? { resourceId } : {}),
    ...(dateFrom ? { dateFrom: new Date(dateFrom) } : {}),
    ...(dateTo ? { dateTo: new Date(dateTo) } : {}),
  } as Parameters<typeof trpc.audit.list.useQuery>[0];

  const { data, isPending: isLoading } = trpc.audit.list.useQuery(queryInput);

  const events = (data?.items ?? []) as AuditEvent[];
  const total = data?.total ?? 0;
  const totalPages = data?.totalPages ?? 1;

  return (
    <div className="space-y-6">
      <Button variant="ghost" size="sm" asChild>
        <Link href="/federation">
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to Federation
        </Link>
      </Button>

      <h1 className="text-2xl font-bold">Audit Log</h1>

      {/* Filter bar */}
      <Collapsible open={filtersOpen} onOpenChange={setFiltersOpen}>
        <Card>
          <CardHeader className="pb-3">
            <CollapsibleTrigger asChild>
              <Button variant="ghost" className="flex w-full justify-between">
                <div className="flex items-center gap-2">
                  <Filter className="h-4 w-4" />
                  <span>Filters</span>
                </div>
                {filtersOpen ? (
                  <ChevronUp className="h-4 w-4" />
                ) : (
                  <ChevronDown className="h-4 w-4" />
                )}
              </Button>
            </CollapsibleTrigger>
          </CardHeader>
          <CollapsibleContent>
            <CardContent>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                <div className="space-y-2">
                  <Label>Action</Label>
                  <Select value={action} onValueChange={setAction}>
                    <SelectTrigger>
                      <SelectValue placeholder="All actions" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Actions</SelectItem>
                      {ACTION_GROUPS.map((a) => (
                        <SelectItem key={a} value={a}>
                          {a}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Resource</Label>
                  <Select value={resource} onValueChange={setResource}>
                    <SelectTrigger>
                      <SelectValue placeholder="All resources" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Resources</SelectItem>
                      {RESOURCE_OPTIONS.map((r) => (
                        <SelectItem key={r} value={r}>
                          {r}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Actor ID</Label>
                  <Input
                    placeholder="UUID"
                    value={actorId}
                    onChange={(e) => setActorId(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Resource ID</Label>
                  <Input
                    placeholder="UUID"
                    value={resourceId}
                    onChange={(e) => setResourceId(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label>From</Label>
                  <Input
                    type="date"
                    value={dateFrom}
                    onChange={(e) => setDateFrom(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label>To</Label>
                  <Input
                    type="date"
                    value={dateTo}
                    onChange={(e) => setDateTo(e.target.value)}
                  />
                </div>
              </div>
              <div className="mt-4">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setAction("all");
                    setResource("all");
                    setActorId("");
                    setResourceId("");
                    setDateFrom("");
                    setDateTo("");
                    setPage(1);
                  }}
                >
                  Clear Filters
                </Button>
              </div>
            </CardContent>
          </CollapsibleContent>
        </Card>
      </Collapsible>

      {/* Events table */}
      <Card>
        <CardHeader>
          <CardTitle>Events</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-2">
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
            </div>
          ) : events.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No audit events found.
            </p>
          ) : (
            <>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Timestamp</TableHead>
                    <TableHead>Action</TableHead>
                    <TableHead>Resource</TableHead>
                    <TableHead>Resource ID</TableHead>
                    <TableHead>Actor ID</TableHead>
                    <TableHead>IP</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {events.map((event) => (
                    <TableRow
                      key={event.id}
                      className="cursor-pointer"
                      onClick={() => setSelectedEvent(event)}
                    >
                      <TableCell className="text-xs">
                        {format(new Date(event.createdAt), "PPpp")}
                      </TableCell>
                      <TableCell>
                        <Badge variant="secondary" className="text-xs">
                          {event.action}
                        </Badge>
                      </TableCell>
                      <TableCell>{event.resource}</TableCell>
                      <TableCell className="font-mono text-xs">
                        {event.resourceId
                          ? `${event.resourceId.slice(0, 8)}...`
                          : "—"}
                      </TableCell>
                      <TableCell className="font-mono text-xs">
                        {event.actorId
                          ? `${event.actorId.slice(0, 8)}...`
                          : "—"}
                      </TableCell>
                      <TableCell className="text-xs">
                        {event.ipAddress ?? "—"}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              {totalPages > 1 && (
                <div className="mt-4 flex items-center justify-between">
                  <p className="text-sm text-muted-foreground">
                    Page {page} of {totalPages} ({total} total)
                  </p>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={page <= 1}
                      onClick={() => setPage((p) => p - 1)}
                    >
                      Previous
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={page >= totalPages}
                      onClick={() => setPage((p) => p + 1)}
                    >
                      Next
                    </Button>
                  </div>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>

      {/* Event detail dialog */}
      <Dialog
        open={!!selectedEvent}
        onOpenChange={(open) => !open && setSelectedEvent(null)}
      >
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Audit Event Detail</DialogTitle>
          </DialogHeader>
          {selectedEvent && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="font-medium text-muted-foreground">
                    Action
                  </span>
                  <p>{selectedEvent.action}</p>
                </div>
                <div>
                  <span className="font-medium text-muted-foreground">
                    Resource
                  </span>
                  <p>{selectedEvent.resource}</p>
                </div>
                <div>
                  <span className="font-medium text-muted-foreground">
                    Resource ID
                  </span>
                  <p className="font-mono text-xs">
                    {selectedEvent.resourceId ?? "—"}
                  </p>
                </div>
                <div>
                  <span className="font-medium text-muted-foreground">
                    Actor ID
                  </span>
                  <p className="font-mono text-xs">
                    {selectedEvent.actorId ?? "—"}
                  </p>
                </div>
                <div>
                  <span className="font-medium text-muted-foreground">
                    IP Address
                  </span>
                  <p>{selectedEvent.ipAddress ?? "—"}</p>
                </div>
                <div>
                  <span className="font-medium text-muted-foreground">
                    Method / Route
                  </span>
                  <p>
                    {selectedEvent.method} {selectedEvent.route ?? "—"}
                  </p>
                </div>
                <div className="col-span-2">
                  <span className="font-medium text-muted-foreground">
                    User Agent
                  </span>
                  <p className="text-xs break-all">
                    {selectedEvent.userAgent ?? "—"}
                  </p>
                </div>
              </div>
              {selectedEvent.oldValue != null && (
                <div>
                  <span className="text-sm font-medium text-muted-foreground">
                    Old Value
                  </span>
                  <pre className="mt-1 max-h-48 overflow-auto rounded bg-muted p-2 text-xs">
                    {JSON.stringify(selectedEvent.oldValue, null, 2)}
                  </pre>
                </div>
              )}
              {selectedEvent.newValue != null && (
                <div>
                  <span className="text-sm font-medium text-muted-foreground">
                    New Value
                  </span>
                  <pre className="mt-1 max-h-48 overflow-auto rounded bg-muted p-2 text-xs">
                    {JSON.stringify(selectedEvent.newValue, null, 2)}
                  </pre>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
