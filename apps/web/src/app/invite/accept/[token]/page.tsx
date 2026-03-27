"use client";

import { use, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/hooks/use-auth";
import { trpc } from "@/lib/trpc";
import { setCurrentOrgId } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Loader2, CheckCircle2, XCircle } from "lucide-react";

export default function AcceptInvitationPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = use(params);
  const router = useRouter();
  const { isAuthenticated, isLoading: authLoading, login } = useAuth();
  const [attempted, setAttempted] = useState(false);

  const acceptMutation = trpc.organizations.invitations.accept.useMutation({
    onSuccess: (result) => {
      setCurrentOrgId(result.organizationId);
      // Brief delay so the user sees the success state
      setTimeout(() => router.replace("/"), 1500);
    },
  });

  useEffect(() => {
    if (authLoading) return;

    if (!isAuthenticated) {
      login();
      return;
    }

    if (!attempted) {
      setAttempted(true);
      acceptMutation.mutate({ token });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authLoading, isAuthenticated, attempted, token]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-muted/30 p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <CardTitle>Organization Invitation</CardTitle>
          <CardDescription>
            {acceptMutation.isIdle || acceptMutation.isPending
              ? "Processing your invitation..."
              : acceptMutation.isSuccess
                ? "You're in!"
                : "Something went wrong"}
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col items-center gap-4">
          {(acceptMutation.isIdle ||
            acceptMutation.isPending ||
            authLoading) && (
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          )}

          {acceptMutation.isSuccess && (
            <>
              <CheckCircle2 className="h-8 w-8 text-green-600" />
              <p className="text-sm text-muted-foreground">
                Redirecting to your new organization...
              </p>
            </>
          )}

          {acceptMutation.isError && (
            <>
              <XCircle className="h-8 w-8 text-destructive" />
              <p className="text-sm text-destructive">
                {acceptMutation.error.data?.code === "FORBIDDEN"
                  ? "Your email address does not match this invitation."
                  : acceptMutation.error.data?.code === "CONFLICT"
                    ? "This invitation has already been accepted."
                    : acceptMutation.error.data?.code === "NOT_FOUND"
                      ? "This invitation is invalid or has expired."
                      : acceptMutation.error.message}
              </p>
              <Button variant="outline" onClick={() => router.replace("/")}>
                Go to Dashboard
              </Button>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
