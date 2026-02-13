import { createTRPCReact } from "@trpc/react-query";
import { httpBatchLink } from "@trpc/client";
import type { AppRouter } from "@colophony/api/trpc/router";

/**
 * tRPC React client
 * This provides type-safe hooks for calling API procedures.
 */
export const trpc = createTRPCReact<AppRouter>();

/**
 * Get the API base URL
 */
function getBaseUrl() {
  if (typeof window !== "undefined") {
    return process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";
  }
  return process.env.API_URL || "http://localhost:4000";
}

/**
 * Storage keys for auth/org data
 */
export const STORAGE_KEYS = {
  ACCESS_TOKEN: "accessToken",
  REFRESH_TOKEN: "refreshToken",
  CURRENT_ORG_ID: "currentOrgId",
  TOKEN_EXPIRES_AT: "tokenExpiresAt",
} as const;

/**
 * Get stored auth token
 */
export function getAccessToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(STORAGE_KEYS.ACCESS_TOKEN);
}

/**
 * Get current organization ID
 */
export function getCurrentOrgId(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(STORAGE_KEYS.CURRENT_ORG_ID);
}

/**
 * Set current organization ID
 */
export function setCurrentOrgId(orgId: string | null): void {
  if (typeof window === "undefined") return;
  if (orgId) {
    localStorage.setItem(STORAGE_KEYS.CURRENT_ORG_ID, orgId);
  } else {
    localStorage.removeItem(STORAGE_KEYS.CURRENT_ORG_ID);
  }
}

/**
 * tRPC client configuration
 */
export function getTrpcClient() {
  return trpc.createClient({
    links: [
      httpBatchLink({
        url: `${getBaseUrl()}/trpc`,
        fetch(url, options) {
          return fetch(url, {
            ...options,
            credentials: "include",
          });
        },
        headers() {
          const token = getAccessToken();
          const orgId = getCurrentOrgId();

          const headers: Record<string, string> = {};

          if (token) {
            headers["Authorization"] = `Bearer ${token}`;
          }

          if (orgId) {
            headers["x-organization-id"] = orgId;
          }

          return headers;
        },
      }),
    ],
  });
}
