import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { CreateOrgForm } from "../create-org-form";
import { mockPush } from "../../../../test/setup";

// --- Mutable mock state ---
let mockIsChecking = false;
let mockIsAvailable: boolean | null = null;
let mockHasOrganizations = false;
const mockMutate = jest.fn();
const mockInvalidate = jest.fn();

jest.mock("@/hooks/use-slug-check", () => ({
  useSlugCheck: (_slug: string) => {
    return {
      isChecking: mockIsChecking,
      isAvailable: mockIsAvailable,
      debouncedSlug: slug,
    };
  },
}));

jest.mock("@/hooks/use-organization", () => ({
  useOrganization: () => ({
    hasOrganizations: mockHasOrganizations,
  }),
}));

jest.mock("@/lib/trpc", () => ({
  trpc: {
    useUtils: () => ({
      users: { me: { invalidate: mockInvalidate } },
    }),
    organizations: {
      create: {
        useMutation: (_opts: Record<string, unknown>) => ({
          mutate: (data: unknown) => {
            mockMutate(data);
            // Simulate success for onSuccess tests if needed
          },
          isPending: false,
        }),
      },
    },
  },
  setCurrentOrgId: jest.fn(),
}));

jest.mock("sonner", () => ({
  toast: {
    success: jest.fn(),
    error: jest.fn(),
  },
}));

describe("CreateOrgForm", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockIsChecking = false;
    mockIsAvailable = null;
    mockDebouncedSlug = "";
    mockHasOrganizations = false;
  });

  it("should render name and slug inputs", () => {
    render(<CreateOrgForm />);
    expect(
      screen.getByPlaceholderText("My Literary Magazine"),
    ).toBeInTheDocument();
    expect(
      screen.getByPlaceholderText("my-literary-magazine"),
    ).toBeInTheDocument();
  });

  it("should auto-slugify name into slug field", async () => {
    const user = userEvent.setup();
    render(<CreateOrgForm />);

    const nameInput = screen.getByPlaceholderText("My Literary Magazine");
    await user.type(nameInput, "My Cool Magazine");

    const slugInput = screen.getByPlaceholderText(
      "my-literary-magazine",
    ) as HTMLInputElement;
    expect(slugInput.value).toBe("my-cool-magazine");
  });

  it("should stop auto-slugifying after manual slug edit", async () => {
    const user = userEvent.setup();
    render(<CreateOrgForm />);

    const nameInput = screen.getByPlaceholderText("My Literary Magazine");
    const slugInput = screen.getByPlaceholderText("my-literary-magazine");

    await user.type(nameInput, "Foo");
    expect((slugInput as HTMLInputElement).value).toBe("foo");

    // Manual edit
    await user.clear(slugInput);
    await user.type(slugInput, "custom-slug");

    // Now typing in name should not change slug
    await user.clear(nameInput);
    await user.type(nameInput, "Bar");
    expect((slugInput as HTMLInputElement).value).toBe("custom-slug");
  });

  it("should disable submit when slug is unavailable", () => {
    mockIsAvailable = false;
    render(<CreateOrgForm />);

    const submitBtn = screen.getByRole("button", {
      name: "Create Organization",
    });
    expect(submitBtn).toBeDisabled();
  });

  it("should disable submit when slug is being checked", () => {
    mockIsChecking = true;
    render(<CreateOrgForm />);

    const submitBtn = screen.getByRole("button", {
      name: "Create Organization",
    });
    expect(submitBtn).toBeDisabled();
  });

  it("should navigate to '/' on cancel when no organizations", async () => {
    mockHasOrganizations = false;
    const user = userEvent.setup();
    render(<CreateOrgForm />);

    await user.click(screen.getByRole("button", { name: "Cancel" }));
    expect(mockPush).toHaveBeenCalledWith("/");
  });

  it("should navigate to '/settings' on cancel when has organizations", async () => {
    mockHasOrganizations = true;
    const user = userEvent.setup();
    render(<CreateOrgForm />);

    await user.click(screen.getByRole("button", { name: "Cancel" }));
    expect(mockPush).toHaveBeenCalledWith("/settings");
  });
});
