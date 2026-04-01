"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, Plus } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
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
  FilterTabs,
  FilterTabsList,
  FilterTabsTrigger,
} from "@/components/ui/tabs";
import { InitiateTrustDialog } from "./initiate-trust-dialog";
import { formatDistanceToNow } from "date-fns";

const PEER_STATUS_COLORS: Record<string, string> = {
  active: "bg-status-success",
  pending_outbound: "bg-status-warning",
  pending_inbound: "bg-status-warning",
  rejected: "bg-status-error",
  revoked: "bg-status-error",
};

const STATUS_LABELS: Record<string, string> = {
  active: "Active",
  pending_outbound: "Pending Outbound",
  pending_inbound: "Pending Inbound",
  rejected: "Rejected",
  revoked: "Revoked",
};

type FilterTab = "all" | "active" | "pending" | "revoked";

export function PeerList() {
  const router = useRouter();
  const { data: peers, isPending: isLoading } =
    trpc.federation.listPeers.useQuery();
  const [tab, setTab] = useState<FilterTab>("all");
  const [dialogOpen, setDialogOpen] = useState(false);

  const filteredPeers = useMemo(() => {
    if (!peers) return [];
    switch (tab) {
      case "active":
        return peers.filter((p) => p.status === "active");
      case "pending":
        return peers.filter(
          (p) =>
            p.status === "pending_outbound" || p.status === "pending_inbound",
        );
      case "revoked":
        return peers.filter(
          (p) => p.status === "revoked" || p.status === "rejected",
        );
      default:
        return peers;
    }
  }, [peers, tab]);

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" asChild>
            <Link href="/federation">
              <ArrowLeft className="h-4 w-4" />
            </Link>
          </Button>
          <h1 className="text-2xl font-bold">Trusted Peers</h1>
        </div>
        <Button onClick={() => setDialogOpen(true)}>
          <Plus className="mr-2 h-4 w-4" />
          Initiate Trust
        </Button>
      </div>

      {/* Filter tabs */}
      <FilterTabs value={tab} onValueChange={(v) => setTab(v as FilterTab)}>
        <FilterTabsList>
          <FilterTabsTrigger value="all">All</FilterTabsTrigger>
          <FilterTabsTrigger value="active">Active</FilterTabsTrigger>
          <FilterTabsTrigger value="pending">Pending</FilterTabsTrigger>
          <FilterTabsTrigger value="revoked">Revoked</FilterTabsTrigger>
        </FilterTabsList>
      </FilterTabs>

      {/* Table */}
      <Card>
        <CardContent className="p-0">
          {filteredPeers.length === 0 ? (
            <div className="p-8 text-center text-muted-foreground">
              {peers?.length === 0
                ? "No trusted peers yet. Initiate trust with another Colophony instance to get started."
                : "No peers match the current filter."}
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Domain</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Capabilities</TableHead>
                  <TableHead>Initiated By</TableHead>
                  <TableHead>Last Verified</TableHead>
                  <TableHead>Created</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredPeers.map((peer) => {
                  const caps = Object.entries(peer.grantedCapabilities).filter(
                    ([, v]) => v,
                  );
                  return (
                    <TableRow
                      key={peer.id}
                      className="cursor-pointer"
                      onClick={() =>
                        router.push(`/federation/peers/${peer.id}`)
                      }
                    >
                      <TableCell className="font-medium">
                        {peer.domain}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <span
                            className={`inline-block h-2 w-2 rounded-full ${PEER_STATUS_COLORS[peer.status] ?? "bg-status-info"}`}
                          />
                          {STATUS_LABELS[peer.status] ?? peer.status}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-1">
                          {caps.slice(0, 2).map(([key]) => (
                            <Badge key={key} variant="secondary">
                              {key}
                            </Badge>
                          ))}
                          {caps.length > 2 && (
                            <Badge variant="outline">+{caps.length - 2}</Badge>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>{peer.initiatedBy}</TableCell>
                      <TableCell>
                        {peer.lastVerifiedAt
                          ? formatDistanceToNow(new Date(peer.lastVerifiedAt), {
                              addSuffix: true,
                            })
                          : "Never"}
                      </TableCell>
                      <TableCell>
                        {formatDistanceToNow(new Date(peer.createdAt), {
                          addSuffix: true,
                        })}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <InitiateTrustDialog open={dialogOpen} onOpenChange={setDialogOpen} />
    </div>
  );
}
