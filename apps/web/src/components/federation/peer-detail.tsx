"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowLeft, Copy, Check } from "lucide-react";
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
import { AcceptPeerDialog } from "./accept-peer-dialog";
import { toast } from "sonner";
import { format } from "date-fns";

const STATUS_VARIANT: Record<
  string,
  "default" | "secondary" | "destructive" | "outline"
> = {
  active: "default",
  pending_outbound: "secondary",
  pending_inbound: "secondary",
  rejected: "destructive",
  revoked: "destructive",
};

const CAPABILITY_DESCRIPTIONS: Record<string, string> = {
  "identity.verify": "Verify writer identity across instances",
  "identity.migrate": "Allow writers to migrate their identity",
  "simsub.check": "Check for simultaneous submissions",
  "simsub.respond": "Respond to sim-sub check requests",
  "transfer.initiate": "Initiate piece transfers to this peer",
  "transfer.receive": "Receive piece transfers from this peer",
};

interface PeerDetailProps {
  peerId: string;
}

export function PeerDetail({ peerId }: PeerDetailProps) {
  const utils = trpc.useUtils();
  const {
    data: peer,
    isPending: isLoading,
    error,
  } = trpc.federation.getPeer.useQuery({ id: peerId });

  const [acceptOpen, setAcceptOpen] = useState(false);
  const [copied, setCopied] = useState(false);

  const rejectMutation = trpc.federation.rejectPeer.useMutation({
    onSuccess: () => {
      toast.success("Trust request rejected");
      utils.federation.getPeer.invalidate({ id: peerId });
      utils.federation.listPeers.invalidate();
    },
    onError: (error) => toast.error(error.message),
  });

  const revokeMutation = trpc.federation.revokePeer.useMutation({
    onSuccess: () => {
      toast.success("Trust revoked");
      utils.federation.getPeer.invalidate({ id: peerId });
      utils.federation.listPeers.invalidate();
    },
    onError: (error) => toast.error(error.message),
  });

  const handleCopyKey = async () => {
    if (!peer?.publicKey) return;
    await navigator.clipboard.writeText(peer.publicKey);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (error || !peer) {
    return (
      <div className="space-y-6">
        <Button variant="ghost" size="sm" asChild>
          <Link href="/federation/peers">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Peers
          </Link>
        </Button>
        <p className="text-muted-foreground">Peer not found.</p>
      </div>
    );
  }

  const grantedCaps = Object.entries(peer.grantedCapabilities).filter(
    ([, v]) => v,
  );

  return (
    <div className="space-y-6">
      {/* Back + Header */}
      <Button variant="ghost" size="sm" asChild>
        <Link href="/federation/peers">
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to Peers
        </Link>
      </Button>

      <div className="flex items-center gap-3">
        <h1 className="text-2xl font-bold">{peer.domain}</h1>
        <Badge variant={STATUS_VARIANT[peer.status] ?? "outline"}>
          {peer.status.replace(/_/g, " ")}
        </Badge>
      </div>

      {/* Info card */}
      <Card>
        <CardHeader>
          <CardTitle>Peer Information</CardTitle>
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
                    href={peer.instanceUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-primary hover:underline"
                  >
                    {peer.instanceUrl}
                  </a>
                </p>
              </div>
              <div>
                <span className="text-sm font-medium text-muted-foreground">
                  Public Key
                </span>
                <div className="flex items-center gap-2">
                  <p className="text-sm font-mono truncate max-w-[280px]">
                    {peer.publicKey.slice(0, 40)}...
                  </p>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6"
                    onClick={handleCopyKey}
                  >
                    {copied ? (
                      <Check className="h-3 w-3" />
                    ) : (
                      <Copy className="h-3 w-3" />
                    )}
                  </Button>
                </div>
              </div>
              <div>
                <span className="text-sm font-medium text-muted-foreground">
                  Key ID
                </span>
                <p className="text-sm font-mono">{peer.keyId}</p>
              </div>
              <div>
                <span className="text-sm font-medium text-muted-foreground">
                  Protocol Version
                </span>
                <p className="text-sm">{peer.protocolVersion}</p>
              </div>
            </div>
            <div className="space-y-3">
              <div>
                <span className="text-sm font-medium text-muted-foreground">
                  Initiated By
                </span>
                <p className="text-sm capitalize">{peer.initiatedBy}</p>
              </div>
              <div>
                <span className="text-sm font-medium text-muted-foreground">
                  Last Verified
                </span>
                <p className="text-sm">
                  {peer.lastVerifiedAt
                    ? format(new Date(peer.lastVerifiedAt), "PPpp")
                    : "Never"}
                </p>
              </div>
              <div>
                <span className="text-sm font-medium text-muted-foreground">
                  Created
                </span>
                <p className="text-sm">
                  {format(new Date(peer.createdAt), "PPpp")}
                </p>
              </div>
              <div>
                <span className="text-sm font-medium text-muted-foreground">
                  Updated
                </span>
                <p className="text-sm">
                  {format(new Date(peer.updatedAt), "PPpp")}
                </p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Capabilities card */}
      <Card>
        <CardHeader>
          <CardTitle>Granted Capabilities</CardTitle>
        </CardHeader>
        <CardContent>
          {grantedCaps.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No capabilities granted yet.
            </p>
          ) : (
            <div className="space-y-2">
              {grantedCaps.map(([key]) => (
                <div key={key} className="flex items-center gap-2">
                  <Badge variant="secondary">{key}</Badge>
                  <span className="text-sm text-muted-foreground">
                    {CAPABILITY_DESCRIPTIONS[key] ?? ""}
                  </span>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Actions */}
      <Card>
        <CardHeader>
          <CardTitle>Actions</CardTitle>
        </CardHeader>
        <CardContent>
          {peer.status === "pending_inbound" && (
            <div className="flex gap-3">
              <Button onClick={() => setAcceptOpen(true)}>Accept</Button>
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant="destructive">Reject</Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Reject Trust Request</AlertDialogTitle>
                    <AlertDialogDescription>
                      Are you sure you want to reject the trust request from{" "}
                      <strong>{peer.domain}</strong>? This action cannot be
                      undone.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction
                      onClick={() => rejectMutation.mutate({ id: peerId })}
                    >
                      Reject
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>
          )}

          {peer.status === "active" && (
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="destructive">Revoke Trust</Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Revoke Trust</AlertDialogTitle>
                  <AlertDialogDescription>
                    Are you sure you want to revoke trust with{" "}
                    <strong>{peer.domain}</strong>? This will terminate all
                    federation capabilities with this instance.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction
                    onClick={() => revokeMutation.mutate({ id: peerId })}
                  >
                    Revoke
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          )}

          {peer.status === "pending_outbound" && (
            <p className="text-sm text-muted-foreground">
              Waiting for the remote instance to accept your trust request.
            </p>
          )}

          {(peer.status === "rejected" || peer.status === "revoked") && (
            <p className="text-sm text-muted-foreground">
              This trust relationship has been {peer.status}. No actions
              available.
            </p>
          )}
        </CardContent>
      </Card>

      <AcceptPeerDialog
        peerId={peerId}
        peerDomain={peer.domain}
        open={acceptOpen}
        onOpenChange={setAcceptOpen}
      />
    </div>
  );
}
