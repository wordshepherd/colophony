"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/hooks/use-auth";
import { useOrganization } from "@/hooks/use-organization";
import { Skeleton } from "@/components/ui/skeleton";

interface ProtectedRouteProps {
  children: React.ReactNode;
  requireEmailVerified?: boolean;
  requireEditor?: boolean;
  requireAdmin?: boolean;
  requireOrganization?: boolean;
}

export function ProtectedRoute({
  children,
  requireEmailVerified = false,
  requireEditor = false,
  requireAdmin = false,
  requireOrganization = true,
}: ProtectedRouteProps) {
  const router = useRouter();
  const { user, isLoading, isAuthenticated, isEmailVerified, error, login } =
    useAuth();
  const { currentOrg, isEditor, isAdmin, hasOrganizations } = useOrganization();

  useEffect(() => {
    if (isLoading) return;

    // Not authenticated - redirect to Zitadel login (demo users are already authenticated)
    if (!isAuthenticated) {
      login();
      return;
    }

    // Organization required but user has none
    if (requireOrganization && !hasOrganizations) {
      router.push("/organizations/new");
      return;
    }

    // Editor role required
    if (requireEditor && !isEditor) {
      router.push("/dashboard?unauthorized=true");
      return;
    }

    // Admin role required
    if (requireAdmin && !isAdmin) {
      router.push("/dashboard?unauthorized=true");
      return;
    }
  }, [
    isLoading,
    isAuthenticated,
    isEmailVerified,
    hasOrganizations,
    isEditor,
    isAdmin,
    requireEmailVerified,
    requireEditor,
    requireAdmin,
    requireOrganization,
    router,
    login,
  ]);

  // Show loading skeleton while checking auth
  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="space-y-4 w-full max-w-md p-4">
          <Skeleton className="h-12 w-full" />
          <Skeleton className="h-8 w-3/4" />
          <Skeleton className="h-32 w-full" />
        </div>
      </div>
    );
  }

  // Don't render children if not authenticated
  if (!isAuthenticated) {
    return null;
  }

  // Authenticated via OIDC but local profile not loaded yet
  // (e.g., first login before Zitadel webhook provisions the user).
  // The query polls every 3s via refetchInterval until profile arrives.
  // If the query errored out after retries, show an error with retry option.
  if (!user) {
    if (error) {
      return (
        <div className="flex min-h-screen items-center justify-center">
          <div className="text-center space-y-4 max-w-md">
            <h1 className="text-xl font-semibold">
              Unable to load your profile
            </h1>
            <p className="text-muted-foreground">
              {error.message || "Something went wrong. Please try again."}
            </p>
            <button
              onClick={() => window.location.reload()}
              className="text-primary hover:underline"
            >
              Retry
            </button>
          </div>
        </div>
      );
    }

    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="text-center space-y-2">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent mx-auto" />
          <p className="text-muted-foreground">Setting up your account...</p>
        </div>
      </div>
    );
  }

  // Don't render if email verification required but not verified
  if (requireEmailVerified && !isEmailVerified) {
    return null;
  }

  // Don't render if organization required but none selected
  if (requireOrganization && !currentOrg) {
    return null;
  }

  // Don't render if editor required but not editor
  if (requireEditor && !isEditor) {
    return null;
  }

  // Don't render if admin required but not admin
  if (requireAdmin && !isAdmin) {
    return null;
  }

  return <>{children}</>;
}
