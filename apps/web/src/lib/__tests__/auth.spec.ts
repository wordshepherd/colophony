import { STORAGE_KEYS } from "../trpc";
import {
  setAuthTokens,
  getRefreshToken,
  getTokenExpiresAt,
  isTokenExpiringSoon,
  clearAuthData,
  hasAuthTokens,
} from "../auth";

describe("auth utilities", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  describe("setAuthTokens", () => {
    it("should store access token, refresh token, and expiry", () => {
      setAuthTokens("access-123", "refresh-456", 900);

      expect(localStorage.getItem(STORAGE_KEYS.ACCESS_TOKEN)).toBe(
        "access-123",
      );
      expect(localStorage.getItem(STORAGE_KEYS.REFRESH_TOKEN)).toBe(
        "refresh-456",
      );
      expect(localStorage.getItem(STORAGE_KEYS.TOKEN_EXPIRES_AT)).toBeTruthy();
    });

    it("should calculate expiry timestamp from expiresIn seconds", () => {
      const before = Date.now();
      setAuthTokens("access", "refresh", 900);
      const after = Date.now();

      const stored = parseInt(
        localStorage.getItem(STORAGE_KEYS.TOKEN_EXPIRES_AT)!,
        10,
      );
      expect(stored).toBeGreaterThanOrEqual(before + 900 * 1000);
      expect(stored).toBeLessThanOrEqual(after + 900 * 1000);
    });
  });

  describe("getRefreshToken", () => {
    it("should return refresh token when stored", () => {
      localStorage.setItem(STORAGE_KEYS.REFRESH_TOKEN, "my-refresh");
      expect(getRefreshToken()).toBe("my-refresh");
    });

    it("should return null when no token stored", () => {
      expect(getRefreshToken()).toBeNull();
    });
  });

  describe("getTokenExpiresAt", () => {
    it("should return parsed timestamp", () => {
      localStorage.setItem(STORAGE_KEYS.TOKEN_EXPIRES_AT, "1700000000000");
      expect(getTokenExpiresAt()).toBe(1700000000000);
    });

    it("should return null when no expiry stored", () => {
      expect(getTokenExpiresAt()).toBeNull();
    });
  });

  describe("isTokenExpiringSoon", () => {
    it("should return true when no expiry is stored", () => {
      expect(isTokenExpiringSoon()).toBe(true);
    });

    it("should return true when token expires within 60 seconds", () => {
      const expiresAt = Date.now() + 30 * 1000; // 30 seconds from now
      localStorage.setItem(STORAGE_KEYS.TOKEN_EXPIRES_AT, expiresAt.toString());
      expect(isTokenExpiringSoon()).toBe(true);
    });

    it("should return true when token is already expired", () => {
      const expiresAt = Date.now() - 1000; // 1 second ago
      localStorage.setItem(STORAGE_KEYS.TOKEN_EXPIRES_AT, expiresAt.toString());
      expect(isTokenExpiringSoon()).toBe(true);
    });

    it("should return false when token has more than 60 seconds", () => {
      const expiresAt = Date.now() + 120 * 1000; // 2 minutes from now
      localStorage.setItem(STORAGE_KEYS.TOKEN_EXPIRES_AT, expiresAt.toString());
      expect(isTokenExpiringSoon()).toBe(false);
    });
  });

  describe("clearAuthData", () => {
    it("should remove all auth-related keys from localStorage", () => {
      localStorage.setItem(STORAGE_KEYS.ACCESS_TOKEN, "token");
      localStorage.setItem(STORAGE_KEYS.REFRESH_TOKEN, "refresh");
      localStorage.setItem(STORAGE_KEYS.TOKEN_EXPIRES_AT, "12345");
      localStorage.setItem(STORAGE_KEYS.CURRENT_ORG_ID, "org-1");

      clearAuthData();

      expect(localStorage.getItem(STORAGE_KEYS.ACCESS_TOKEN)).toBeNull();
      expect(localStorage.getItem(STORAGE_KEYS.REFRESH_TOKEN)).toBeNull();
      expect(localStorage.getItem(STORAGE_KEYS.TOKEN_EXPIRES_AT)).toBeNull();
      expect(localStorage.getItem(STORAGE_KEYS.CURRENT_ORG_ID)).toBeNull();
    });

    it("should not throw when keys are already absent", () => {
      expect(() => clearAuthData()).not.toThrow();
    });
  });

  describe("hasAuthTokens", () => {
    it("should return true when access token exists", () => {
      localStorage.setItem(STORAGE_KEYS.ACCESS_TOKEN, "some-token");
      expect(hasAuthTokens()).toBe(true);
    });

    it("should return false when no access token", () => {
      expect(hasAuthTokens()).toBe(false);
    });

    it("should return false when access token is empty string", () => {
      localStorage.setItem(STORAGE_KEYS.ACCESS_TOKEN, "");
      expect(hasAuthTokens()).toBe(false);
    });
  });
});
