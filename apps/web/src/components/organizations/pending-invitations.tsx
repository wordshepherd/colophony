"use client";

import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Loader2, RotateCw, X } from "lucide-react";
import { ROLE_DISPLAY_DEFAULTS, type Role } from "@colophony/types";
import { formatDistanceToNow } from "date-fns";

export function PendingInvitations() {
  const utils = trpc.useUtils();

  const { data: invitations, isLoading } =
    trpc.organizations.invitations.list.useQuery();

  const revokeMutation = trpc.organizations.invitations.revoke.useMutation({
    onSuccess: () => {
      utils.organizations.invitations.list.invalidate();
      toast.success("Invitation revoked");
    },
    onError: (err) => {
      toast.error(err.message);
    },
  });

  const resendMutation = trpc.organizations.invitations.resend.useMutation({
    onSuccess: () => {
      utils.organizations.invitations.list.invalidate();
      toast.success("Invitation resent");
    },
    onError: (err) => {
      toast.error(err.message);
    },
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-4">
        <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!invitations?.length) {
    return null;
  }

  return (
    <div className="space-y-3">
      <h3 className="text-sm font-medium text-muted-foreground">
        Pending Invitations
      </h3>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Email</TableHead>
            <TableHead>Roles</TableHead>
            <TableHead>Sent</TableHead>
            <TableHead>Expires</TableHead>
            <TableHead className="text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {invitations.map((invitation) => (
            <TableRow key={invitation.id}>
              <TableCell className="font-medium">{invitation.email}</TableCell>
              <TableCell>
                <div className="flex flex-wrap gap-1">
                  {invitation.roles.map((role) => (
                    <Badge key={role} variant="secondary" className="text-xs">
                      {ROLE_DISPLAY_DEFAULTS[role as Role] ?? role}
                    </Badge>
                  ))}
                </div>
              </TableCell>
              <TableCell className="text-muted-foreground">
                {formatDistanceToNow(new Date(invitation.createdAt), {
                  addSuffix: true,
                })}
              </TableCell>
              <TableCell className="text-muted-foreground">
                {formatDistanceToNow(new Date(invitation.expiresAt), {
                  addSuffix: true,
                })}
              </TableCell>
              <TableCell className="text-right">
                <div className="flex justify-end gap-1">
                  <Button
                    variant="ghost"
                    size="sm"
                    disabled={resendMutation.isPending}
                    onClick={() =>
                      resendMutation.mutate({
                        invitationId: invitation.id,
                      })
                    }
                    aria-label="Resend invitation"
                    title="Resend invitation"
                  >
                    <RotateCw className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    disabled={revokeMutation.isPending}
                    onClick={() =>
                      revokeMutation.mutate({
                        invitationId: invitation.id,
                      })
                    }
                    aria-label="Revoke invitation"
                    title="Revoke invitation"
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
