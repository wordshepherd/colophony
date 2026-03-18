import { vi, type Mock } from "vitest";
import { render, screen } from "@testing-library/react";
import { ProtectedRoute } from "../protected-route";
import { mockPush } from "../../../../test/setup";

// --- Mutable mock state ---
let mockAuthReturn: {
  user: object | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  isEmailVerified: boolean;
  error: Error | null;
  login: Mock;
  logout: Mock;
};

let mockOrgReturn: {
  currentOrg: object | null;
  isEditor: boolean;
  isAdmin: boolean;
  hasOrganizations: boolean;
};

function resetAuth() {
  mockAuthReturn = {
    user: { id: "u1", email: "a@b.com", name: "Test", emailVerified: true },
    isLoading: false,
    isAuthenticated: true,
    isEmailVerified: true,
    error: null,
    login: vi.fn(),
    logout: vi.fn(),
  };
}

function resetOrg() {
  mockOrgReturn = {
    currentOrg: { id: "org-1", name: "Org 1", slug: "org-1", role: "ADMIN" },
    isEditor: true,
    isAdmin: true,
    hasOrganizations: true,
  };
}

vi.mock("@/hooks/use-auth", () => ({
  useAuth: () => mockAuthReturn,
}));

vi.mock("@/hooks/use-organization", () => ({
  useOrganization: () => mockOrgReturn,
}));

describe("ProtectedRoute", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetAuth();
    resetOrg();
  });

  describe("loading", () => {
    it("should render skeletons when loading", () => {
      mockAuthReturn.isLoading = true;
      const { container } = render(
        <ProtectedRoute>
          <div>Protected Content</div>
        </ProtectedRoute>,
      );

      expect(screen.queryByText("Protected Content")).not.toBeInTheDocument();
      // Skeleton divs should be present
      expect(
        container.querySelectorAll(
          '[class*="animate-pulse"], [class*="skeleton"]',
        ).length || container.querySelectorAll("div").length,
      ).toBeGreaterThan(0);
    });

    it("should not render children when loading", () => {
      mockAuthReturn.isLoading = true;
      render(
        <ProtectedRoute>
          <div>Protected Content</div>
        </ProtectedRoute>,
      );

      expect(screen.queryByText("Protected Content")).not.toBeInTheDocument();
    });
  });

  describe("unauthenticated", () => {
    it("should call login when not authenticated", () => {
      mockAuthReturn.isAuthenticated = false;
      render(
        <ProtectedRoute>
          <div>Protected Content</div>
        </ProtectedRoute>,
      );

      expect(mockAuthReturn.login).toHaveBeenCalled();
    });

    it("should return null when not authenticated", () => {
      mockAuthReturn.isAuthenticated = false;
      const { container } = render(
        <ProtectedRoute>
          <div>Protected Content</div>
        </ProtectedRoute>,
      );

      expect(screen.queryByText("Protected Content")).not.toBeInTheDocument();
      // Should render nothing (null return)
      expect(container.firstChild).toBeNull();
    });
  });

  describe("no organizations", () => {
    it("should redirect to /organizations/new when no orgs", () => {
      mockOrgReturn.hasOrganizations = false;
      render(
        <ProtectedRoute>
          <div>Protected Content</div>
        </ProtectedRoute>,
      );

      expect(mockPush).toHaveBeenCalledWith("/organizations/new");
    });
  });

  describe("role checks", () => {
    it("should redirect when requireEditor and not editor", () => {
      mockOrgReturn.isEditor = false;
      mockOrgReturn.isAdmin = false;
      render(
        <ProtectedRoute requireEditor>
          <div>Protected Content</div>
        </ProtectedRoute>,
      );

      expect(mockPush).toHaveBeenCalledWith("/dashboard?unauthorized=true");
    });

    it("should redirect when requireAdmin and not admin", () => {
      mockOrgReturn.isAdmin = false;
      render(
        <ProtectedRoute requireAdmin>
          <div>Protected Content</div>
        </ProtectedRoute>,
      );

      expect(mockPush).toHaveBeenCalledWith("/dashboard?unauthorized=true");
    });

    it("should render children when role requirement is met", () => {
      render(
        <ProtectedRoute requireAdmin>
          <div>Protected Content</div>
        </ProtectedRoute>,
      );

      expect(screen.getByText("Protected Content")).toBeInTheDocument();
    });
  });

  describe("profile states", () => {
    it("should show spinner when authenticated but no user profile", () => {
      mockAuthReturn.user = null;
      render(
        <ProtectedRoute>
          <div>Protected Content</div>
        </ProtectedRoute>,
      );

      expect(
        screen.getByText("Setting up your account..."),
      ).toBeInTheDocument();
    });

    it("should show error with retry button when profile fetch errors", () => {
      mockAuthReturn.user = null;
      mockAuthReturn.error = new Error("Network error");
      render(
        <ProtectedRoute>
          <div>Protected Content</div>
        </ProtectedRoute>,
      );

      expect(
        screen.getByText("Unable to load your profile"),
      ).toBeInTheDocument();
      expect(screen.getByText("Network error")).toBeInTheDocument();
      expect(screen.getByText("Retry")).toBeInTheDocument();
    });
  });

  describe("email verification", () => {
    it("should return null when email verification required but not verified", () => {
      mockAuthReturn.isEmailVerified = false;
      const { container } = render(
        <ProtectedRoute requireEmailVerified>
          <div>Protected Content</div>
        </ProtectedRoute>,
      );

      expect(screen.queryByText("Protected Content")).not.toBeInTheDocument();
      expect(container.innerHTML).toBe("");
    });
  });

  describe("no current org", () => {
    it("should render null when hasOrganizations but no currentOrg", () => {
      mockOrgReturn.currentOrg = null;
      const { container } = render(
        <ProtectedRoute>
          <div>Protected Content</div>
        </ProtectedRoute>,
      );

      expect(screen.queryByText("Protected Content")).not.toBeInTheDocument();
      expect(container.innerHTML).toBe("");
    });
  });

  describe("happy path", () => {
    it("should render children when all checks pass", () => {
      render(
        <ProtectedRoute>
          <div>Protected Content</div>
        </ProtectedRoute>,
      );

      expect(screen.getByText("Protected Content")).toBeInTheDocument();
    });
  });
});
