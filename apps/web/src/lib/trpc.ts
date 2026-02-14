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
 * Storage keys for org data
 */
export const STORAGE_KEYS = {
  CURRENT_ORG_ID: "currentOrgId",
} as const;

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
 * Get access token from OIDC UserManager.
 * Uses dynamic import to avoid SSR issues with oidc-client-ts.
 */
export async function getAccessToken(): Promise<string | null> {
  if (typeof window === "undefined") return null;
  const { getUserManager } = await import("@/lib/oidc");
  const userManager = getUserManager();
  if (!userManager) return null;
  const user = await userManager.getUser();
  return user && !user.expired ? user.access_token : null;
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
        async headers() {
          const token = await getAccessToken();
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
