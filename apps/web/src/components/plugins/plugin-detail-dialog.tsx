"use client";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { usePluginRegistryEntry } from "@/hooks/use-plugin-registry";
import { toast } from "sonner";
import { Check, Copy, ExternalLink, ShieldCheck } from "lucide-react";
import { useState } from "react";

interface PluginDetailDialogProps {
  pluginId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    toast.success("Copied!");
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <Button
      variant="ghost"
      size="icon"
      className="h-6 w-6 shrink-0"
      onClick={handleCopy}
    >
      {copied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
    </Button>
  );
}

export function PluginDetailDialog({
  pluginId,
  open,
  onOpenChange,
}: PluginDetailDialogProps) {
  const { plugin, isLoading } = usePluginRegistryEntry(pluginId);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
        {isLoading && (
          <div className="space-y-4 p-4">
            <Skeleton className="h-6 w-48" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-3/4" />
          </div>
        )}

        {plugin && (
          <>
            <DialogHeader>
              <div className="flex items-center gap-2">
                <DialogTitle>{plugin.name}</DialogTitle>
                <Badge variant="outline">v{plugin.version}</Badge>
              </div>
              <DialogDescription>{plugin.author}</DialogDescription>
              <div className="flex flex-wrap gap-1.5 pt-1">
                {plugin.installed && (
                  <Badge variant="default" className="bg-green-600">
                    Installed
                  </Badge>
                )}
                {plugin.verified && (
                  <Badge variant="secondary" className="gap-1">
                    <ShieldCheck className="h-3 w-3" />
                    Verified
                  </Badge>
                )}
              </div>
            </DialogHeader>

            <div className="space-y-4">
              {/* Description */}
              <div>
                <p className="text-sm text-muted-foreground">
                  {plugin.readme ?? plugin.description}
                </p>
              </div>

              {/* Install section */}
              {!plugin.installed && plugin.installCommand && (
                <div className="space-y-2">
                  <h4 className="text-sm font-medium">Install</h4>
                  <div className="flex items-center gap-2 rounded-md bg-muted p-2">
                    <code className="flex-1 text-xs break-all">
                      {plugin.installCommand}
                    </code>
                    <CopyButton text={plugin.installCommand} />
                  </div>
                </div>
              )}

              {!plugin.installed && plugin.configExample && (
                <div className="space-y-2">
                  <h4 className="text-sm font-medium">Configuration Example</h4>
                  <div className="relative rounded-md bg-muted p-2">
                    <div className="absolute right-2 top-2">
                      <CopyButton text={plugin.configExample} />
                    </div>
                    <pre className="text-xs overflow-x-auto whitespace-pre-wrap pr-8">
                      {plugin.configExample}
                    </pre>
                  </div>
                </div>
              )}

              {/* Permissions */}
              {plugin.permissions && plugin.permissions.length > 0 && (
                <div className="space-y-2">
                  <h4 className="text-sm font-medium">Permissions</h4>
                  <div className="flex flex-wrap gap-1.5">
                    {plugin.permissions.map((perm) => (
                      <Badge key={perm} variant="outline">
                        {perm}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}

              {/* Details */}
              <div className="space-y-1 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Category</span>
                  <span>{plugin.category}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">License</span>
                  <span>{plugin.license}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">
                    Colophony Version
                  </span>
                  <span>{plugin.colophonyVersion}</span>
                </div>
                {plugin.adapters && plugin.adapters.length > 0 && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Adapters</span>
                    <span>{plugin.adapters.join(", ")}</span>
                  </div>
                )}
              </div>
            </div>

            <DialogFooter className="gap-2 sm:gap-0">
              {plugin.repository && (
                <Button variant="outline" size="sm" asChild>
                  <a
                    href={plugin.repository}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    <ExternalLink className="mr-1.5 h-3.5 w-3.5" />
                    Repository
                  </a>
                </Button>
              )}
              {plugin.homepage && (
                <Button variant="outline" size="sm" asChild>
                  <a
                    href={plugin.homepage}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    <ExternalLink className="mr-1.5 h-3.5 w-3.5" />
                    Homepage
                  </a>
                </Button>
              )}
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
