import { vi } from "vitest";
import React from "react";
import { render, screen } from "@testing-library/react";

let mockTransfer: unknown = {
  id: "t-1",
  submissionId: "sub-123",
  targetDomain: "peer.com",
  status: "PENDING",
  submitterDid: "did:example:123",
  contentFingerprint: "abc123",
  tokenExpiresAt: "2024-12-01",
  createdAt: "2024-01-01",
  completedAt: null,
  updatedAt: "2024-01-01",
  failureReason: null,
  fileManifest: [
    {
      filename: "story.docx",
      mimeType:
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      size: 12345,
    },
  ],
};
let mockIsPending = false;
let mockError: unknown = null;

function resetMocks() {
  mockTransfer = {
    id: "t-1",
    submissionId: "sub-123",
    targetDomain: "peer.com",
    status: "PENDING",
    submitterDid: "did:example:123",
    contentFingerprint: "abc123",
    tokenExpiresAt: "2024-12-01",
    createdAt: "2024-01-01",
    completedAt: null,
    updatedAt: "2024-01-01",
    failureReason: null,
    fileManifest: [
      {
        filename: "story.docx",
        mimeType:
          "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        size: 12345,
      },
    ],
  };
  mockIsPending = false;
  mockError = null;
}

vi.mock("@/lib/trpc", () => ({
  trpc: {
    transfers: {
      getById: {
        useQuery: () => ({
          data: mockTransfer,
          isPending: mockIsPending,
          error: mockError,
        }),
      },
      cancel: {
        useMutation: () => ({
          mutate: vi.fn(),
          isPending: false,
        }),
      },
    },
    useUtils: () => ({
      transfers: {
        getById: {
          invalidate: vi.fn(),
        },
        list: {
          invalidate: vi.fn(),
        },
      },
    }),
  },
}));

vi.mock("next/navigation", () => ({
  usePathname: () => "/federation/transfers/t-1",
  useRouter: () => ({ push: vi.fn() }),
}));

vi.mock("next/link", () => ({
  __esModule: true,
  default: ({ children, href }: { children: React.ReactNode; href: string }) =>
    React.createElement("a", { href }, children),
}));

import { TransferDetail } from "../transfer-detail";

describe("TransferDetail", () => {
  beforeEach(resetMocks);

  it("renders loading skeleton when pending", () => {
    mockIsPending = true;
    mockTransfer = undefined;
    render(<TransferDetail transferId="t-1" />);
    expect(screen.queryByText("peer.com")).not.toBeInTheDocument();
  });

  it("renders not found when transfer is null", () => {
    mockTransfer = null;
    render(<TransferDetail transferId="t-1" />);
    expect(screen.getByText("Transfer not found.")).toBeInTheDocument();
  });

  it("renders transfer info fields", () => {
    render(<TransferDetail transferId="t-1" />);
    expect(screen.getByText("peer.com")).toBeInTheDocument();
    expect(screen.getByText("sub-123")).toBeInTheDocument();
  });

  it("renders cancel button for PENDING status", () => {
    render(<TransferDetail transferId="t-1" />);
    expect(
      screen.getByRole("button", { name: /cancel transfer/i }),
    ).toBeInTheDocument();
  });

  it("renders file manifest table", () => {
    render(<TransferDetail transferId="t-1" />);
    expect(screen.getByText("story.docx")).toBeInTheDocument();
  });
});
