"use client";

import { format } from "date-fns";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { ArrowUpRight, ArrowDownLeft, Mail } from "lucide-react";

interface CorrespondenceHistoryProps {
  submissionId: string;
}

export function CorrespondenceHistory({
  submissionId,
}: CorrespondenceHistoryProps) {
  const { data: items, isPending: isLoading } =
    trpc.correspondence.listBySubmission.useQuery({ submissionId });

  return (
    <Card>
      <CardHeader>
        <CardTitle>Correspondence</CardTitle>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="space-y-3">
            <Skeleton className="h-16 w-full" />
            <Skeleton className="h-16 w-full" />
          </div>
        ) : items && items.length > 0 ? (
          <div className="space-y-4">
            {items.map((item) => {
              const DirectionIcon =
                item.direction === "outbound" ? ArrowUpRight : ArrowDownLeft;
              return (
                <div
                  key={item.id}
                  className="flex gap-3 text-sm border-b pb-3 last:border-0 last:pb-0"
                >
                  <DirectionIcon className="h-4 w-4 mt-0.5 flex-shrink-0 text-muted-foreground" />
                  <div className="flex-1 min-w-0 space-y-1">
                    <div className="flex items-center gap-2">
                      {item.subject && (
                        <span className="font-medium truncate">
                          {item.subject}
                        </span>
                      )}
                      {item.isPersonalized && (
                        <Badge variant="secondary" className="text-xs">
                          Personalized
                        </Badge>
                      )}
                    </div>
                    <p className="text-muted-foreground truncate">
                      {item.bodyPreview}
                    </p>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <span>{format(new Date(item.sentAt), "PPp")}</span>
                      {item.senderName && (
                        <span>&middot; {item.senderName}</span>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="flex flex-col items-center gap-2 py-6 text-muted-foreground">
            <Mail className="h-8 w-8" />
            <p className="text-sm">No correspondence yet</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
