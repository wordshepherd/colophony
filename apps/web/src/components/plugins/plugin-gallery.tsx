"use client";

import { useState, useMemo } from "react";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Skeleton } from "@/components/ui/skeleton";
import { Card } from "@/components/ui/card";
import { Search } from "lucide-react";
import { usePluginRegistry } from "@/hooks/use-plugin-registry";
import { PluginCard } from "./plugin-card";
import { PluginDetailDialog } from "./plugin-detail-dialog";

const CATEGORIES = [
  { value: "all", label: "All" },
  { value: "adapter", label: "Adapters" },
  { value: "integration", label: "Integrations" },
  { value: "workflow", label: "Workflow" },
  { value: "import-export", label: "Import/Export" },
  { value: "report", label: "Reports" },
  { value: "theme", label: "Themes" },
  { value: "block", label: "Blocks" },
  { value: "notification", label: "Notifications" },
] as const;

export function PluginGallery() {
  const { plugins, isLoading, error } = usePluginRegistry();
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("all");
  const [selectedPluginId, setSelectedPluginId] = useState<string | null>(null);

  const filtered = useMemo(() => {
    let result = plugins;

    if (category !== "all") {
      result = result.filter((p) => p.category === category);
    }

    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter(
        (p) =>
          p.name.toLowerCase().includes(q) ||
          p.description.toLowerCase().includes(q) ||
          p.tags?.some((t) => t.toLowerCase().includes(q)),
      );
    }

    return result;
  }, [plugins, search, category]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Plugins</h1>
        <p className="text-muted-foreground">
          Browse and discover plugins for your Colophony instance.
        </p>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Search plugins..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9"
        />
      </div>

      {/* Category tabs */}
      <Tabs value={category} onValueChange={setCategory}>
        <TabsList className="flex-wrap h-auto gap-1">
          {CATEGORIES.map((cat) => (
            <TabsTrigger key={cat.value} value={cat.value}>
              {cat.label}
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>

      {/* Error state */}
      {error && (
        <Alert variant="destructive">
          <AlertDescription>
            Failed to load plugin registry: {error.message}
          </AlertDescription>
        </Alert>
      )}

      {/* Loading state */}
      {isLoading && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <Card key={i} className="p-6 space-y-3">
              <Skeleton className="h-5 w-32" />
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-3/4" />
            </Card>
          ))}
        </div>
      )}

      {/* Plugin grid */}
      {!isLoading && !error && filtered.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((plugin) => (
            <PluginCard
              key={plugin.id}
              plugin={plugin}
              onClick={setSelectedPluginId}
            />
          ))}
        </div>
      )}

      {/* Empty state */}
      {!isLoading && !error && filtered.length === 0 && (
        <div className="text-center py-12">
          <p className="text-muted-foreground">No plugins found.</p>
        </div>
      )}

      {/* Detail dialog */}
      <PluginDetailDialog
        pluginId={selectedPluginId}
        open={!!selectedPluginId}
        onOpenChange={(open) => {
          if (!open) setSelectedPluginId(null);
        }}
      />
    </div>
  );
}
