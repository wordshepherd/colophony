import { vi } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useAuth } from "../use-auth";

// --- Mutable mock state ---
const mockGetUser = vi.fn().mockResolvedValue(null);
const mockSigninRedirect = vi.fn();
const mockSignoutRedirect = vi.fn();
const mockRemoveUser = vi.fn().mockResolvedValue(undefined);
const mockEvents = {
  addUserLoaded: vi.fn(),
  addUserUnloaded: vi.fn(),
  addSilentRenewError: vi.fn(),
  removeUserLoaded: vi.fn(),
  removeUserUnloaded: vi.fn(),
  removeSilentRenewError: vi.fn(),
};

let mockUserManager: object | null = {
  getUser: mockGetUser,
  signinRedirect: mockSigninRedirect,
  signoutRedirect: mockSignoutRedirect,
  removeUser: mockRemoveUser,
  events: mockEvents,
};

vi.mock("@/lib/oidc", () => ({
  getUserManager: () => mockUserManager,
}));

// tRPC mock
let mockProfileData: object | undefined;
let mockProfilePending = false;
let mockProfileError: Error | null = null;
let mockQueryEnabled = false;

const mockSetCurrentOrgId = vi.fn();

vi.mock("@/lib/trpc", () => ({
  trpc: {
    users: {
      me: {
        useQuery: (_input: unknown, opts: { enabled: boolean }) => {
          mockQueryEnabled = opts?.enabled ?? false;
          return {
            data: mockProfileData,
            isPending: mockProfilePending,
            error: mockProfileError,
          };
        },
      },
    },
  },
  setCurrentOrgId: (...args: unknown[]) => mockSetCurrentOrgId(...args),
}));

// Valid OIDC user object
function makeOidcUser(overrides: Record<string, unknown> = {}) {
  return {
    expired: false,
    access_token: "tok-123",
    profile: { name: "Jane Doe" },
    ...overrides,
  };
}

