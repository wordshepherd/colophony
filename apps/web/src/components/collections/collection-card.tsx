"use client";

import Link from "next/link";
import { formatDistanceToNow } from "date-fns";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  BookOpen,
  Eye,
  EyeOff,
  FolderOpen,
  Layers,
  ListTodo,
  Users,
} from "lucide-react";
import type {
  CollectionVisibility,
  CollectionTypeHint,
} from "@colophony/types";

const typeHintLabels: Record<CollectionTypeHint, string> = {
  holds: "Holds",
  reading_list: "Reading List",
  comparison: "Comparison",
  issue_planning: "Issue Planning",
  custom: "Custom",
};

const typeHintIcons: Record<CollectionTypeHint, typeof FolderOpen> = {
  holds: ListTodo,
  reading_list: BookOpen,
  comparison: Layers,
  issue_planning: Layers,
  custom: FolderOpen,
};

function VisibilityIcon({ visibility }: { visibility: CollectionVisibility }) {
  switch (visibility) {
    case "team":
    case "collaborators":
      return <Users className="h-3.5 w-3.5 text-muted-foreground" />;
    case "private":
      return <EyeOff className="h-3.5 w-3.5 text-muted-foreground" />;
    default:
      return <Eye className="h-3.5 w-3.5 text-muted-foreground" />;
  }
}

interface CollectionCardProps {
  collection: {
    id: string;
    name: string;
    description: string | null;
    visibility: CollectionVisibility;
    typeHint: CollectionTypeHint;
    updatedAt: Date | string;
  };
  itemCount?: number;
}

export function CollectionCard({ collection, itemCount }: CollectionCardProps) {
  const Icon = typeHintIcons[collection.typeHint];
  const updated =
    typeof collection.updatedAt === "string"
      ? new Date(collection.updatedAt)
      : collection.updatedAt;

  return (
    <Link href={`/editor/collections/${collection.id}`}>
      <Card className="hover:border-primary/50 transition-colors h-full">
        <CardHeader className="pb-2">
          <div className="flex items-start justify-between gap-2">
            <div className="flex items-center gap-2 min-w-0 flex-1">
              <Icon className="h-4 w-4 shrink-0 text-muted-foreground" />
              <CardTitle className="text-base line-clamp-1">
                {collection.name}
              </CardTitle>
            </div>
            <div className="flex items-center gap-1.5 shrink-0">
              <VisibilityIcon visibility={collection.visibility} />
              <Badge variant="secondary" className="text-xs">
                {typeHintLabels[collection.typeHint]}
              </Badge>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {collection.description && (
            <p className="text-sm text-muted-foreground line-clamp-2 mb-2">
              {collection.description}
            </p>
          )}
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>
              {itemCount !== undefined
                ? `${itemCount} item${itemCount !== 1 ? "s" : ""}`
                : ""}
            </span>
            <span>
              Updated {formatDistanceToNow(updated, { addSuffix: true })}
            </span>
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}
