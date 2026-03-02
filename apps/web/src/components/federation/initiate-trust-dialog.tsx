"use client";

import { useState } from "react";
import { Loader2 } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { Badge } from "@/components/ui/badge";
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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";

const CAPABILITIES = [
  { key: "identity.verify", label: "Identity Verification" },
  { key: "identity.migrate", label: "Identity Migration" },
  { key: "simsub.check", label: "Sim-Sub Check" },
  { key: "simsub.respond", label: "Sim-Sub Respond" },
  { key: "transfer.initiate", label: "Transfer Initiate" },
  { key: "transfer.receive", label: "Transfer Receive" },
];

interface InitiateTrustDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function InitiateTrustDialog({
  open,
  onOpenChange,
}: InitiateTrustDialogProps) {
  const utils = trpc.useUtils();
  const [step, setStep] = useState<1 | 2>(1);
  const [domain, setDomain] = useState("");
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [selectedCaps, setSelectedCaps] = useState<Record<string, boolean>>({});

  const previewQuery = trpc.federation.previewRemote.useQuery(
    { domain },
    { enabled: false },
  );

  const initiateMutation = trpc.federation.initiateTrust.useMutation({
    onSuccess: () => {
      toast.success("Trust request sent successfully");
      utils.federation.listPeers.invalidate();
      resetAndClose();
    },
    onError: (error) => {
      if (error.data?.code === "CONFLICT") {
        toast.error("Already trusted with this domain");
      } else {
        toast.error(error.message);
      }
    },
  });

  const resetAndClose = () => {
    setStep(1);
    setDomain("");
    setPreviewError(null);
    setSelectedCaps({});
    onOpenChange(false);
  };

  const handlePreview = async () => {
    setPreviewError(null);
    try {
      const result = await previewQuery.refetch();
      if (result.error) {
        setPreviewError(result.error.message);
        return;
      }
      if (result.data) {
        // Pre-select capabilities based on remote's advertised capabilities
        const caps: Record<string, boolean> = {};
        for (const c of CAPABILITIES) {
          if (result.data.capabilities.includes(c.key)) {
            caps[c.key] = true;
          }
        }
        setSelectedCaps(caps);
        setStep(2);
      }
    } catch {
      setPreviewError("Failed to fetch remote metadata");
    }
  };

  const handleInitiate = () => {
    initiateMutation.mutate({
      domain,
      requestedCapabilities: selectedCaps,
    });
  };

  const toggleCap = (key: string) => {
    setSelectedCaps((prev) => ({
      ...prev,
      [key]: !prev[key],
    }));
  };

  const isDomainValid = /^[a-zA-Z0-9][a-zA-Z0-9.-]+(:\d+)?$/.test(domain);

  return (
    <Dialog open={open} onOpenChange={resetAndClose}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Initiate Trust</DialogTitle>
          <DialogDescription>
            {step === 1
              ? "Enter the domain of the remote Colophony instance."
              : "Select capabilities and confirm the trust request."}
          </DialogDescription>
        </DialogHeader>

        {step === 1 && (
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="domain">Instance Domain</Label>
              <Input
                id="domain"
                value={domain}
                onChange={(e) => setDomain(e.target.value)}
                placeholder="example.com"
              />
            </div>
            {previewError && (
              <p className="text-sm text-destructive">{previewError}</p>
            )}
            <DialogFooter>
              <Button variant="outline" onClick={resetAndClose}>
                Cancel
              </Button>
              <Button
                onClick={handlePreview}
                disabled={!isDomainValid || previewQuery.isFetching}
              >
                {previewQuery.isFetching && (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                )}
                Preview
              </Button>
            </DialogFooter>
          </div>
        )}

        {step === 2 && previewQuery.data && (
          <div className="space-y-4 py-4">
            <Card>
              <CardHeader className="py-3">
                <CardTitle className="text-sm">Remote Instance</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-sm">
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Software</span>
                  <span>
                    {previewQuery.data.software} v{previewQuery.data.version}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Mode</span>
                  <Badge variant="outline">{previewQuery.data.mode}</Badge>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Publications</span>
                  <span>{previewQuery.data.publicationCount}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Contact</span>
                  <span>{previewQuery.data.contactEmail ?? "Not set"}</span>
                </div>
                <div>
                  <span className="text-muted-foreground">Capabilities</span>
                  <div className="mt-1 flex flex-wrap gap-1">
                    {previewQuery.data.capabilities.map((cap) => (
                      <Badge key={cap} variant="secondary">
                        {cap}
                      </Badge>
                    ))}
                  </div>
                </div>
              </CardContent>
            </Card>

            <div className="space-y-2">
              <Label>Request Capabilities</Label>
              <div className="space-y-2">
                {CAPABILITIES.map((cap) => (
                  <div key={cap.key} className="flex items-center gap-2">
                    <Checkbox
                      id={`init-cap-${cap.key}`}
                      checked={!!selectedCaps[cap.key]}
                      onCheckedChange={() => toggleCap(cap.key)}
                    />
                    <Label
                      htmlFor={`init-cap-${cap.key}`}
                      className="font-normal"
                    >
                      {cap.label}
                    </Label>
                  </div>
                ))}
              </div>
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => setStep(1)}>
                Back
              </Button>
              <Button
                onClick={handleInitiate}
                disabled={initiateMutation.isPending}
              >
                {initiateMutation.isPending && (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                )}
                Initiate Trust
              </Button>
            </DialogFooter>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
