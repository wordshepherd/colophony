"use client";

import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { useOrganization } from "@/hooks/use-organization";
import { InviteMemberDialog } from "./invite-member-dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import { format } from "date-fns";
import { UserPlus, Trash2 } from "lucide-react";
import type { Role } from "@colophony/types";

const roleColors: Record<string, string> = {
  ADMIN: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200",
  EDITOR: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200",
  READER: "bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200",
};

export function MemberList() {
  const { isAdmin } = useOrganization();
  const utils = trpc.useUtils();
  const [page, setPage] = useState(1);
  const limit = 20;
  const [showInvite, setShowInvite] = useState(false);
  const [removingMember, setRemovingMember] = useState<{
    id: string;
    email: string;
  } | null>(null);

  const { data, isLoading, error } = trpc.organizations.members.list.useQuery({
    page,
    limit,
  });

  const updateRoleMutation = trpc.organizations.members.updateRole.useMutation({
    onSuccess: () => {
      utils.organizations.members.list.invalidate();
      utils.users.me.invalidate();
      toast.success("Role updated");
    },
    onError: (err) => {
      toast.error(err.message);
    },
  });

  const removeMutation = trpc.organizations.members.remove.useMutation({
    onSuccess: () => {
      utils.organizations.members.list.invalidate();
      utils.users.me.invalidate();
      toast.success("Member removed");
      setRemovingMember(null);
    },
    onError: (err) => {
      toast.error(err.message);
      setRemovingMember(null);
    },
  });

  if (error) {
    return (
      <p className="text-destructive">
        Failed to load members: {error.message}
      </p>
    );
  }

  if (isLoading) {
    return (
      <div className="space-y-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <Skeleton key={i} className="h-12 w-full" />
        ))}
      </div>
    );
  }

  const members = data?.items ?? [];
  const totalPages = data?.totalPages ?? 1;

  return (
    <div className="space-y-4">
      {isAdmin && (
        <div className="flex justify-end">
          <Button onClick={() => setShowInvite(true)}>
            <UserPlus className="mr-2 h-4 w-4" />
            Invite Member
          </Button>
        </div>
      )}

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Email</TableHead>
            <TableHead>Role</TableHead>
            <TableHead>Joined</TableHead>
            {isAdmin && <TableHead className="w-[100px]">Actions</TableHead>}
          </TableRow>
        </TableHeader>
        <TableBody>
          {members.length === 0 ? (
            <TableRow>
              <TableCell
                colSpan={isAdmin ? 4 : 3}
                className="text-center text-muted-foreground"
              >
                No members found.
              </TableCell>
            </TableRow>
          ) : (
            members.map((member) => (
              <TableRow key={member.id}>
                <TableCell>{member.email}</TableCell>
                <TableCell>
                  {isAdmin ? (
                    <Select
                      value={member.role}
                      onValueChange={(role: Role) =>
                        updateRoleMutation.mutate({
                          memberId: member.id,
                          role,
                        })
                      }
                    >
                      <SelectTrigger className="w-[120px]">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="READER">Reader</SelectItem>
                        <SelectItem value="EDITOR">Editor</SelectItem>
                        <SelectItem value="ADMIN">Admin</SelectItem>
                      </SelectContent>
                    </Select>
                  ) : (
                    <Badge
                      variant="secondary"
                      className={roleColors[member.role]}
                    >
                      {member.role.toLowerCase()}
                    </Badge>
                  )}
                </TableCell>
                <TableCell>
                  {format(new Date(member.createdAt), "PPP")}
                </TableCell>
                {isAdmin && (
                  <TableCell>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() =>
                        setRemovingMember({
                          id: member.id,
                          email: member.email,
                        })
                      }
                    >
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </TableCell>
                )}
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>

      {totalPages > 1 && (
        <div className="flex justify-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page === 1}
          >
            Previous
          </Button>
          <span className="flex items-center text-sm text-muted-foreground">
            Page {page} of {totalPages}
          </span>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            disabled={page === totalPages}
          >
            Next
          </Button>
        </div>
      )}

      <InviteMemberDialog open={showInvite} onOpenChange={setShowInvite} />

      {/* Remove confirmation dialog */}
      <Dialog
        open={!!removingMember}
        onOpenChange={(open) => !open && setRemovingMember(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Remove member?</DialogTitle>
            <DialogDescription>
              Are you sure you want to remove {removingMember?.email} from this
              organization? They will lose access immediately.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRemovingMember(null)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              disabled={removeMutation.isPending}
              onClick={() => {
                if (removingMember) {
                  removeMutation.mutate({ memberId: removingMember.id });
                }
              }}
            >
              {removeMutation.isPending ? "Removing..." : "Remove"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
