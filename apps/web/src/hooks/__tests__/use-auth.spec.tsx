import { renderHook, act } from "@testing-library/react";
import { useAuth } from "../use-auth";
import * as authLib from "@/lib/auth";
import { mockPush } from "../../../test/setup";

// Mock tRPC
const mockRefetch = jest.fn();
const mockLoginMutateAsync = jest.fn();
const mockRegisterMutateAsync = jest.fn();
const mockLogoutMutateAsync = jest.fn();
const mockRefreshMutate = jest.fn();
const mockReset = jest.fn();
const mockInvalidate = jest.fn();

let mockMeData: unknown = null;
let mockMeIsLoading = false;
let mockMeError: Error | null = null;

jest.mock("@/lib/trpc", () => ({
  trpc: {
    auth: {
      me: {
        useQuery: (input: unknown, opts: unknown) => ({
          data: mockMeData,
          isLoading: mockMeIsLoading,
          error: mockMeError,
          refetch: mockRefetch,
        }),
      },
      login: {
        useMutation: (opts: { onSuccess?: (data: unknown) => void }) => {
          const onSuccess = opts?.onSuccess;
          return {
            mutateAsync: async (input: unknown) => {
              const result = await mockLoginMutateAsync(input);
              onSuccess?.(result);
              return result;
            },
            isPending: false,
            error: null,
          };
        },
      },
      register: {
        useMutation: (opts: { onSuccess?: (data: unknown) => void }) => {
          const onSuccess = opts?.onSuccess;
          return {
            mutateAsync: async (input: unknown) => {
              const result = await mockRegisterMutateAsync(input);
              onSuccess?.(result);
              return result;
            },
            isPending: false,
            error: null,
          };
        },
      },
      logout: {
        useMutation: (opts: {
          onSuccess?: () => void;
          onError?: () => void;
        }) => ({
          mutateAsync: async (input: unknown) => {
            try {
              await mockLogoutMutateAsync(input);
              opts?.onSuccess?.();
            } catch {
              opts?.onError?.();
            }
          },
          isPending: false,
        }),
      },
      refresh: {
        useMutation: (opts: {
          onSuccess?: (data: unknown) => void;
          onError?: () => void;
        }) => ({
          mutate: mockRefreshMutate,
          isPending: false,
        }),
      },
    },
    useUtils: () => ({
      auth: { me: { reset: mockReset } },
      invalidate: mockInvalidate,
    }),
  },
}));

// Mock auth lib (spy on the real functions)
jest.mock("@/lib/auth", () => ({
  setAuthTokens: jest.fn(),
  getRefreshToken: jest.fn(() => null),
  clearAuthData: jest.fn(),
  isTokenExpiringSoon: jest.fn(() => false),
  hasAuthTokens: jest.fn(() => false),
}));

const mockSetAuthTokens = authLib.setAuthTokens as jest.Mock;
const mockGetRefreshToken = authLib.getRefreshToken as jest.Mock;
const mockClearAuthData = authLib.clearAuthData as jest.Mock;
const mockHasAuthTokens = authLib.hasAuthTokens as jest.Mock;

