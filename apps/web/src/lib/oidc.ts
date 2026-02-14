import { UserManager, WebStorageStateStore } from "oidc-client-ts";

let _userManager: UserManager | null = null;

/**
 * Get the OIDC UserManager singleton.
 * Guarded for SSR — returns null on the server.
 */
export function getUserManager(): UserManager | null {
  if (typeof window === "undefined") return null;

  if (!_userManager) {
    const authority = process.env.NEXT_PUBLIC_ZITADEL_AUTHORITY;
    const clientId = process.env.NEXT_PUBLIC_ZITADEL_CLIENT_ID;

    if (!authority || !clientId) {
      console.warn(
        "OIDC not configured: NEXT_PUBLIC_ZITADEL_AUTHORITY and NEXT_PUBLIC_ZITADEL_CLIENT_ID are required",
      );
      return null;
    }

    _userManager = new UserManager({
      authority,
      client_id: clientId,
      redirect_uri: `${window.location.origin}/auth/callback`,
      post_logout_redirect_uri: window.location.origin,
      response_type: "code",
      scope: "openid profile email offline_access",
      automaticSilentRenew: true,
      userStore: new WebStorageStateStore({ store: localStorage }),
    });
  }

  return _userManager;
}
