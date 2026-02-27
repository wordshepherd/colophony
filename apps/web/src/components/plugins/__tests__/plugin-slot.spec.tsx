import type { ComponentType } from "react";
import { render, screen } from "@testing-library/react";
import { PluginSlot } from "../plugin-slot";
import {
  registerComponent,
  type PluginComponentProps,
} from "@/lib/plugin-components";

// --- Mutable mock state ---
let mockExtensions: {
  point: string;
  id: string;
  label: string;
  component: string;
  order?: number;
}[] = [];
let mockIsLoading = false;
let mockError: Error | null = null;

let mockCurrentOrg: {
  id: string;
  name: string;
  role: string;
} | null = {
  id: "org-1",
  name: "Test Org",
  role: "ADMIN",
};
let mockUser: { id: string; email: string } | null = {
  id: "user-1",
  email: "test@example.com",
};

jest.mock("@/hooks/use-plugin-extensions", () => ({
  usePluginExtensions: () => ({
    extensions: mockExtensions,
    isLoading: mockIsLoading,
    error: mockError,
  }),
}));

jest.mock("@/hooks/use-organization", () => ({
  useOrganization: () => ({ currentOrg: mockCurrentOrg }),
}));

jest.mock("@/hooks/use-auth", () => ({
  useAuth: () => ({ user: mockUser }),
}));

describe("PluginSlot", () => {
  beforeEach(() => {
    mockExtensions = [];
    mockIsLoading = false;
    mockError = null;
    mockCurrentOrg = {
      id: "org-1",
      name: "Test Org",
      role: "ADMIN",
    };
    mockUser = { id: "user-1", email: "test@example.com" };
  });

  it("renders nothing when no extensions", () => {
    const { container } = render(<PluginSlot point="dashboard.widget" />);
    expect(container.innerHTML).toBe("");
  });

  it("renders resolved plugin components", () => {
    const TestWidget = (props: PluginComponentProps) => (
      <div data-testid="test-widget">Widget: {props.extensionId}</div>
    );
    registerComponent("test.render-widget", TestWidget);

    mockExtensions = [
      {
        point: "dashboard.widget",
        id: "render-widget",
        label: "Render Widget",
        component: "test.render-widget",
      },
    ];

    render(<PluginSlot point="dashboard.widget" />);

    expect(screen.getByTestId("test-widget")).toHaveTextContent(
      "Widget: render-widget",
    );
  });

  it("catches errors with error boundary", () => {
    const ErrorWidget = () => {
      throw new Error("Widget crashed");
    };
    registerComponent(
      "test.error-widget",
      ErrorWidget as unknown as ComponentType<PluginComponentProps>,
    );

    mockExtensions = [
      {
        point: "dashboard.widget",
        id: "error-widget",
        label: "Error Widget",
        component: "test.error-widget",
      },
    ];

    // Suppress React error boundary console.error
    const errorSpy = jest.spyOn(console, "error").mockImplementation(() => {});

    render(<PluginSlot point="dashboard.widget" />);

    expect(screen.getByText(/Plugin Error/)).toBeInTheDocument();
    expect(screen.getByText(/Widget crashed/)).toBeInTheDocument();

    errorSpy.mockRestore();
  });

  it("passes context to plugin components", () => {
    const ContextWidget = (props: PluginComponentProps) => (
      <div data-testid="ctx-widget">{JSON.stringify(props.context)}</div>
    );
    registerComponent("test.ctx-widget", ContextWidget);

    mockExtensions = [
      {
        point: "submission.detail.section",
        id: "ctx-ext",
        label: "Ctx",
        component: "test.ctx-widget",
      },
    ];

    render(
      <PluginSlot
        point="submission.detail.section"
        context={{ submissionId: "sub-1" }}
      />,
    );

    expect(screen.getByTestId("ctx-widget")).toHaveTextContent(
      '{"submissionId":"sub-1"}',
    );
  });

  it("renders nothing when no org", () => {
    mockCurrentOrg = null;
    mockExtensions = [
      {
        point: "dashboard.widget",
        id: "any",
        label: "Any",
        component: "test.any",
      },
    ];

    const { container } = render(<PluginSlot point="dashboard.widget" />);
    expect(container.innerHTML).toBe("");
  });

  it("sets data-plugin-slot attribute", () => {
    const SlotWidget = () => <div>Slot</div>;
    registerComponent(
      "test.slot-attr-widget",
      SlotWidget as unknown as ComponentType<PluginComponentProps>,
    );

    mockExtensions = [
      {
        point: "settings.section",
        id: "attr-ext",
        label: "Attr",
        component: "test.slot-attr-widget",
      },
    ];

    const { container } = render(<PluginSlot point="settings.section" />);

    const slot = container.querySelector(
      "[data-plugin-slot='settings.section']",
    );
    expect(slot).not.toBeNull();
  });
});
