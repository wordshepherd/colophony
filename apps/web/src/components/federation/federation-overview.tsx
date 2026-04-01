"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import {
  Network,
  Pencil,
  Copy,
  Check,
  Search,
  ArrowRightLeft,
  UserRoundCog,
  Server,
  ScrollText,
} from "lucide-react";
import { trpc } from "@/lib/trpc";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";

const ALL_CAPABILITIES = [
  "identity.verify",
  "identity.migrate",
  "simsub.check",
  "simsub.respond",
  "transfer.initiate",
  "transfer.receive",
];

export function FederationOverview() {
  const { data: config, isPending: isConfigLoading } =
    trpc.federation.getConfig.useQuery();
  const { data: peers, isPending: isPeersLoading } =
    trpc.federation.listPeers.useQuery();

  const peerCounts = useMemo(() => {
    if (!peers) return { active: 0, pendingInbound: 0, pendingOutbound: 0 };
    return {
      active: peers.filter((p) => p.status === "active").length,
      pendingInbound: peers.filter((p) => p.status === "pending_inbound")
        .length,
      pendingOutbound: peers.filter((p) => p.status === "pending_outbound")
        .length,
    };
  }, [peers]);

  const [copied, setCopied] = useState(false);

  const handleCopyKey = async () => {
    if (!config?.publicKey) return;
    await navigator.clipboard.writeText(config.publicKey);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (isConfigLoading || isPeersLoading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-3">
          <Skeleton className="h-8 w-8" />
          <Skeleton className="h-8 w-40" />
        </div>
        <Skeleton className="h-48 w-full" />
        <Skeleton className="h-32 w-full" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Network className="h-8 w-8" />
        <h1 className="text-2xl font-bold">Federation</h1>
      </div>

      {/* Status card */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle>Instance Configuration</CardTitle>
            <CardDescription>
              Federation settings for this instance
            </CardDescription>
          </div>
          <ConfigEditDialog />
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium text-muted-foreground">
                  Status
                </span>
                {config?.enabled ? (
                  <Badge
                    variant="outline"
                    className="border-status-success text-status-success"
                  >
                    Enabled
                  </Badge>
                ) : (
                  <Badge variant="secondary">Disabled</Badge>
                )}
              </div>
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium text-muted-foreground">
                  Mode
                </span>
                <Badge variant="outline">{config?.mode}</Badge>
              </div>
              <div>
                <span className="text-sm font-medium text-muted-foreground">
                  Capabilities
                </span>
                <div className="mt-1 flex flex-wrap gap-1">
                  {config?.capabilities.map((cap) => (
                    <Badge key={cap} variant="secondary">
                      {cap}
                    </Badge>
                  ))}
                </div>
              </div>
            </div>
            <div className="space-y-3">
              <div>
                <span className="text-sm font-medium text-muted-foreground">
                  Contact Email
                </span>
                <p className="text-sm">{config?.contactEmail ?? "Not set"}</p>
              </div>
              <div>
                <span className="text-sm font-medium text-muted-foreground">
                  Key ID
                </span>
                <p className="text-sm font-mono">{config?.keyId}</p>
              </div>
              <div>
                <span className="text-sm font-medium text-muted-foreground">
                  Public Key
                </span>
                <div className="flex items-center gap-2">
                  <p className="text-sm font-mono truncate max-w-[280px]">
                    {config?.publicKey.slice(0, 40)}...
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
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Navigation cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <Card className="transition-colors hover:bg-accent">
          <Link href="/federation/sim-sub" className="block">
            <CardHeader className="pb-2">
              <div className="flex items-center gap-2">
                <Search className="h-5 w-5 text-muted-foreground" />
                <CardTitle className="text-base">Sim-Sub Checks</CardTitle>
              </div>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                Look up simultaneous submission check history and manage
                overrides.
              </p>
            </CardContent>
          </Link>
        </Card>

        <Card className="transition-colors hover:bg-accent">
          <Link href="/federation/transfers" className="block">
            <CardHeader className="pb-2">
              <div className="flex items-center gap-2">
                <ArrowRightLeft className="h-5 w-5 text-muted-foreground" />
                <CardTitle className="text-base">Piece Transfers</CardTitle>
              </div>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                View and manage submission transfers between instances.
              </p>
            </CardContent>
          </Link>
        </Card>

        <Card className="transition-colors hover:bg-accent">
          <Link href="/federation/migrations" className="block">
            <CardHeader className="pb-2">
              <div className="flex items-center gap-2">
                <UserRoundCog className="h-5 w-5 text-muted-foreground" />
                <CardTitle className="text-base">Identity Migrations</CardTitle>
              </div>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                Manage writer identity migration requests and approvals.
              </p>
            </CardContent>
          </Link>
        </Card>

        <Card className="transition-colors hover:bg-accent">
          <Link href="/federation/hub" className="block">
            <CardHeader className="pb-2">
              <div className="flex items-center gap-2">
                <Server className="h-5 w-5 text-muted-foreground" />
                <CardTitle className="text-base">Hub Administration</CardTitle>
              </div>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                Manage hub-registered instances (requires managed hub mode).
              </p>
            </CardContent>
          </Link>
        </Card>

        <Card className="transition-colors hover:bg-accent">
          <Link href="/federation/audit" className="block">
            <CardHeader className="pb-2">
              <div className="flex items-center gap-2">
                <ScrollText className="h-5 w-5 text-muted-foreground" />
                <CardTitle className="text-base">Audit Log</CardTitle>
              </div>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                View the audit trail for all federation and system events.
              </p>
            </CardContent>
          </Link>
        </Card>
      </div>

      {/* Peer summary card */}
      <Card>
        <CardHeader>
          <CardTitle>Trusted Peers</CardTitle>
          <CardDescription>
            Overview of federation relationships
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <Badge
                variant="outline"
                className="border-status-success text-status-success"
              >
                {peerCounts.active} Active
              </Badge>
            </div>
            <div className="flex items-center gap-2">
              <Badge
                variant="outline"
                className="border-status-warning text-status-warning"
              >
                {peerCounts.pendingInbound} Pending Inbound
              </Badge>
            </div>
            <div className="flex items-center gap-2">
              <Badge
                variant="outline"
                className="border-status-warning text-status-warning"
              >
                {peerCounts.pendingOutbound} Pending Outbound
              </Badge>
            </div>
          </div>
          <div className="mt-4">
            <Button variant="outline" asChild>
              <Link href="/federation/peers">Manage Peers &rarr;</Link>
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function ConfigEditDialog() {
  const [open, setOpen] = useState(false);
  const { data: config } = trpc.federation.getConfig.useQuery();
  const utils = trpc.useUtils();

  const [mode, setMode] = useState<string>("");
  const [contactEmail, setContactEmail] = useState("");
  const [capabilities, setCapabilities] = useState<string[]>([]);

  const updateMutation = trpc.federation.updateConfig.useMutation({
    onSuccess: () => {
      toast.success("Federation config updated");
      utils.federation.getConfig.invalidate();
      setOpen(false);
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });

  const handleOpen = (isOpen: boolean) => {
    if (isOpen && config) {
      setMode(config.mode);
      setContactEmail(config.contactEmail ?? "");
      setCapabilities(config.capabilities);
    }
    setOpen(isOpen);
  };

  const handleSubmit = () => {
    updateMutation.mutate({
      mode: mode as "allowlist" | "open" | "managed_hub",
      contactEmail: contactEmail || null,
      capabilities,
    });
  };

  const toggleCapability = (cap: string) => {
    setCapabilities((prev) =>
      prev.includes(cap) ? prev.filter((c) => c !== cap) : [...prev, cap],
    );
  };

  return (
    <Dialog open={open} onOpenChange={handleOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <Pencil className="mr-2 h-4 w-4" />
          Edit
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Edit Federation Config</DialogTitle>
          <DialogDescription>
            Update federation mode, contact email, and capabilities.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="mode">Mode</Label>
            <Select value={mode} onValueChange={setMode}>
              <SelectTrigger>
                <SelectValue placeholder="Select mode" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="allowlist">Allowlist</SelectItem>
                <SelectItem value="open">Open</SelectItem>
                <SelectItem value="managed_hub">Managed Hub</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="contactEmail">Contact Email</Label>
            <Input
              id="contactEmail"
              type="email"
              value={contactEmail}
              onChange={(e) => setContactEmail(e.target.value)}
              placeholder="admin@example.com"
            />
          </div>
          <div className="space-y-2">
            <Label>Capabilities</Label>
            <div className="space-y-2">
              {ALL_CAPABILITIES.map((cap) => (
                <div key={cap} className="flex items-center gap-2">
                  <Checkbox
                    id={`cap-${cap}`}
                    checked={capabilities.includes(cap)}
                    onCheckedChange={() => toggleCapability(cap)}
                  />
                  <Label htmlFor={`cap-${cap}`} className="font-normal">
                    {cap}
                  </Label>
                </div>
              ))}
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={updateMutation.isPending}>
            Save Changes
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
