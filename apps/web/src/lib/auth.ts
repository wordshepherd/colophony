import { STORAGE_KEYS } from "./trpc";

/**
 * Store authentication tokens and expiry
 */
export function setAuthTokens(
  accessToken: string,
  refreshToken: string,
  expiresIn: number,
): void {
  if (typeof window === "undefined") return;

  localStorage.setItem(STORAGE_KEYS.ACCESS_TOKEN, accessToken);
  localStorage.setItem(STORAGE_KEYS.REFRESH_TOKEN, refreshToken);

  // Calculate and store expiry timestamp
  const expiresAt = Date.now() + expiresIn * 1000;
  localStorage.setItem(STORAGE_KEYS.TOKEN_EXPIRES_AT, expiresAt.toString());
}

/**
 * Get refresh token
 */
export function getRefreshToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(STORAGE_KEYS.REFRESH_TOKEN);
}

/**
 * Get token expiry timestamp
 */
export function getTokenExpiresAt(): number | null {
  if (typeof window === "undefined") return null;
  const expiresAt = localStorage.getItem(STORAGE_KEYS.TOKEN_EXPIRES_AT);
  return expiresAt ? parseInt(expiresAt, 10) : null;
}

/**
 * Check if token is expired or will expire soon (within 1 minute)
 */
export function isTokenExpiringSoon(): boolean {
  const expiresAt = getTokenExpiresAt();
  if (!expiresAt) return true;

  // Consider expired if within 1 minute of expiry
  const buffer = 60 * 1000;
  return Date.now() >= expiresAt - buffer;
}

/**
 * Clear all auth data from storage
 */
export function clearAuthData(): void {
  if (typeof window === "undefined") return;

  localStorage.removeItem(STORAGE_KEYS.ACCESS_TOKEN);
  localStorage.removeItem(STORAGE_KEYS.REFRESH_TOKEN);
  localStorage.removeItem(STORAGE_KEYS.TOKEN_EXPIRES_AT);
  localStorage.removeItem(STORAGE_KEYS.CURRENT_ORG_ID);
}

/**
 * Check if user is authenticated (has tokens)
 */
export function hasAuthTokens(): boolean {
  if (typeof window === "undefined") return false;
  return !!localStorage.getItem(STORAGE_KEYS.ACCESS_TOKEN);
}
