"use client";

import type { PluginComponentProps } from "@/lib/plugin-components";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { BarChart3 } from "lucide-react";

export function WordCountWidget(_props: PluginComponentProps) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-sm font-medium">
          <BarChart3 className="h-4 w-4 text-muted-foreground" />
          Word Count Stats
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <p className="text-2xl font-bold">12,847</p>
            <p className="text-xs text-muted-foreground">Total Words</p>
          </div>
          <div>
            <p className="text-2xl font-bold">42</p>
            <p className="text-xs text-muted-foreground">Submissions</p>
          </div>
          <div>
            <p className="text-2xl font-bold">306</p>
            <p className="text-xs text-muted-foreground">Avg per Piece</p>
          </div>
          <div>
            <p className="text-2xl font-bold">3,201</p>
            <p className="text-xs text-muted-foreground">Longest Piece</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
