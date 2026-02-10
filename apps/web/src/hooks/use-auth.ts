"use client";

import { useCallback, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { trpc } from "@/lib/trpc";
import {
  setAuthTokens,
  getRefreshToken,
  clearAuthData,
  isTokenExpiringSoon,
  hasAuthTokens,
} from "@/lib/auth";
import type { LoginInput, RegisterInput } from "@prospector/types";

export interface UserProfile {
  id: string;
  email: string;
  name: string | null;
  emailVerified: boolean;
  createdAt: Date;
  organizations: Array<{
    organization: {
      id: string;
      name: string;
      slug: string;
    };
    role: "ADMIN" | "EDITOR" | "READER";
  }>;
}

export function useAuth() {
  const router = useRouter();
  const refreshTimerRef = useRef<NodeJS.Timeout | null>(null);
  const utils = trpc.useUtils();

  // Query for current user
  const {
    data: user,
    isLoading: queryIsLoading,
    fetchStatus,
    error,
    refetch,
  } = trpc.auth.me.useQuery(undefined, {
    enabled: hasAuthTokens(),
    retry: false,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });

  // In TanStack Query v4, isLoading is true even when enabled=false
  // (status='loading', fetchStatus='idle'). We only want true loading
  // when a fetch is actually in progress.
  const isLoading = queryIsLoading && fetchStatus !== "idle";

  // Login mutation
  const loginMutation = trpc.auth.login.useMutation({
    onSuccess: (data) => {
      setAuthTokens(data.accessToken, data.refreshToken, data.expiresIn);
      scheduleTokenRefresh(data.expiresIn);
      refetch();
    },
  });

  // Register mutation
  const registerMutation = trpc.auth.register.useMutation({
    onSuccess: (data) => {
      setAuthTokens(data.accessToken, data.refreshToken, data.expiresIn);
      scheduleTokenRefresh(data.expiresIn);
      refetch();
    },
  });

  // Logout mutation
  const logoutMutation = trpc.auth.logout.useMutation({
    onSuccess: () => {
      clearAuthData();
      utils.auth.me.reset();
      if (refreshTimerRef.current) {
        clearTimeout(refreshTimerRef.current);
      }
      router.push("/login");
    },
    onError: () => {
      // Even on error, clear local state
      clearAuthData();
      utils.auth.me.reset();
      router.push("/login");
    },
  });

  // Refresh token mutation
  const refreshMutation = trpc.auth.refresh.useMutation({
    onSuccess: (data) => {
      setAuthTokens(data.accessToken, data.refreshToken, data.expiresIn);
      scheduleTokenRefresh(data.expiresIn);
    },
    onError: () => {
      // Refresh failed, user needs to login again
      clearAuthData();
      utils.auth.me.reset();
      router.push("/login");
    },
  });

  // Schedule token refresh
  const scheduleTokenRefresh = useCallback(
    (expiresIn: number) => {
      if (refreshTimerRef.current) {
        clearTimeout(refreshTimerRef.current);
      }

      // Refresh 1 minute before expiry
      const refreshIn = (expiresIn - 60) * 1000;
      if (refreshIn > 0) {
        refreshTimerRef.current = setTimeout(() => {
          const token = getRefreshToken();
          if (token) {
            refreshMutation.mutate({ refreshToken: token });
          }
        }, refreshIn);
      }
    },
    [refreshMutation],
  );

  // Login function
  const login = useCallback(
    async (input: LoginInput) => {
      await loginMutation.mutateAsync(input);
    },
    [loginMutation],
  );

  // Register function
  const register = useCallback(
    async (input: RegisterInput) => {
      await registerMutation.mutateAsync(input);
    },
    [registerMutation],
  );

  // Logout function
  const logout = useCallback(async () => {
    const token = getRefreshToken();
    if (token) {
      await logoutMutation.mutateAsync({ refreshToken: token });
    } else {
      clearAuthData();
      utils.auth.me.reset();
      router.push("/login");
    }
  }, [logoutMutation, utils.auth.me, router]);

  // Check and refresh token on mount if needed
  useEffect(() => {
    if (hasAuthTokens() && isTokenExpiringSoon()) {
      const token = getRefreshToken();
      if (token) {
        refreshMutation.mutate({ refreshToken: token });
      }
    }
  }, [refreshMutation]);

  // Cleanup timer on unmount
  useEffect(() => {
    return () => {
      if (refreshTimerRef.current) {
        clearTimeout(refreshTimerRef.current);
      }
    };
  }, []);

  return {
    user: user as UserProfile | null | undefined,
    isLoading,
    isAuthenticated: !!user,
    isEmailVerified: user?.emailVerified ?? false,
    error,
    login,
    register,
    logout,
    isLoginLoading: loginMutation.isPending,
    isRegisterLoading: registerMutation.isPending,
    isLogoutLoading: logoutMutation.isPending,
    loginError: loginMutation.error,
    registerError: registerMutation.error,
  };
}
