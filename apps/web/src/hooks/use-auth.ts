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
    id: string;
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
      // eslint-disable-next-line react-hooks/set-state-in-effect -- sync guard, fires once before any async work
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
    isPending: profilePending,
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
    refetchInterval: (query) => (!query.state.data ? 3000 : false),
  });

  // Stale OIDC token recovery — if users.me fails with auth error after
  // retries, the token is invalid (e.g., Zitadel signing keys changed).
  // Clear OIDC state and force re-authentication.
  useEffect(() => {
    if (!profileError || !hasOidcToken) return;

    const isAuthError =
      profileError.data?.code === "UNAUTHORIZED" ||
      profileError.message.includes("401") ||
      profileError.message.includes("token_invalid");

    if (!isAuthError) return;

    console.warn("Stale OIDC token detected, forcing re-authentication");
    const userManager = getUserManager();
    if (userManager) {
      void userManager.removeUser().then(() => {
        void userManager.signinRedirect();
      });
    }
  }, [profileError, hasOidcToken]);

  // Build the user profile with name from OIDC claims
  const user: UserProfile | null = userProfile
    ? {
        ...userProfile,
        name: oidcUser?.profile?.name ?? null,
        createdAt: new Date(userProfile.createdAt),
      }
    : null;

  const isLoading = oidcLoading || (hasOidcToken && profilePending);

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
