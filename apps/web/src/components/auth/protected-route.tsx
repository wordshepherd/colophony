'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/use-auth';
import { useOrganization } from '@/hooks/use-organization';
import { Skeleton } from '@/components/ui/skeleton';

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
  const { user, isLoading, isAuthenticated, isEmailVerified } = useAuth();
  const { currentOrg, isEditor, isAdmin, hasOrganizations } = useOrganization();

  useEffect(() => {
    if (isLoading) return;

    // Not authenticated - redirect to login
    if (!isAuthenticated) {
      router.push('/login');
      return;
    }

    // Email verification required
    if (requireEmailVerified && !isEmailVerified) {
      router.push('/verify-email?required=true');
      return;
    }

    // Organization required but user has none
    if (requireOrganization && !hasOrganizations) {
      // TODO: Redirect to org creation or onboarding
      router.push('/dashboard?no-org=true');
      return;
    }

    // Editor role required
    if (requireEditor && !isEditor) {
      router.push('/dashboard?unauthorized=true');
      return;
    }

    // Admin role required
    if (requireAdmin && !isAdmin) {
      router.push('/dashboard?unauthorized=true');
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
