import { renderHook, act } from "@testing-library/react";
import { useOrganization } from "../use-organization";
import * as trpcLib from "@/lib/trpc";

// Mock useAuth
const mockUser = {
  id: "user-1",
  email: "test@test.com",
  emailVerified: true,
  organizations: [
    {
      id: "org-1",
      name: "Org One",
      slug: "org-one",
      role: "ADMIN" as const,
    },
    {
      id: "org-2",
      name: "Org Two",
      slug: "org-two",
      role: "EDITOR" as const,
    },
    {
      id: "org-3",
      name: "Org Three",
      slug: "org-three",
      role: "READER" as const,
    },
  ],
};

let currentMockUser: typeof mockUser | null = mockUser;
let mockIsAuthenticated = true;

jest.mock("../use-auth", () => ({
  useAuth: () => ({
    user: currentMockUser,
    isAuthenticated: mockIsAuthenticated,
  }),
}));

const mockInvalidate = jest.fn();

jest.mock("@/lib/trpc", () => ({
  trpc: {
    useUtils: () => ({
      invalidate: mockInvalidate,
    }),
  },
  getCurrentOrgId: jest.fn(() => null),
  setCurrentOrgId: jest.fn(),
}));

const mockGetCurrentOrgId = trpcLib.getCurrentOrgId as jest.Mock;
const mockSetCurrentOrgId = trpcLib.setCurrentOrgId as jest.Mock;

describe("useOrganization", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    currentMockUser = mockUser;
    mockIsAuthenticated = true;
    mockGetCurrentOrgId.mockReturnValue(null);
  });

  describe("organizations list", () => {
    it("should map user organizations to Organization format", () => {
      const { result } = renderHook(() => useOrganization());

      expect(result.current.organizations).toEqual([
        { id: "org-1", name: "Org One", slug: "org-one", role: "ADMIN" },
        { id: "org-2", name: "Org Two", slug: "org-two", role: "EDITOR" },
        { id: "org-3", name: "Org Three", slug: "org-three", role: "READER" },
      ]);
    });

    it("should return empty array when user has no organizations", () => {
      currentMockUser = { ...mockUser, organizations: [] };
      const { result } = renderHook(() => useOrganization());
      expect(result.current.organizations).toEqual([]);
    });

    it("should return empty array when user is null", () => {
      currentMockUser = null;
      const { result } = renderHook(() => useOrganization());
      expect(result.current.organizations).toEqual([]);
    });
  });

  describe("currentOrg", () => {
    it("should match stored org ID", () => {
      mockGetCurrentOrgId.mockReturnValue("org-2");
      const { result } = renderHook(() => useOrganization());
      expect(result.current.currentOrg?.id).toBe("org-2");
      expect(result.current.currentOrg?.name).toBe("Org Two");
    });

    it("should auto-recover stale org ID to first valid org", () => {
      mockGetCurrentOrgId.mockReturnValue("nonexistent");
      const { result } = renderHook(() => useOrganization());
      // Stale org recovery useEffect auto-switches to the first valid org
      expect(result.current.currentOrg?.id).toBe("org-1");
      expect(mockSetCurrentOrgId).toHaveBeenCalledWith("org-1");
      expect(mockInvalidate).toHaveBeenCalled();
    });

    it("should auto-select first org when none stored", () => {
      mockGetCurrentOrgId.mockReturnValue(null);
      renderHook(() => useOrganization());
      expect(mockSetCurrentOrgId).toHaveBeenCalledWith("org-1");
    });
  });

  describe("switchOrganization", () => {
    it("should set org ID and invalidate queries", () => {
      mockGetCurrentOrgId.mockReturnValue("org-1");
      const { result } = renderHook(() => useOrganization());

      act(() => {
        result.current.switchOrganization("org-2");
      });

      expect(mockSetCurrentOrgId).toHaveBeenCalledWith("org-2");
      expect(mockInvalidate).toHaveBeenCalled();
    });

    it("should log error for unknown org", () => {
      const consoleSpy = jest.spyOn(console, "error").mockImplementation();
      mockGetCurrentOrgId.mockReturnValue("org-1");
      const { result } = renderHook(() => useOrganization());

      act(() => {
        result.current.switchOrganization("nonexistent");
      });

      expect(consoleSpy).toHaveBeenCalledWith(
        "Organization not found:",
        "nonexistent",
      );
      consoleSpy.mockRestore();
    });
  });

  describe("role checks", () => {
    it("should detect ADMIN role", () => {
      mockGetCurrentOrgId.mockReturnValue("org-1");
      const { result } = renderHook(() => useOrganization());
      expect(result.current.isAdmin).toBe(true);
      expect(result.current.isEditor).toBe(true); // Admin implies editor
      expect(result.current.isReader).toBe(false);
      expect(result.current.canWrite).toBe(true);
    });

    it("should detect EDITOR role", () => {
      mockGetCurrentOrgId.mockReturnValue("org-2");
      const { result } = renderHook(() => useOrganization());
      expect(result.current.isAdmin).toBe(false);
      expect(result.current.isEditor).toBe(true);
      expect(result.current.isReader).toBe(false);
      expect(result.current.canWrite).toBe(true);
    });

    it("should detect READER role", () => {
      mockGetCurrentOrgId.mockReturnValue("org-3");
      const { result } = renderHook(() => useOrganization());
      expect(result.current.isAdmin).toBe(false);
      expect(result.current.isEditor).toBe(false);
      expect(result.current.isReader).toBe(true);
      expect(result.current.canWrite).toBe(false);
    });

    it("should recover to first org roles when stored org is stale", () => {
      mockGetCurrentOrgId.mockReturnValue("nonexistent");
      const { result } = renderHook(() => useOrganization());
      // Stale recovery switches to org-1 (ADMIN), so all role checks are true
      expect(result.current.isAdmin).toBe(true);
      expect(result.current.isEditor).toBe(true);
      expect(result.current.isReader).toBe(false);
      expect(result.current.canWrite).toBe(true);
    });
  });

  describe("hasOrganizations", () => {
    it("should return true when user has organizations", () => {
      const { result } = renderHook(() => useOrganization());
      expect(result.current.hasOrganizations).toBe(true);
    });

    it("should return false when user has no organizations", () => {
      currentMockUser = { ...mockUser, organizations: [] };
      const { result } = renderHook(() => useOrganization());
      expect(result.current.hasOrganizations).toBe(false);
    });
  });
});
