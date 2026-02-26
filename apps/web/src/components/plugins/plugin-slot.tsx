"use client";

import { Component, type ErrorInfo, type ReactNode } from "react";
import {
  usePluginExtensions,
  type UIContributionPoint,
} from "@/hooks/use-plugin-extensions";
import { useOrganization } from "@/hooks/use-organization";
import { useAuth } from "@/hooks/use-auth";
import {
  resolveComponent,
  type PluginComponentProps,
} from "@/lib/plugin-components";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { AlertTriangle } from "lucide-react";

// ---------------------------------------------------------------------------
// Error boundary
// ---------------------------------------------------------------------------

interface ErrorBoundaryProps {
  extensionId: string;
  children: ReactNode;
}

interface ErrorBoundaryState {
  error: Error | null;
}

class PluginErrorBoundary extends Component<
  ErrorBoundaryProps,
  ErrorBoundaryState
> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { error };
  }

  override componentDidCatch(error: Error, info: ErrorInfo): void {
    console.error(
      `[PluginSlot] Extension "${this.props.extensionId}" crashed:`,
      error,
      info,
    );
  }

  override render(): ReactNode {
    if (this.state.error) {
      return (
        <Card className="border-destructive">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-sm text-destructive">
              <AlertTriangle className="h-4 w-4" />
              Plugin Error
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-muted-foreground">
              Extension &quot;{this.props.extensionId}&quot; encountered an
              error: {this.state.error.message}
            </p>
          </CardContent>
        </Card>
      );
    }
    return this.props.children;
  }
}

// ---------------------------------------------------------------------------
// PluginSlot
// ---------------------------------------------------------------------------

export interface PluginSlotProps {
  point: UIContributionPoint;
  context?: Record<string, unknown>;
  className?: string;
  hideEmpty?: boolean;
}

export function PluginSlot({
  point,
  context,
  className,
  hideEmpty = true,
}: PluginSlotProps) {
  const { extensions, isLoading } = usePluginExtensions(point);
  const { currentOrg } = useOrganization();
  const { user } = useAuth();

  if (isLoading || !currentOrg || !user) {
    return null;
  }

  const resolved = extensions
    .map((ext) => ({
      ext,
      Component: resolveComponent(ext.component),
    }))
    .filter(
      (
        entry,
      ): entry is {
        ext: (typeof extensions)[number];
        Component: React.ComponentType<PluginComponentProps>;
      } => entry.Component !== null,
    );

  if (resolved.length === 0 && hideEmpty) {
    return null;
  }

  return (
    <div data-plugin-slot={point} className={className}>
      {resolved.map(({ ext, Component }) => (
        <PluginErrorBoundary key={ext.id} extensionId={ext.id}>
          <Component
            orgId={currentOrg.id}
            userId={user.id}
            role={currentOrg.role}
            extensionId={ext.id}
            context={context}
          />
        </PluginErrorBoundary>
      ))}
    </div>
  );
}
