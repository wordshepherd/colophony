"use client";

import Link from "next/link";
import { formatDistanceToNow } from "date-fns";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface ManuscriptCardProps {
  manuscript: {
    id: string;
    title: string;
    description: string | null;
    updatedAt: Date | string;
  };
}

export function ManuscriptCard({ manuscript }: ManuscriptCardProps) {
  return (
    <Link href={`/manuscripts/${manuscript.id}`}>
      <Card className="hover:border-primary/50 transition-colors cursor-pointer h-full">
        <CardHeader className="pb-2">
          <CardTitle className="text-base line-clamp-2">
            {manuscript.title}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {manuscript.description && (
            <p className="text-sm text-muted-foreground line-clamp-2 mb-2">
              {manuscript.description}
            </p>
          )}
          <p className="text-xs text-muted-foreground">
            Updated{" "}
            {formatDistanceToNow(new Date(manuscript.updatedAt), {
              addSuffix: true,
            })}
          </p>
        </CardContent>
      </Card>
    </Link>
  );
}