describe("useAuth", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
    mockMeData = null;
    mockMeIsLoading = false;
    mockMeError = null;
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  describe("initial state", () => {
    it("should return loading state initially", () => {
      mockMeIsLoading = true;
      const { result } = renderHook(() => useAuth());
      expect(result.current.isLoading).toBe(true);
    });

    it("should return unauthenticated when no user", () => {
      const { result } = renderHook(() => useAuth());
      expect(result.current.isAuthenticated).toBe(false);
      expect(result.current.user).toBeNull();
    });

    it("should return authenticated when user exists", () => {
      mockMeData = {
        id: "1",
        email: "test@test.com",
        emailVerified: true,
        organizations: [],
      };
      const { result } = renderHook(() => useAuth());
      expect(result.current.isAuthenticated).toBe(true);
      expect(result.current.user?.email).toBe("test@test.com");
    });

    it("should derive isEmailVerified from user", () => {
      mockMeData = {
        id: "1",
        email: "test@test.com",
        emailVerified: false,
        organizations: [],
      };
      const { result } = renderHook(() => useAuth());
      expect(result.current.isEmailVerified).toBe(false);
    });
  });

  describe("login", () => {
    it("should call login mutation and store tokens", async () => {
      mockLoginMutateAsync.mockResolvedValue({
        accessToken: "access-token",
        refreshToken: "refresh-token",
        expiresIn: 900,
      });

      const { result } = renderHook(() => useAuth());

      await act(async () => {
        await result.current.login({
          email: "test@test.com",
          password: "password123",
        });
      });

      expect(mockLoginMutateAsync).toHaveBeenCalledWith({
        email: "test@test.com",
        password: "password123",
      });
      expect(mockSetAuthTokens).toHaveBeenCalledWith(
        "access-token",
        "refresh-token",
        900,
      );
    });
  });

  describe("register", () => {
    it("should call register mutation and store tokens", async () => {
      mockRegisterMutateAsync.mockResolvedValue({
        accessToken: "new-access",
        refreshToken: "new-refresh",
        expiresIn: 900,
      });

      const { result } = renderHook(() => useAuth());

      await act(async () => {
        await result.current.register({
          email: "new@test.com",
          password: "password123",
          name: "Test User",
        });
      });

      expect(mockRegisterMutateAsync).toHaveBeenCalledWith({
        email: "new@test.com",
        password: "password123",
        name: "Test User",
      });
      expect(mockSetAuthTokens).toHaveBeenCalledWith(
        "new-access",
        "new-refresh",
        900,
      );
    });
  });

  describe("logout", () => {
    it("should clear auth data and redirect to login", async () => {
      mockGetRefreshToken.mockReturnValue("my-refresh");
      mockLogoutMutateAsync.mockResolvedValue(undefined);

      const { result } = renderHook(() => useAuth());

      await act(async () => {
        await result.current.logout();
      });

      expect(mockLogoutMutateAsync).toHaveBeenCalledWith({
        refreshToken: "my-refresh",
      });
      expect(mockClearAuthData).toHaveBeenCalled();
      expect(mockReset).toHaveBeenCalled();
      expect(mockPush).toHaveBeenCalledWith("/login");
    });

    it("should still clear and redirect when no refresh token", async () => {
      mockGetRefreshToken.mockReturnValue(null);

      const { result } = renderHook(() => useAuth());

      await act(async () => {
        await result.current.logout();
      });

      expect(mockLogoutMutateAsync).not.toHaveBeenCalled();
      expect(mockClearAuthData).toHaveBeenCalled();
      expect(mockPush).toHaveBeenCalledWith("/login");
    });

    it("should clear and redirect even if logout API fails", async () => {
      mockGetRefreshToken.mockReturnValue("my-refresh");
      mockLogoutMutateAsync.mockRejectedValue(new Error("Network error"));

      const { result } = renderHook(() => useAuth());

      await act(async () => {
        await result.current.logout();
      });

      expect(mockClearAuthData).toHaveBeenCalled();
      expect(mockPush).toHaveBeenCalledWith("/login");
    });
  });

  describe("auto-refresh on mount", () => {
    it("should trigger refresh when token is expiring soon", () => {
      mockHasAuthTokens.mockReturnValue(true);
      (authLib.isTokenExpiringSoon as jest.Mock).mockReturnValue(true);
      mockGetRefreshToken.mockReturnValue("expiring-refresh");

      renderHook(() => useAuth());

      expect(mockRefreshMutate).toHaveBeenCalledWith({
        refreshToken: "expiring-refresh",
      });
    });

    it("should not trigger refresh when token is not expiring", () => {
      mockHasAuthTokens.mockReturnValue(true);
      (authLib.isTokenExpiringSoon as jest.Mock).mockReturnValue(false);

      renderHook(() => useAuth());

      expect(mockRefreshMutate).not.toHaveBeenCalled();
    });
  });
});
