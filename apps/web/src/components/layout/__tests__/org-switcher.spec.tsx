import { vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { OrgSwitcher } from "../org-switcher";

// --- Mutable mock state ---
let mockCurrentOrg: {
  id: string;
  name: string;
  slug: string;
  roles: string[];
} | null;
let mockOrganizations: Array<{
  id: string;
  name: string;
  slug: string;
  roles: string[];
}>;
const mockSwitchOrganization = vi.fn();
let mockIsAdmin = false;

vi.mock("@/hooks/use-organization", () => ({
  useOrganization: () => ({
    currentOrg: mockCurrentOrg,
    organizations: mockOrganizations,
    switchOrganization: mockSwitchOrganization,
    isAdmin: mockIsAdmin,
  }),
}));

const orgs = [
  { id: "org-1", name: "Org One", slug: "org-one", roles: ["ADMIN"] },
  { id: "org-2", name: "Org Two", slug: "org-two", roles: ["EDITOR"] },
  { id: "org-3", name: "Org Three", slug: "org-three", roles: ["READER"] },
];

describe("OrgSwitcher", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockCurrentOrg = orgs[0];
    mockOrganizations = orgs;
    mockIsAdmin = false;
  });

  it("should return null for empty organizations", () => {
    mockOrganizations = [];
    const { container } = render(<OrgSwitcher />);
    expect(container.innerHTML).toBe("");
  });

  it("should render current org name", () => {
    render(<OrgSwitcher />);
    expect(screen.getByText("Org One")).toBeInTheDocument();
  });

  it("should show 'Select organization' when no current org", () => {
    mockCurrentOrg = null;
    render(<OrgSwitcher />);
    expect(screen.getByText("Select organization")).toBeInTheDocument();
  });

  it("should list all orgs with role badges in dropdown", async () => {
    const user = userEvent.setup();
    render(<OrgSwitcher />);

    await user.click(screen.getByRole("button"));

    // Org One appears twice: once in trigger, once in dropdown
    expect(screen.getAllByText("Org One")).toHaveLength(2);
    expect(screen.getByText("Org Two")).toBeInTheDocument();
    expect(screen.getByText("Org Three")).toBeInTheDocument();
    expect(screen.getByText("admin")).toBeInTheDocument();
    expect(screen.getByText("editor")).toBeInTheDocument();
    expect(screen.getByText("reader")).toBeInTheDocument();
  });

  it("should call switchOrganization on org click", async () => {
    const user = userEvent.setup();
    render(<OrgSwitcher />);

    await user.click(screen.getByRole("button"));
    await user.click(screen.getByText("Org Two"));

    expect(mockSwitchOrganization).toHaveBeenCalledWith("org-2");
  });

  it("should not show Org Settings link when not admin", async () => {
    const user = userEvent.setup();
    mockIsAdmin = false;
    render(<OrgSwitcher />);

    await user.click(screen.getByRole("button"));
    expect(screen.queryByText("Org Settings")).not.toBeInTheDocument();
  });

  it("should show Org Settings link when admin", async () => {
    const user = userEvent.setup();
    mockIsAdmin = true;
    render(<OrgSwitcher />);

    await user.click(screen.getByRole("button"));
    expect(screen.getByText("Org Settings")).toBeInTheDocument();
  });

  it("should always show Create Organization link", async () => {
    const user = userEvent.setup();
    render(<OrgSwitcher />);

    await user.click(screen.getByRole("button"));
    const createLink = screen.getByText("Create Organization").closest("a");
    expect(createLink).toHaveAttribute("href", "/organizations/new");
  });
});
