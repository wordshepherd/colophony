"use client";

import Link from "next/link";
import { formatDistanceToNow } from "date-fns";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { PublicationStatusBadge } from "./publication-status-badge";
import { MoreHorizontal, Eye, Archive } from "lucide-react";
import type { PublicationStatus } from "@colophony/types";

interface PublicationCardProps {
  publication: {
    id: string;
    name: string;
    slug: string;
    description: string | null;
    status: PublicationStatus;
    createdAt: Date | string;
    updatedAt: Date | string;
  };
  onArchive?: (id: string) => void;
  isAdmin: boolean;
}

export function PublicationCard({
  publication,
  onArchive,
  isAdmin,
}: PublicationCardProps) {
  return (
    <Card className="hover:border-primary/50 transition-colors">
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between gap-2">
          <Link
            href={`/slate/publications/${publication.id}`}
            className="flex-1 min-w-0"
          >
            <CardTitle className="text-base line-clamp-2 hover:underline cursor-pointer">
              {publication.name}
            </CardTitle>
          </Link>
          <div className="flex items-center gap-2 shrink-0">
            <PublicationStatusBadge status={publication.status} />
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="h-8 w-8">
                  <MoreHorizontal className="h-4 w-4" />
                  <span className="sr-only">Actions</span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem asChild>
                  <Link href={`/slate/publications/${publication.id}`}>
                    <Eye className="mr-2 h-4 w-4" />
                    View
                  </Link>
                </DropdownMenuItem>
                {publication.status === "ACTIVE" && isAdmin && onArchive && (
                  <>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onClick={() => onArchive(publication.id)}>
                      <Archive className="mr-2 h-4 w-4" />
                      Archive
                    </DropdownMenuItem>
                  </>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {publication.description && (
          <p className="text-sm text-muted-foreground line-clamp-2 mb-2">
            {publication.description}
          </p>
        )}
        <div className="flex items-center gap-3 text-xs text-muted-foreground">
          <span>/{publication.slug}</span>
          <span>
            Updated{" "}
            {formatDistanceToNow(new Date(publication.updatedAt), {
              addSuffix: true,
            })}
          </span>
        </div>
      </CardContent>
    </Card>
  );
}
