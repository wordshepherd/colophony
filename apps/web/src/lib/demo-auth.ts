import type { DemoLoginResponse } from "@colophony/types";
import { setCurrentOrgId } from "./trpc";

const DEMO_KEYS = {
  USER_ID: "colophony_demo_user_id",
  ROLE: "colophony_demo_role",
  DISPLAY_NAME: "colophony_demo_display_name",
  ORG_SLUG: "colophony_demo_org_slug",
} as const;

/**
 * Check if the current session is a demo session.
 */
export function isDemoMode(): boolean {
  if (typeof window === "undefined") return false;
  return !!localStorage.getItem(DEMO_KEYS.USER_ID);
}

/**
 * Get the current demo role, or null if not in demo mode.
 */
export function getDemoRole(): "writer" | "editor" | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(DEMO_KEYS.ROLE) as "writer" | "editor" | null;
}

/**
 * Get the demo user's display name.
 */
export function getDemoDisplayName(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(DEMO_KEYS.DISPLAY_NAME);
}

/**
 * Get the demo user ID (sent as X-Demo-User-Id header).
 */
export function getDemoUserId(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(DEMO_KEYS.USER_ID);
}

/**
 * Log in as a demo user. Calls the demo login API, stores state in
 * localStorage, and returns the redirect path.
 */
export async function loginAsDemo(role: "writer" | "editor"): Promise<string> {
  const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";

  const res = await fetch(`${apiUrl}/v1/public/demo/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ role }),
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(
      (body as { message?: string }).message || "Demo login failed",
    );
  }

  const data = (await res.json()) as DemoLoginResponse;

  // Store demo state
  localStorage.setItem(DEMO_KEYS.USER_ID, data.userId);
  localStorage.setItem(DEMO_KEYS.ROLE, data.role);
  localStorage.setItem(DEMO_KEYS.DISPLAY_NAME, data.displayName);
  localStorage.setItem(DEMO_KEYS.ORG_SLUG, data.orgSlug);

  // Set org context using the existing mechanism
  setCurrentOrgId(data.orgId);

  return role === "writer" ? "/workspace" : "/editor";
}

/**
 * Clear all demo state and return to the demo page.
 */
export function clearDemo(): void {
  if (typeof window === "undefined") return;
  for (const key of Object.values(DEMO_KEYS)) {
    localStorage.removeItem(key);
  }
  setCurrentOrgId(null);
}
