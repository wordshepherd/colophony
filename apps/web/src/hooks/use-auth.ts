"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { User } from "oidc-client-ts";
import { getUserManager } from "@/lib/oidc";
import { trpc, setCurrentOrgId } from "@/lib/trpc";

export interface UserProfile {
  id: string;
  email: string;
  name: string | null;
  emailVerified: boolean;
  createdAt: Date;
  organizations: Array<{
    organizationId: string;
    name: string;
    slug: string;
    role: "ADMIN" | "EDITOR" | "READER";
  }>;
}

export function useAuth() {
  const [oidcUser, setOidcUser] = useState<User | null>(null);
  const [oidcLoading, setOidcLoading] = useState(true);
  const initializedRef = useRef(false);

  // Check for existing OIDC session on mount
  useEffect(() => {
    if (initializedRef.current) return;
    initializedRef.current = true;

    const userManager = getUserManager();
    if (!userManager) {
      setOidcLoading(false);
      return;
    }

    // Load existing user from storage
    userManager
      .getUser()
      .then((user) => {
        setOidcUser(user && !user.expired ? user : null);
      })
      .catch(() => {
        setOidcUser(null);
      })
      .finally(() => {
        setOidcLoading(false);
      });

    // Listen for OIDC events
    const onUserLoaded = (user: User) => setOidcUser(user);
    const onUserUnloaded = () => setOidcUser(null);
    const onSilentRenewError = () => {
      // Silent renew failed — user will need to re-authenticate
      setOidcUser(null);
    };

    userManager.events.addUserLoaded(onUserLoaded);
    userManager.events.addUserUnloaded(onUserUnloaded);
    userManager.events.addSilentRenewError(onSilentRenewError);

    return () => {
      userManager.events.removeUserLoaded(onUserLoaded);
      userManager.events.removeUserUnloaded(onUserUnloaded);
      userManager.events.removeSilentRenewError(onSilentRenewError);
    };
  }, []);

  const hasOidcToken = !!oidcUser && !oidcUser.expired;

  // Fetch local user profile when OIDC user is available
  const {
    data: userProfile,
    isLoading: profileLoading,
    fetchStatus,
    error: profileError,
  } = trpc.users.me.useQuery(undefined, {
    enabled: hasOidcToken,
    retry: (failureCount) => {
      // Retry a few times (user may not be provisioned yet via webhook)
      return failureCount < 3;
    },
    retryDelay: 2000,
    staleTime: 5 * 60 * 1000, // 5 minutes
    // Poll every 3s while profile is null (user not provisioned yet).
    // Stops polling once profile data arrives.
    refetchInterval: (data) => (!data ? 3000 : false),
  });

  // Build the user profile with name from OIDC claims
  const user: UserProfile | null = userProfile
    ? {
        ...userProfile,
        name: oidcUser?.profile?.name ?? null,
        createdAt: new Date(userProfile.createdAt),
      }
    : null;

  // In TanStack Query v4, isLoading is true even when enabled=false
  // (status='loading', fetchStatus='idle'). We only want true loading
  // when a fetch is actually in progress.
  const isQueryLoading = profileLoading && fetchStatus !== "idle";
  const isLoading = oidcLoading || (hasOidcToken && isQueryLoading);

  // Authenticated = valid OIDC token exists. This prevents ProtectedRoute
  // from triggering a redirect loop when the user profile hasn't loaded yet
  // (e.g., first login before Zitadel webhook provisions the user).
  const isAuthenticated = hasOidcToken;

  const login = useCallback(() => {
    const userManager = getUserManager();
    if (userManager) {
      // Save current path so the callback page can restore it
      if (typeof window !== "undefined") {
        const returnTo = window.location.pathname + window.location.search;
        if (returnTo !== "/") {
          sessionStorage.setItem("auth_return_to", returnTo);
        }
      }
      void userManager.signinRedirect();
    }
  }, []);

  const logout = useCallback(() => {
    const userManager = getUserManager();
    if (userManager) {
      // Clear persisted org selection so it doesn't leak to the next session
      setCurrentOrgId(null);
      void userManager.signoutRedirect();
    }
  }, []);

  return {
    user,
    isLoading,
    isAuthenticated,
    isEmailVerified: user?.emailVerified ?? false,
    error: profileError,
    login,
    logout,
  };
}
