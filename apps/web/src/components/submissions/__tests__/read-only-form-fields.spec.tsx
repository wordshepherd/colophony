import { vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { ReadOnlyFormFields } from "../form-renderer/read-only-form-fields";

// --- Mutable mock state ---
let mockFormDefinition: Record<string, unknown> | null;
let mockIsPending: boolean;
let mockError: { message: string } | null;

function resetMocks() {
  mockFormDefinition = null;
  mockIsPending = false;
  mockError = null;
}

vi.mock("@/lib/trpc", () => ({
  trpc: {
    forms: {
      getById: {
        useQuery: () => ({
          data: mockFormDefinition,
          isPending: mockIsPending,
          error: mockError,
        }),
      },
    },
  },
}));

// Mock useConditionalFields — by default, all fields visible
let mockVisibilityOverride: Map<
  string,
  { visible: boolean; required: boolean }
> | null = null;

vi.mock("@/hooks/use-conditional-fields", () => ({
  useConditionalFields: (
    fields: Array<{ fieldKey: string }>,
    _formValues: Record<string, unknown>,
  ) => {
    if (mockVisibilityOverride) return mockVisibilityOverride;
    const map = new Map<string, { visible: boolean; required: boolean }>();
    for (const f of fields) {
      map.set(f.fieldKey, { visible: true, required: false });
    }
    return map;
  },
}));

beforeEach(() => {
  resetMocks();
  mockVisibilityOverride = null;
});

function makeField(overrides: Record<string, unknown>) {
  return {
    fieldKey: "field1",
    fieldType: "text",
    label: "Field One",
    description: null,
    placeholder: null,
    required: false,
    config: null,
    conditionalRules: null,
    sortOrder: 0,
    ...overrides,
  };
}

describe("ReadOnlyFormFields", () => {
  it("renders form field labels and values", () => {
    mockFormDefinition = {
      name: "Poetry Submission Form",
      description: "Fields for poetry submissions",
      fields: [
        makeField({
          fieldKey: "category",
          fieldType: "select",
          label: "Category",
          sortOrder: 0,
          config: {
            options: [
              { label: "Poetry", value: "poetry" },
              { label: "Fiction", value: "fiction" },
            ],
          },
        }),
        makeField({
          fieldKey: "word_count",
          fieldType: "number",
          label: "Word Count",
          sortOrder: 1,
        }),
      ],
    };

    render(
      <ReadOnlyFormFields
        formDefinitionId="form-1"
        formData={{ category: "poetry", word_count: 250 }}
      />,
    );

    expect(screen.getByText("Poetry Submission Form")).toBeInTheDocument();
    expect(screen.getByText("Category")).toBeInTheDocument();
    expect(screen.getByText("Poetry")).toBeInTheDocument();
    expect(screen.getByText("Word Count")).toBeInTheDocument();
    expect(screen.getByText("250")).toBeInTheDocument();
  });

  it("shows 'Not provided' for missing values", () => {
    mockFormDefinition = {
      name: "Test Form",
      description: null,
      fields: [
        makeField({
          fieldKey: "bio",
          fieldType: "textarea",
          label: "Bio",
          sortOrder: 0,
        }),
        makeField({
          fieldKey: "website",
          fieldType: "url",
          label: "Website",
          sortOrder: 1,
        }),
      ],
    };

    render(<ReadOnlyFormFields formDefinitionId="form-1" formData={{}} />);

    const notProvided = screen.getAllByText("Not provided");
    expect(notProvided).toHaveLength(2);
  });

  it("respects conditional visibility", () => {
    mockFormDefinition = {
      name: "Conditional Form",
      description: null,
      fields: [
        makeField({
          fieldKey: "type",
          fieldType: "select",
          label: "Submission Type",
          sortOrder: 0,
          config: {
            options: [
              { label: "Poetry", value: "poetry" },
              { label: "Fiction", value: "fiction" },
            ],
          },
        }),
        makeField({
          fieldKey: "stanza_count",
          fieldType: "number",
          label: "Stanza Count",
          sortOrder: 1,
          conditionalRules: [
            {
              action: "HIDE",
              conditions: [
                { fieldKey: "type", operator: "NOT_EQUALS", value: "poetry" },
              ],
              logicalOperator: "AND",
            },
          ],
        }),
      ],
    };

    // Override visibility: hide stanza_count
    mockVisibilityOverride = new Map([
      ["type", { visible: true, required: false }],
      ["stanza_count", { visible: false, required: false }],
    ]);

    render(
      <ReadOnlyFormFields
        formDefinitionId="form-1"
        formData={{ type: "fiction" }}
      />,
    );

    expect(screen.getByText("Submission Type")).toBeInTheDocument();
    expect(screen.queryByText("Stanza Count")).not.toBeInTheDocument();
  });

  it("renders section_header and info_text presentational fields", () => {
    mockFormDefinition = {
      name: "Form With Sections",
      description: null,
      fields: [
        makeField({
          fieldKey: "section1",
          fieldType: "section_header",
          label: "About You",
          description: "Tell us about yourself",
          sortOrder: 0,
        }),
        makeField({
          fieldKey: "info1",
          fieldType: "info_text",
          label: "Note",
          description: "All fields are optional.",
          sortOrder: 1,
        }),
      ],
    };

    render(<ReadOnlyFormFields formDefinitionId="form-1" formData={{}} />);

    expect(screen.getByText("About You")).toBeInTheDocument();
    expect(screen.getByText("Tell us about yourself")).toBeInTheDocument();
    expect(screen.getByText("All fields are optional.")).toBeInTheDocument();
  });

  it("skips file_upload fields", () => {
    mockFormDefinition = {
      name: "Upload Form",
      description: null,
      fields: [
        makeField({
          fieldKey: "manuscript",
          fieldType: "file_upload",
          label: "Manuscript Upload",
          sortOrder: 0,
        }),
        makeField({
          fieldKey: "notes",
          fieldType: "text",
          label: "Notes",
          sortOrder: 1,
        }),
      ],
    };

    render(
      <ReadOnlyFormFields
        formDefinitionId="form-1"
        formData={{ notes: "Some notes" }}
      />,
    );

    expect(screen.queryByText("Manuscript Upload")).not.toBeInTheDocument();
    expect(screen.getByText("Notes")).toBeInTheDocument();
    expect(screen.getByText("Some notes")).toBeInTheDocument();
  });
});
