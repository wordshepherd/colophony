"use client";

import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Badge } from "@/components/ui/badge";
import { Check, UserPlus } from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

interface ReviewerPickerProps {
  submissionId: string;
  existingReviewerIds: string[];
  onAssigned?: () => void;
}

export function ReviewerPicker({
  submissionId,
  existingReviewerIds,
  onAssigned,
}: ReviewerPickerProps) {
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState<string[]>([]);
  const utils = trpc.useUtils();

  const { data: membersData } = trpc.organizations.members.list.useQuery(
    { page: 1, limit: 100 },
    { enabled: open },
  );

  const assignMutation = trpc.submissions.assignReviewers.useMutation({
    onSuccess: () => {
      toast.success("Reviewers assigned");
      setSelected([]);
      setOpen(false);
      utils.submissions.listReviewers.invalidate({ submissionId });
      onAssigned?.();
    },
    onError: (err) => {
      toast.error(err.message);
    },
  });

  const availableMembers = (membersData?.items ?? []).filter(
    (m) => !existingReviewerIds.includes(m.userId),
  );

  const toggleSelect = (userId: string) => {
    setSelected((prev) =>
      prev.includes(userId)
        ? prev.filter((id) => id !== userId)
        : [...prev, userId],
    );
  };

  const handleAssign = () => {
    if (selected.length === 0) return;
    assignMutation.mutate({
      submissionId,
      reviewerUserIds: selected,
    });
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm" className="gap-1.5">
          <UserPlus className="h-4 w-4" />
          Add Reviewer
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80 p-0" align="start">
        <Command shouldFilter={false}>
          <CommandInput placeholder="Search members..." />
          <CommandList>
            <CommandEmpty>No members available</CommandEmpty>
            <CommandGroup>
              {availableMembers.map((member) => (
                <CommandItem
                  key={member.userId}
                  value={member.userId}
                  onSelect={() => toggleSelect(member.userId)}
                >
                  <Check
                    className={cn(
                      "mr-2 h-4 w-4",
                      selected.includes(member.userId)
                        ? "opacity-100"
                        : "opacity-0",
                    )}
                  />
                  <div className="flex-1 min-w-0">
                    <span className="text-sm truncate">{member.email}</span>
                  </div>
                  <Badge variant="outline" className="text-xs ml-2">
                    {member.roles[0]}
                  </Badge>
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
        {selected.length > 0 && (
          <div className="border-t p-2">
            <Button
              size="sm"
              className="w-full"
              onClick={handleAssign}
              disabled={assignMutation.isPending}
            >
              {assignMutation.isPending
                ? "Assigning..."
                : `Assign ${selected.length} reviewer${selected.length > 1 ? "s" : ""}`}
            </Button>
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}
