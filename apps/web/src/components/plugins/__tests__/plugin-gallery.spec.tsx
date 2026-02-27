import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { PluginGallery } from "../plugin-gallery";

// --- Mutable mock state ---
type MockPlugin = {
  id: string;
  name: string;
  description: string;
  author: string;
  category: string;
  version: string;
  installed: boolean;
  verified?: boolean;
  tags?: string[];
  npmPackage: string;
  license: string;
  colophonyVersion: string;
};

let mockPlugins: MockPlugin[] = [];
let mockIsLoading = false;
let mockError: Error | null = null;
const mockRefetch = jest.fn();

jest.mock("@/hooks/use-plugin-registry", () => ({
  usePluginRegistry: () => ({
    plugins: mockPlugins,
    isLoading: mockIsLoading,
    error: mockError,
    refetch: mockRefetch,
  }),
  usePluginRegistryEntry: () => ({
    plugin: null,
    isLoading: false,
    error: null,
  }),
}));

function makePlugin(id: string, overrides?: Partial<MockPlugin>): MockPlugin {
  return {
    id,
    name: `Plugin ${id}`,
    description: `Description for ${id}`,
    author: "Test Author",
    category: "adapter",
    version: "1.0.0",
    installed: false,
    npmPackage: `@colophony/plugin-${id}`,
    license: "MIT",
    colophonyVersion: "2.0.0",
    ...overrides,
  };
}

describe("PluginGallery", () => {
  beforeEach(() => {
    mockPlugins = [];
    mockIsLoading = false;
    mockError = null;
  });

  it("renders loading skeletons", () => {
    mockIsLoading = true;
    const { container } = render(<PluginGallery />);
    // Skeleton cards use animate-pulse class
    const skeletons = container.querySelectorAll(".animate-pulse");
    expect(skeletons.length).toBeGreaterThanOrEqual(1);
  });

  it("renders plugin cards", () => {
    mockPlugins = [
      makePlugin("alpha"),
      makePlugin("beta"),
      makePlugin("gamma"),
    ];
    render(<PluginGallery />);
    expect(screen.getByText("Plugin alpha")).toBeInTheDocument();
    expect(screen.getByText("Plugin beta")).toBeInTheDocument();
    expect(screen.getByText("Plugin gamma")).toBeInTheDocument();
  });

  it("filters by search text", async () => {
    const user = userEvent.setup();
    mockPlugins = [
      makePlugin("email-adapter", { name: "Email Adapter" }),
      makePlugin("storage-adapter", { name: "Storage Adapter" }),
    ];
    render(<PluginGallery />);

    const searchInput = screen.getByPlaceholderText("Search plugins...");
    await user.type(searchInput, "Email");

    expect(screen.getByText("Email Adapter")).toBeInTheDocument();
    expect(screen.queryByText("Storage Adapter")).not.toBeInTheDocument();
  });

  it("filters by category tab", async () => {
    const user = userEvent.setup();
    mockPlugins = [
      makePlugin("adapter-plugin", {
        name: "My Adapter",
        category: "adapter",
      }),
      makePlugin("workflow-plugin", {
        name: "My Workflow",
        category: "workflow",
      }),
    ];
    render(<PluginGallery />);

    const workflowTab = screen.getByRole("tab", { name: "Workflow" });
    await user.click(workflowTab);

    expect(screen.getByText("My Workflow")).toBeInTheDocument();
    expect(screen.queryByText("My Adapter")).not.toBeInTheDocument();
  });

  it("opens detail dialog on card click", async () => {
    const user = userEvent.setup();
    mockPlugins = [makePlugin("clickable", { name: "Clickable Plugin" })];
    render(<PluginGallery />);

    const card = screen.getByText("Clickable Plugin");
    await user.click(card);

    // Dialog should open (DialogContent renders with role="dialog")
    expect(screen.getByRole("dialog")).toBeInTheDocument();
  });

  it("renders empty state", () => {
    mockPlugins = [];
    render(<PluginGallery />);
    expect(screen.getByText("No plugins found.")).toBeInTheDocument();
  });
});
