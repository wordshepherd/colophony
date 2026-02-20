import React from "react";
import { render, screen } from "@testing-library/react";
import { FormEditor } from "../form-editor";
import "../../../../test/setup";

// --- Mutable mock state ---
let mockForm: Record<string, unknown> | undefined;
let mockIsLoading: boolean;
let mockError: { message: string } | null;
let mockSelectedFieldId: string | null;
let mockIsPreviewMode: boolean;
let mockAddField: jest.Mock;
let mockSetSelectedFieldId: jest.Mock;
let mockTogglePreview: jest.Mock;
let mockPublishMutate: jest.Mock;
let mockRemoveFieldMutate: jest.Mock;
let mockReorderFieldsMutate: jest.Mock;
let mockUpdateFieldMutate: jest.Mock;

function resetMocks() {
  mockIsLoading = false;
  mockError = null;
  mockSelectedFieldId = null;
  mockIsPreviewMode = false;
  mockAddField = jest.fn();
  mockSetSelectedFieldId = jest.fn();
  mockTogglePreview = jest.fn();
  mockPublishMutate = jest.fn();
  mockRemoveFieldMutate = jest.fn();
  mockReorderFieldsMutate = jest.fn();
  mockUpdateFieldMutate = jest.fn();
  mockForm = {
    id: "form-1",
    name: "Test Form",
    description: "A test form",
    status: "DRAFT",
    version: 1,
    fields: [
      {
        id: "field-1",
        formDefinitionId: "form-1",
        fieldKey: "title",
        fieldType: "text",
        label: "Title",
        description: null,
        placeholder: null,
        required: true,
        sortOrder: 0,
        config: null,
        conditionalRules: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        id: "field-2",
        formDefinitionId: "form-1",
        fieldKey: "bio",
        fieldType: "textarea",
        label: "Bio",
        description: "Tell us about yourself",
        placeholder: null,
        required: false,
        sortOrder: 1,
        config: null,
        conditionalRules: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ],
    organizationId: "org-1",
    duplicatedFromId: null,
    createdBy: "user-1",
    publishedAt: null,
    archivedAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  };
}

jest.mock("@/hooks/use-form-builder", () => ({
  useFormBuilder: () => ({
    form: mockForm,
    isLoading: mockIsLoading,
    error: mockError,
    selectedFieldId: mockSelectedFieldId,
    setSelectedFieldId: mockSetSelectedFieldId,
    isPreviewMode: mockIsPreviewMode,
    togglePreview: mockTogglePreview,
    addField: mockAddField,
    updateForm: { mutate: jest.fn(), isPending: false },
    publishForm: { mutate: mockPublishMutate, isPending: false },
    archiveForm: { mutate: jest.fn(), isPending: false },
    duplicateForm: { mutate: jest.fn(), isPending: false },
    deleteForm: { mutate: jest.fn(), isPending: false },
    updateField: { mutate: mockUpdateFieldMutate, isPending: false },
    removeField: { mutate: mockRemoveFieldMutate, isPending: false },
    reorderFields: { mutate: mockReorderFieldsMutate, isPending: false },
  }),
}));

jest.mock("sonner", () => ({
  toast: { success: jest.fn(), error: jest.fn() },
}));

describe("FormEditor", () => {
  beforeEach(() => {
    resetMocks();
  });

  it("renders 3-column layout with palette, canvas, and properties", () => {
    render(<FormEditor formId="form-1" />);
    expect(screen.getByText("Add Field")).toBeInTheDocument();
    expect(screen.getByText("Title")).toBeInTheDocument();
    expect(screen.getByText("Bio")).toBeInTheDocument();
    expect(
      screen.getByText("Select a field to edit its properties"),
    ).toBeInTheDocument();
  });

  it("renders form name and status in header", () => {
    render(<FormEditor formId="form-1" />);
    expect(screen.getByText("Test Form")).toBeInTheDocument();
    expect(screen.getByText("Draft")).toBeInTheDocument();
  });

  it("renders loading skeleton when loading", () => {
    mockIsLoading = true;
    mockForm = undefined;
    render(<FormEditor formId="form-1" />);
    expect(screen.queryByText("Add Field")).not.toBeInTheDocument();
  });

  it("renders error state when form not found", () => {
    mockForm = undefined;
    mockError = { message: "Not found" };
    render(<FormEditor formId="form-1" />);
    expect(screen.getByText("Not found")).toBeInTheDocument();
    expect(screen.getByText("Back to Forms")).toBeInTheDocument();
  });

  it("shows publish button for draft forms", () => {
    render(<FormEditor formId="form-1" />);
    expect(screen.getByText("Publish")).toBeInTheDocument();
  });

  it("shows read-only notice for published forms", () => {
    mockForm = { ...mockForm, status: "PUBLISHED" };
    render(<FormEditor formId="form-1" />);
    expect(
      screen.getByText(/This form is published and cannot be edited/),
    ).toBeInTheDocument();
  });

  it("renders preview toggle button", () => {
    render(<FormEditor formId="form-1" />);
    expect(screen.getByText("Preview")).toBeInTheDocument();
  });

  it("renders palette field types", () => {
    render(<FormEditor formId="form-1" />);
    // Palette has the field type buttons — "Short Text" may appear in both palette and canvas
    expect(screen.getAllByText("Short Text").length).toBeGreaterThanOrEqual(1);
    // These only appear in the palette (not used in the mock fields)
    expect(screen.getByText("Dropdown")).toBeInTheDocument();
    expect(screen.getByText("File Upload")).toBeInTheDocument();
  });

  it("shows properties panel when field is selected", () => {
    mockSelectedFieldId = "field-1";
    render(<FormEditor formId="form-1" />);
    expect(screen.getByText("Field Properties")).toBeInTheDocument();
  });
});
