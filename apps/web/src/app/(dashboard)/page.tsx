"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/hooks/use-auth";
import { useOrganization } from "@/hooks/use-organization";
import { Skeleton } from "@/components/ui/skeleton";

export default function DashboardPage() {
  const router = useRouter();
  const { isAuthenticated, isLoading } = useAuth();
  const { hasOrganizations } = useOrganization();

  useEffect(() => {
    if (isLoading) return;

    if (!isAuthenticated) {
      router.push("/login");
      return;
    }

    // Redirect to submissions if user has orgs
    if (hasOrganizations) {
      router.push("/submissions");
    }
  }, [isLoading, isAuthenticated, hasOrganizations, router]);

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-32 w-full" />
      </div>
    );
  }

  // Show welcome message if user has no organizations
  if (!hasOrganizations) {
    return (
      <div className="text-center py-12">
        <h1 className="text-2xl font-bold mb-2">Welcome to Colophony</h1>
        <p className="text-muted-foreground mb-4">
          You&apos;re not a member of any organizations yet.
        </p>
        <p className="text-sm text-muted-foreground">
          Contact an organization administrator to get invited, or wait for an
          invitation link.
        </p>
      </div>
    );
  }

  return null;
}
