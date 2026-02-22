import "../../../../../test/setup";
import { getPageFieldPaths } from "../build-page-schema";
import type { FormFieldForRenderer } from "../build-form-schema";

function makeField(
  overrides: Partial<FormFieldForRenderer> & {
    fieldKey: string;
    fieldType: string;
  },
): FormFieldForRenderer {
  return {
    label: overrides.fieldKey,
    description: null,
    placeholder: null,
    required: false,
    config: null,
    ...overrides,
  };
}

describe("getPageFieldPaths", () => {
  it("returns formData-prefixed paths for validatable fields", () => {
    const fields = [
      makeField({ fieldKey: "name", fieldType: "text" }),
      makeField({ fieldKey: "bio", fieldType: "textarea" }),
      makeField({ fieldKey: "age", fieldType: "number" }),
    ];

    const paths = getPageFieldPaths(fields);
    expect(paths).toEqual(["formData.name", "formData.bio", "formData.age"]);
  });

  it("excludes presentational field types (section_header, info_text)", () => {
    const fields = [
      makeField({ fieldKey: "name", fieldType: "text" }),
      makeField({ fieldKey: "header_1", fieldType: "section_header" }),
      makeField({ fieldKey: "info_1", fieldType: "info_text" }),
    ];

    const paths = getPageFieldPaths(fields);
    expect(paths).toEqual(["formData.name"]);
  });

  it("excludes file_upload fields", () => {
    const fields = [
      makeField({ fieldKey: "name", fieldType: "text" }),
      makeField({ fieldKey: "resume", fieldType: "file_upload" }),
    ];

    const paths = getPageFieldPaths(fields);
    expect(paths).toEqual(["formData.name"]);
  });
});
