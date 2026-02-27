import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { PluginDetailDialog } from "../plugin-detail-dialog";

// --- Mutable mock state ---
type MockRegistryEntry = {
  id: string;
  name: string;
  description: string;
  author: string;
  category: string;
  version: string;
  installed: boolean;
  verified?: boolean;
  npmPackage: string;
  license: string;
  colophonyVersion: string;
  installCommand?: string;
  configExample?: string;
  permissions?: string[];
  repository?: string;
  homepage?: string;
  readme?: string;
};

let mockPlugin: MockRegistryEntry | null = null;
let mockIsLoading = false;

jest.mock("@/hooks/use-plugin-registry", () => ({
  usePluginRegistryEntry: () => ({
    plugin: mockPlugin,
    isLoading: mockIsLoading,
    error: null,
  }),
}));

function makeEntry(overrides?: Partial<MockRegistryEntry>): MockRegistryEntry {
  return {
    id: "test-plugin",
    name: "Test Plugin",
    description: "A test plugin description.",
    author: "Test Author",
    category: "adapter",
    version: "1.2.3",
    installed: false,
    npmPackage: "@colophony/plugin-test",
    license: "MIT",
    colophonyVersion: "2.0.0",
    ...overrides,
  };
}

describe("PluginDetailDialog", () => {
  const onOpenChange = jest.fn();

  beforeEach(() => {
    mockPlugin = null;
    mockIsLoading = false;
    onOpenChange.mockClear();
  });

  it("renders plugin details", () => {
    mockPlugin = makeEntry({
      name: "My Plugin",
      version: "3.0.0",
      description: "Full description here.",
    });
    render(
      <PluginDetailDialog
        pluginId="test-plugin"
        open={true}
        onOpenChange={onOpenChange}
      />,
    );

    expect(screen.getByText("My Plugin")).toBeInTheDocument();
    expect(screen.getByText("v3.0.0")).toBeInTheDocument();
    expect(screen.getByText("Full description here.")).toBeInTheDocument();
  });

  it("shows install section when not installed", () => {
    mockPlugin = makeEntry({
      installed: false,
      installCommand: "pnpm add @colophony/plugin-test",
    });
    render(
      <PluginDetailDialog
        pluginId="test-plugin"
        open={true}
        onOpenChange={onOpenChange}
      />,
    );

    expect(screen.getByText("Install")).toBeInTheDocument();
    expect(
      screen.getByText("pnpm add @colophony/plugin-test"),
    ).toBeInTheDocument();
  });

  it("hides install section when installed", () => {
    mockPlugin = makeEntry({
      installed: true,
      installCommand: "pnpm add @colophony/plugin-test",
    });
    render(
      <PluginDetailDialog
        pluginId="test-plugin"
        open={true}
        onOpenChange={onOpenChange}
      />,
    );

    expect(screen.getByText("Installed")).toBeInTheDocument();
    expect(screen.queryByText("Install")).not.toBeInTheDocument();
  });

  it("copy button copies to clipboard", async () => {
    const user = userEvent.setup();
    const writeText = jest.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "clipboard", {
      value: { writeText },
      writable: true,
      configurable: true,
    });

    mockPlugin = makeEntry({
      installed: false,
      installCommand: "pnpm add @colophony/plugin-test",
    });
    render(
      <PluginDetailDialog
        pluginId="test-plugin"
        open={true}
        onOpenChange={onOpenChange}
      />,
    );

    // Find the copy button next to install command
    const installSection = screen.getByText("Install").parentElement!;
    const copyButton = installSection.querySelector("button")!;
    await user.click(copyButton);

    expect(writeText).toHaveBeenCalledWith("pnpm add @colophony/plugin-test");
  });

  it("renders permission badges", () => {
    mockPlugin = makeEntry({
      permissions: ["email:send", "http:outbound", "storage:read"],
    });
    render(
      <PluginDetailDialog
        pluginId="test-plugin"
        open={true}
        onOpenChange={onOpenChange}
      />,
    );

    expect(screen.getByText("Permissions")).toBeInTheDocument();
    expect(screen.getByText("email:send")).toBeInTheDocument();
    expect(screen.getByText("http:outbound")).toBeInTheDocument();
    expect(screen.getByText("storage:read")).toBeInTheDocument();
  });
});
