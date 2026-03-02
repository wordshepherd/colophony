"use client";

import { useState } from "react";
import { Loader2 } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";

const CAPABILITIES = [
  { key: "identity.verify", label: "Identity Verification" },
  { key: "identity.migrate", label: "Identity Migration" },
  { key: "simsub.check", label: "Sim-Sub Check" },
  { key: "simsub.respond", label: "Sim-Sub Respond" },
  { key: "transfer.initiate", label: "Transfer Initiate" },
  { key: "transfer.receive", label: "Transfer Receive" },
];

interface AcceptPeerDialogProps {
  peerId: string;
  peerDomain: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function AcceptPeerDialog({
  peerId,
  peerDomain,
  open,
  onOpenChange,
}: AcceptPeerDialogProps) {
  const utils = trpc.useUtils();
  const [selectedCaps, setSelectedCaps] = useState<Record<string, boolean>>(
    () => {
      const caps: Record<string, boolean> = {};
      for (const c of CAPABILITIES) {
        caps[c.key] = true;
      }
      return caps;
    },
  );

  const acceptMutation = trpc.federation.acceptPeer.useMutation({
    onSuccess: () => {
      toast.success(`Trust accepted for ${peerDomain}`);
      utils.federation.getPeer.invalidate({ id: peerId });
      utils.federation.listPeers.invalidate();
      onOpenChange(false);
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });

  const toggleCap = (key: string) => {
    setSelectedCaps((prev) => ({
      ...prev,
      [key]: !prev[key],
    }));
  };

  const handleAccept = () => {
    acceptMutation.mutate({
      id: peerId,
      grantedCapabilities: selectedCaps,
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Accept Trust Request</DialogTitle>
          <DialogDescription>
            Grant capabilities to <strong>{peerDomain}</strong>.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label>Grant Capabilities</Label>
            <div className="space-y-2">
              {CAPABILITIES.map((cap) => (
                <div key={cap.key} className="flex items-center gap-2">
                  <Checkbox
                    id={`accept-cap-${cap.key}`}
                    checked={!!selectedCaps[cap.key]}
                    onCheckedChange={() => toggleCap(cap.key)}
                  />
                  <Label
                    htmlFor={`accept-cap-${cap.key}`}
                    className="font-normal"
                  >
                    {cap.label}
                  </Label>
                </div>
              ))}
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleAccept} disabled={acceptMutation.isPending}>
            {acceptMutation.isPending && (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            )}
            Accept &amp; Grant Capabilities
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