describe("useAuth", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetUser.mockResolvedValue(null);
    mockUserManager = {
      getUser: mockGetUser,
      signinRedirect: mockSigninRedirect,
      signoutRedirect: mockSignoutRedirect,
      removeUser: mockRemoveUser,
      events: mockEvents,
    };
    mockProfileData = undefined;
    mockProfilePending = false;
    mockProfileError = null;
    mockQueryEnabled = false;
  });

  describe("initial loading / SSR", () => {
    it("should set isLoading false when no UserManager (SSR)", async () => {
      mockUserManager = null;
      const { result } = renderHook(() => useAuth());

      // Wait for effect to fire
      await act(async () => {});

      expect(result.current.isLoading).toBe(false);
      expect(result.current.isAuthenticated).toBe(false);
    });
  });

  describe("OIDC session", () => {
    it("should authenticate when getUser resolves with valid user", async () => {
      mockGetUser.mockResolvedValue(makeOidcUser());
      mockProfileData = {
        id: "u1",
        email: "jane@example.com",
        name: null,
        emailVerified: true,
        createdAt: "2024-01-01T00:00:00Z",
        organizations: [],
      };

      const { result } = renderHook(() => useAuth());
      await act(async () => {});

      expect(result.current.isAuthenticated).toBe(true);
    });

    it("should not authenticate when getUser resolves with expired user", async () => {
      mockGetUser.mockResolvedValue(makeOidcUser({ expired: true }));
      const { result } = renderHook(() => useAuth());
      await act(async () => {});

      expect(result.current.isAuthenticated).toBe(false);
    });

    it("should not authenticate when getUser resolves with null", async () => {
      mockGetUser.mockResolvedValue(null);
      const { result } = renderHook(() => useAuth());
      await act(async () => {});

      expect(result.current.isAuthenticated).toBe(false);
    });

    it("should handle getUser rejection gracefully", async () => {
      mockGetUser.mockRejectedValue(new Error("storage error"));
      const { result } = renderHook(() => useAuth());
      await act(async () => {});

      expect(result.current.isAuthenticated).toBe(false);
      expect(result.current.isLoading).toBe(false);
    });
  });

  describe("isLoading compound", () => {
    it("should be true when hasToken and profilePending", async () => {
      mockGetUser.mockResolvedValue(makeOidcUser());
      mockProfilePending = true;
      const { result } = renderHook(() => useAuth());
      await act(async () => {});

      expect(result.current.isLoading).toBe(true);
    });

    it("should be false when no token and not oidcLoading", async () => {
      mockGetUser.mockResolvedValue(null);
      mockProfilePending = false;
      const { result } = renderHook(() => useAuth());
      await act(async () => {});

      expect(result.current.isLoading).toBe(false);
    });
  });

  describe("user profile merging", () => {
    it("should return null user when no profile data", async () => {
      mockGetUser.mockResolvedValue(makeOidcUser());
      mockProfileData = undefined;
      const { result } = renderHook(() => useAuth());
      await act(async () => {});

      expect(result.current.user).toBeNull();
    });

    it("should merge OIDC name into profile", async () => {
      mockGetUser.mockResolvedValue(
        makeOidcUser({ profile: { name: "OIDC Name" } }),
      );
      mockProfileData = {
        id: "u1",
        email: "jane@example.com",
        name: "DB Name",
        emailVerified: true,
        createdAt: "2024-01-01T00:00:00Z",
        organizations: [],
      };
      const { result } = renderHook(() => useAuth());
      await act(async () => {});

      expect(result.current.user?.name).toBe("OIDC Name");
    });

    it("should convert createdAt to Date", async () => {
      mockGetUser.mockResolvedValue(makeOidcUser());
      mockProfileData = {
        id: "u1",
        email: "jane@example.com",
        name: null,
        emailVerified: true,
        createdAt: "2024-06-15T12:00:00Z",
        organizations: [],
      };
      const { result } = renderHook(() => useAuth());
      await act(async () => {});

      expect(result.current.user?.createdAt).toBeInstanceOf(Date);
    });
  });

  describe("OIDC events", () => {
    it("should register event listeners on mount", async () => {
      mockGetUser.mockResolvedValue(null);
      renderHook(() => useAuth());
      await act(async () => {});

      expect(mockEvents.addUserLoaded).toHaveBeenCalledTimes(1);
      expect(mockEvents.addUserUnloaded).toHaveBeenCalledTimes(1);
      expect(mockEvents.addSilentRenewError).toHaveBeenCalledTimes(1);
    });

    it("should remove event listeners on unmount", async () => {
      mockGetUser.mockResolvedValue(null);
      const { unmount } = renderHook(() => useAuth());
      await act(async () => {});

      unmount();

      expect(mockEvents.removeUserLoaded).toHaveBeenCalledTimes(1);
      expect(mockEvents.removeUserUnloaded).toHaveBeenCalledTimes(1);
      expect(mockEvents.removeSilentRenewError).toHaveBeenCalledTimes(1);
    });
  });

  describe("login()", () => {
    it("should save returnTo in sessionStorage and call signinRedirect", async () => {
      mockGetUser.mockResolvedValue(null);
      const { result } = renderHook(() => useAuth());
      await act(async () => {});

      window.history.pushState({}, "", "/submissions?page=2");

      act(() => {
        result.current.login();
      });

      expect(sessionStorage.getItem("auth_return_to")).toBe(
        "/submissions?page=2",
      );
      expect(mockSigninRedirect).toHaveBeenCalled();
    });

    it("should NOT save returnTo for root path", async () => {
      mockGetUser.mockResolvedValue(null);
      sessionStorage.clear();
      const { result } = renderHook(() => useAuth());
      await act(async () => {});

      window.history.pushState({}, "", "/");

      act(() => {
        result.current.login();
      });

      expect(sessionStorage.getItem("auth_return_to")).toBeNull();
      expect(mockSigninRedirect).toHaveBeenCalled();
    });
  });

  describe("logout()", () => {
    it("should clear org ID and call signoutRedirect", async () => {
      mockGetUser.mockResolvedValue(null);
      const { result } = renderHook(() => useAuth());
      await act(async () => {});

      act(() => {
        result.current.logout();
      });

      expect(mockSetCurrentOrgId).toHaveBeenCalledWith(null);
      expect(mockSignoutRedirect).toHaveBeenCalled();
    });
  });

  describe("isEmailVerified", () => {
    it("should return emailVerified from user profile", async () => {
      mockGetUser.mockResolvedValue(makeOidcUser());
      mockProfileData = {
        id: "u1",
        email: "jane@example.com",
        name: null,
        emailVerified: true,
        createdAt: "2024-01-01T00:00:00Z",
        organizations: [],
      };
      const { result } = renderHook(() => useAuth());
      await act(async () => {});

      expect(result.current.isEmailVerified).toBe(true);
    });

    it("should return false when no user", async () => {
      mockGetUser.mockResolvedValue(null);
      const { result } = renderHook(() => useAuth());
      await act(async () => {});

      expect(result.current.isEmailVerified).toBe(false);
    });
  });

  describe("stale OIDC token recovery", () => {
    it("forces re-auth when users.me returns UNAUTHORIZED after retries", async () => {
      const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
      mockGetUser.mockResolvedValue(makeOidcUser());
      mockProfileError = Object.assign(new Error("UNAUTHORIZED"), {
        data: { code: "UNAUTHORIZED" },
      });

      renderHook(() => useAuth());
      await act(async () => {});

      expect(warnSpy).toHaveBeenCalledWith(
        "Stale OIDC token detected, forcing re-authentication",
      );
      expect(mockRemoveUser).toHaveBeenCalled();

      // Wait for removeUser().then() to resolve
      await act(async () => {});

      expect(mockSigninRedirect).toHaveBeenCalled();
      warnSpy.mockRestore();
    });

    it("does not force re-auth for non-auth errors (e.g., 500)", async () => {
      mockGetUser.mockResolvedValue(makeOidcUser());
      mockProfileError = Object.assign(new Error("Internal server error"), {
        data: { code: "INTERNAL_SERVER_ERROR" },
      });

      renderHook(() => useAuth());
      await act(async () => {});

      expect(mockRemoveUser).not.toHaveBeenCalled();
    });
  });

  describe("tRPC query", () => {
    it("should enable query when OIDC user has valid token", async () => {
      mockGetUser.mockResolvedValue(makeOidcUser());
      renderHook(() => useAuth());
      await act(async () => {});

      expect(mockQueryEnabled).toBe(true);
    });

    it("should disable query when no OIDC user", async () => {
      mockGetUser.mockResolvedValue(null);
      renderHook(() => useAuth());
      await act(async () => {});

      expect(mockQueryEnabled).toBe(false);
    });
  });
});
