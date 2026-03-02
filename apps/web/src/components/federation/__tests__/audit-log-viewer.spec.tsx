import React from "react";
import { render, screen } from "@testing-library/react";
import "../../../../test/setup";

let mockEvents: unknown[] = [
  {
    id: "e1",
    action: "FEDERATION_TRUST_INITIATED",
    resource: "federation",
    resourceId: "res-123456789",
    actorId: "act-987654321",
    ipAddress: "192.168.1.1",
    userAgent: null,
    method: "POST",
    route: "/trpc/federation.initiateTrust",
    oldValue: null,
    newValue: null,
    createdAt: "2024-01-01T00:00:00Z",
  },
];
let mockIsPending = false;

function resetMocks() {
  mockEvents = [
    {
      id: "e1",
      action: "FEDERATION_TRUST_INITIATED",
      resource: "federation",
      resourceId: "res-123456789",
      actorId: "act-987654321",
      ipAddress: "192.168.1.1",
      userAgent: null,
      method: "POST",
      route: "/trpc/federation.initiateTrust",
      oldValue: null,
      newValue: null,
      createdAt: "2024-01-01T00:00:00Z",
    },
  ];
  mockIsPending = false;
}

jest.mock("@/lib/trpc", () => ({
  trpc: {
    audit: {
      list: {
        useQuery: () => ({
          data: {
            items: mockEvents,
            total: mockEvents.length,
            totalPages: 1,
          },
          isPending: mockIsPending,
        }),
      },
    },
  },
}));

jest.mock("next/navigation", () => ({
  usePathname: () => "/federation/audit",
  useRouter: () => ({ push: jest.fn() }),
}));

jest.mock("next/link", () => ({
  __esModule: true,
  default: ({ children, href }: { children: React.ReactNode; href: string }) =>
    React.createElement("a", { href }, children),
}));

import { AuditLogViewer } from "../audit-log-viewer";

describe("AuditLogViewer", () => {
  beforeEach(resetMocks);

  it("renders loading skeleton when pending", () => {
    mockIsPending = true;
    render(<AuditLogViewer />);
    expect(screen.queryByRole("table")).not.toBeInTheDocument();
  });

  it("renders empty state when no events", () => {
    mockEvents = [];
    render(<AuditLogViewer />);
    expect(screen.getByText("No audit events found.")).toBeInTheDocument();
  });

  it("renders event table with action badges", () => {
    render(<AuditLogViewer />);
    expect(screen.getByText("FEDERATION_TRUST_INITIATED")).toBeInTheDocument();
  });

  it("renders filter controls section", () => {
    render(<AuditLogViewer />);
    expect(
      screen.getByRole("button", { name: /filters/i }),
    ).toBeInTheDocument();
  });
});
