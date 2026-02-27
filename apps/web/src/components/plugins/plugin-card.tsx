"use client";

import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { ShieldCheck } from "lucide-react";

export interface PluginCardData {
  id: string;
  name: string;
  description: string;
  author: string;
  category: string;
  version: string;
  installed: boolean;
  verified?: boolean;
  tags?: string[];
}

interface PluginCardProps {
  plugin: PluginCardData;
  onClick: (pluginId: string) => void;
}

export function PluginCard({ plugin, onClick }: PluginCardProps) {
  return (
    <button
      type="button"
      className="text-left w-full"
      onClick={() => onClick(plugin.id)}
    >
      <Card className="h-full transition-colors hover:border-primary/50 hover:shadow-sm">
        <CardHeader className="pb-2">
          <CardTitle className="text-base">{plugin.name}</CardTitle>
          <CardDescription>{plugin.author}</CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground line-clamp-2 mb-3">
            {plugin.description}
          </p>
          <div className="flex flex-wrap gap-1.5">
            <Badge variant="outline">{plugin.category}</Badge>
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
        </CardContent>
      </Card>
    </button>
  );
}
