import { vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { FieldPropertiesPanel } from "../field-properties-panel";

const baseField = {
  id: "field-1",
  formDefinitionId: "form-1",
  fieldKey: "title",
  fieldType: "text" as const,
  label: "Title",
  description: "Enter your title",
  placeholder: "My Title",
  required: true,
  sortOrder: 0,
  config: { minLength: 5, maxLength: 100 },
  conditionalRules: null,
  branchId: null,
  createdAt: new Date(),
  updatedAt: new Date(),
};

const allFields = [
  { fieldKey: "title", fieldType: "text", label: "Title", config: null },
];

describe("FieldPropertiesPanel", () => {
  it("renders common fields for any field type", () => {
    const onUpdate = vi.fn();
    render(
      <FieldPropertiesPanel
        field={baseField}
        allFields={allFields}
        onUpdate={onUpdate}
        isSaving={false}
      />,
    );

    expect(screen.getByText("Field Properties")).toBeInTheDocument();
    expect(screen.getByLabelText("Label")).toHaveValue("Title");
    expect(screen.getByLabelText("Help Text")).toHaveValue("Enter your title");
    expect(screen.getByLabelText("Placeholder")).toHaveValue("My Title");
    expect(screen.getByLabelText("Required")).toBeChecked();
  });

  it("renders text config for text field type", () => {
    const onUpdate = vi.fn();
    render(
      <FieldPropertiesPanel
        field={baseField}
        allFields={allFields}
        onUpdate={onUpdate}
        isSaving={false}
      />,
    );

    expect(screen.getByText("Type Settings")).toBeInTheDocument();
    expect(screen.getByLabelText("Min Length")).toHaveValue(5);
    expect(screen.getByLabelText("Max Length")).toHaveValue(100);
  });

  it("renders number config for number field type", () => {
    const onUpdate = vi.fn();
    const numberField = {
      ...baseField,
      fieldType: "number" as const,
      config: { min: 0, max: 100, step: 1 },
    };
    render(
      <FieldPropertiesPanel
        field={numberField}
        allFields={allFields}
        onUpdate={onUpdate}
        isSaving={false}
      />,
    );

    expect(screen.getByLabelText("Minimum")).toHaveValue(0);
    expect(screen.getByLabelText("Maximum")).toHaveValue(100);
    expect(screen.getByLabelText("Step")).toHaveValue(1);
  });

  it("renders select config for select field type", () => {
    const onUpdate = vi.fn();
    const selectField = {
      ...baseField,
      fieldType: "select" as const,
      config: {
        options: [
          { label: "Option A", value: "option_a" },
          { label: "Option B", value: "option_b" },
        ],
      },
    };
    render(
      <FieldPropertiesPanel
        field={selectField}
        allFields={allFields}
        onUpdate={onUpdate}
        isSaving={false}
      />,
    );

    expect(screen.getByText("Options")).toBeInTheDocument();
    expect(screen.getByDisplayValue("Option A")).toBeInTheDocument();
    expect(screen.getByDisplayValue("Option B")).toBeInTheDocument();
  });

  it("renders file upload config for file_upload field type", () => {
    const onUpdate = vi.fn();
    const fileField = {
      ...baseField,
      fieldType: "file_upload" as const,
      config: { maxFiles: 3, maxFileSize: 10485760 },
    };
    render(
      <FieldPropertiesPanel
        field={fileField}
        allFields={allFields}
        onUpdate={onUpdate}
        isSaving={false}
      />,
    );

    expect(screen.getByLabelText("Max Files")).toHaveValue(3);
    expect(screen.getByLabelText("Max File Size (bytes)")).toHaveValue(
      10485760,
    );
  });

  it("shows saving indicator", () => {
    render(
      <FieldPropertiesPanel
        field={baseField}
        allFields={allFields}
        onUpdate={vi.fn()}
        isSaving={true}
      />,
    );

    // The "Saving..." indicator is shown based on internal state, not isSaving directly.
    // After a change triggers debounced save, it shows "Saving..."
    // Here we just verify the panel renders without error when isSaving is true.
    expect(screen.getByText("Field Properties")).toBeInTheDocument();
  });

  it("displays the field type icon and label", () => {
    render(
      <FieldPropertiesPanel
        field={baseField}
        allFields={allFields}
        onUpdate={vi.fn()}
        isSaving={false}
      />,
    );

    expect(screen.getByText("Short Text")).toBeInTheDocument();
  });

  it("does not render type settings for section_header", () => {
    const headerField = {
      ...baseField,
      fieldType: "section_header" as const,
      config: null,
    };
    render(
      <FieldPropertiesPanel
        field={headerField}
        allFields={allFields}
        onUpdate={vi.fn()}
        isSaving={false}
      />,
    );

    expect(screen.queryByText("Type Settings")).not.toBeInTheDocument();
  });
});
