"use client";

import { formatDistanceToNow } from "date-fns";
import { FileText, Loader2, Plus, Send } from "lucide-react";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";

interface AddSubmissionDialogProps {
  groupId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function AddSubmissionDialog({
  groupId,
  open,
  onOpenChange,
}: AddSubmissionDialogProps) {
  const utils = trpc.useUtils();

  const { data: colophonySubs, isPending: loadingColophony } =
    trpc.simsubGroups.availableSubmissions.useQuery(
      { groupId },
      { enabled: open },
    );

  const { data: externalSubs, isPending: loadingExternal } =
    trpc.simsubGroups.availableExternalSubmissions.useQuery(
      { groupId },
      { enabled: open },
    );

  const addMutation = trpc.simsubGroups.addSubmission.useMutation({
    onSuccess: () => {
      toast.success("Submission added to group");
      utils.simsubGroups.getById.invalidate({ id: groupId });
      utils.simsubGroups.availableSubmissions.invalidate({ groupId });
      utils.simsubGroups.availableExternalSubmissions.invalidate({ groupId });
    },
    onError: (err) => {
      toast.error(err.message);
    },
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Add Submission</DialogTitle>
        </DialogHeader>

        <Tabs defaultValue="colophony">
          <TabsList className="w-full">
            <TabsTrigger value="colophony" className="flex-1">
              <FileText className="mr-1 h-3 w-3" />
              Colophony
            </TabsTrigger>
            <TabsTrigger value="external" className="flex-1">
              <Send className="mr-1 h-3 w-3" />
              External
            </TabsTrigger>
          </TabsList>

          <TabsContent value="colophony" className="mt-4">
            {loadingColophony && (
              <div className="space-y-2">
                {Array.from({ length: 3 }).map((_, i) => (
                  <Skeleton key={i} className="h-12" />
                ))}
              </div>
            )}

            {!loadingColophony && colophonySubs?.length === 0 && (
              <p className="text-sm text-muted-foreground text-center py-6">
                No available submissions to add.
              </p>
            )}

            {!loadingColophony && colophonySubs && colophonySubs.length > 0 && (
              <div className="space-y-2 max-h-80 overflow-y-auto">
                {colophonySubs.map((sub) => (
                  <div
                    key={sub.id}
                    className="flex items-center justify-between gap-3 p-3 rounded-md border"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium truncate">
                        {sub.title}
                      </p>
                      <div className="flex items-center gap-2 mt-1">
                        <Badge variant="outline" className="text-xs">
                          {sub.status}
                        </Badge>
                      </div>
                    </div>
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={addMutation.isPending}
                      onClick={() =>
                        addMutation.mutate({
                          groupId,
                          submissionId: sub.id,
                        })
                      }
                    >
                      {addMutation.isPending ? (
                        <Loader2 className="h-3 w-3 animate-spin" />
                      ) : (
                        <Plus className="h-3 w-3" />
                      )}
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </TabsContent>

          <TabsContent value="external" className="mt-4">
            {loadingExternal && (
              <div className="space-y-2">
                {Array.from({ length: 3 }).map((_, i) => (
                  <Skeleton key={i} className="h-12" />
                ))}
              </div>
            )}

            {!loadingExternal && externalSubs?.length === 0 && (
              <p className="text-sm text-muted-foreground text-center py-6">
                No available external submissions to add.
              </p>
            )}

            {!loadingExternal && externalSubs && externalSubs.length > 0 && (
              <div className="space-y-2 max-h-80 overflow-y-auto">
                {externalSubs.map((sub) => (
                  <div
                    key={sub.id}
                    className="flex items-center justify-between gap-3 p-3 rounded-md border"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium truncate">
                        {sub.journalName}
                      </p>
                      <div className="flex items-center gap-2 mt-1">
                        <Badge variant="outline" className="text-xs">
                          {sub.status}
                        </Badge>
                        {sub.sentAt && (
                          <span className="text-xs text-muted-foreground">
                            Sent{" "}
                            {formatDistanceToNow(new Date(sub.sentAt), {
                              addSuffix: true,
                            })}
                          </span>
                        )}
                      </div>
                    </div>
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={addMutation.isPending}
                      onClick={() =>
                        addMutation.mutate({
                          groupId,
                          externalSubmissionId: sub.id,
                        })
                      }
                    >
                      {addMutation.isPending ? (
                        <Loader2 className="h-3 w-3 animate-spin" />
                      ) : (
                        <Plus className="h-3 w-3" />
                      )}
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
