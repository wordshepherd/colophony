import { vi } from "vitest";
import React from "react";
import { render, screen } from "@testing-library/react";

let mockPeers: unknown[] = [];
let mockIsPending = false;
let mockIsAdmin = true;

function resetMocks() {
  mockPeers = [];
  mockIsPending = false;
  mockIsAdmin = true;
}

vi.mock("@/lib/trpc", () => ({
  trpc: {
    federation: {
      listPeers: {
        useQuery: () => ({
          data: mockIsPending ? undefined : mockPeers,
          isPending: mockIsPending,
        }),
      },
      previewRemote: {
        useQuery: () => ({
          data: undefined,
          isFetching: false,
          refetch: vi.fn(),
        }),
      },
      initiateTrust: {
        useMutation: () => ({
          mutate: vi.fn(),
          isPending: false,
        }),
      },
    },
    useUtils: () => ({
      federation: {
        listPeers: { invalidate: vi.fn() },
      },
    }),
  },
}));

vi.mock("@/hooks/use-organization", () => ({
  useOrganization: () => ({
    isAdmin: mockIsAdmin,
    isEditor: true,
  }),
}));

vi.mock("next/navigation", () => ({
  usePathname: () => "/federation/peers",
  useRouter: () => ({
    push: vi.fn(),
  }),
}));

vi.mock("next/link", () => ({
  __esModule: true,
  default: ({ children, href }: { children: React.ReactNode; href: string }) =>
    React.createElement("a", { href }, children),
}));

import { PeerList } from "../peer-list";

describe("PeerList", () => {
  beforeEach(resetMocks);

  it("renders loading skeleton when pending", () => {
    mockIsPending = true;
    render(<PeerList />);
    expect(screen.queryByText("Trusted Peers")).not.toBeInTheDocument();
  });

  it("renders empty state when no peers", () => {
    mockPeers = [];
    render(<PeerList />);
    expect(
      screen.getByText(
        "No trusted peers yet. Initiate trust with another Colophony instance to get started.",
      ),
    ).toBeInTheDocument();
  });

  it("renders peer table with domain, status dot, and capabilities", () => {
    mockPeers = [
      {
        id: "p1",
        domain: "remote.example.com",
        status: "active",
        grantedCapabilities: { "simsub.check": true, "identity.verify": true },
        initiatedBy: "local",
        lastVerifiedAt: "2026-01-01T00:00:00.000Z",
        createdAt: "2025-12-01T00:00:00.000Z",
        updatedAt: "2026-01-01T00:00:00.000Z",
      },
    ];
    render(<PeerList />);
    expect(screen.getByText("remote.example.com")).toBeInTheDocument();
    // "Active" appears in both filter tab and status column — use getAllByText
    expect(screen.getAllByText("Active").length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText("simsub.check")).toBeInTheDocument();
  });

  it("status dots use correct colors", () => {
    mockPeers = [
      {
        id: "p1",
        domain: "active.com",
        status: "active",
        grantedCapabilities: {},
        initiatedBy: "local",
        lastVerifiedAt: null,
        createdAt: "2025-12-01T00:00:00.000Z",
        updatedAt: "2026-01-01T00:00:00.000Z",
      },
      {
        id: "p2",
        domain: "pending.com",
        status: "pending_outbound",
        grantedCapabilities: {},
        initiatedBy: "local",
        lastVerifiedAt: null,
        createdAt: "2025-12-01T00:00:00.000Z",
        updatedAt: "2026-01-01T00:00:00.000Z",
      },
    ];
    render(<PeerList />);
    const dots = document.querySelectorAll(".rounded-full");
    const classes = Array.from(dots).map((d) => d.className);
    expect(classes.some((c) => c.includes("bg-green-500"))).toBe(true);
    expect(classes.some((c) => c.includes("bg-yellow-500"))).toBe(true);
  });

  it("Initiate Trust button renders for admin users", () => {
    mockIsAdmin = true;
    render(<PeerList />);
    expect(screen.getByText("Initiate Trust")).toBeInTheDocument();
  });
});
