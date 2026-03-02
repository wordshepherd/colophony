import React from "react";
import { render, screen } from "@testing-library/react";
import "../../../../test/setup";

let mockIsPending = false;

function resetMocks() {
  mockIsPending = false;
}

jest.mock("@/lib/trpc", () => ({
  trpc: {
    simsub: {
      listChecks: {
        useQuery: () => ({
          data: undefined,
          isPending: mockIsPending,
          error: null,
        }),
      },
      grantOverride: {
        useMutation: () => ({
          mutate: jest.fn(),
          isPending: false,
        }),
      },
    },
    useUtils: () => ({
      simsub: {
        listChecks: {
          invalidate: jest.fn(),
        },
      },
    }),
  },
}));

jest.mock("next/navigation", () => ({
  usePathname: () => "/federation/sim-sub",
  useRouter: () => ({ push: jest.fn() }),
}));

jest.mock("next/link", () => ({
  __esModule: true,
  default: ({ children, href }: { children: React.ReactNode; href: string }) =>
    React.createElement("a", { href }, children),
}));

import { SimSubAdmin } from "../sim-sub-admin";

describe("SimSubAdmin", () => {
  beforeEach(resetMocks);

  it("renders heading and back link", () => {
    render(<SimSubAdmin />);
    expect(screen.getByText("Sim-Sub Checks")).toBeInTheDocument();
    expect(screen.getByRole("link")).toBeInTheDocument();
  });

  it("renders lookup form with input and button", () => {
    render(<SimSubAdmin />);
    expect(screen.getByPlaceholderText("Submission UUID")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /look up/i }),
    ).toBeInTheDocument();
  });

  it("does not show results card on initial render", () => {
    render(<SimSubAdmin />);
    expect(screen.queryByText("Check History")).not.toBeInTheDocument();
  });
});
