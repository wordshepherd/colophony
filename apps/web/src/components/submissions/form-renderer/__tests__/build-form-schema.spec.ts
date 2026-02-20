import {
  buildFormFieldsSchema,
  type FormFieldForRenderer,
} from "../build-form-schema";

function makeField(
  overrides: Partial<FormFieldForRenderer> & {
    fieldKey: string;
    fieldType: string;
  },
): FormFieldForRenderer {
  return {
    label: "Test Field",
    description: null,
    placeholder: null,
    required: false,
    config: null,
    ...overrides,
  };
}

describe("buildFormFieldsSchema", () => {
  it("required text field with minLength/maxLength", () => {
    const { schema } = buildFormFieldsSchema([
      makeField({
        fieldKey: "bio",
        fieldType: "text",
        label: "Bio",
        required: true,
        config: { minLength: 5, maxLength: 100 },
      }),
    ]);

    expect(schema.safeParse({ bio: "" }).success).toBe(false);
    expect(schema.safeParse({ bio: "abc" }).success).toBe(false);
    expect(schema.safeParse({ bio: "hello world" }).success).toBe(true);
  });

  it("optional text field accepts empty string", () => {
    const { schema } = buildFormFieldsSchema([
      makeField({ fieldKey: "bio", fieldType: "text", required: false }),
    ]);

    expect(schema.safeParse({ bio: "" }).success).toBe(true);
    expect(schema.safeParse({ bio: undefined }).success).toBe(true);
    expect(schema.safeParse({}).success).toBe(true);
  });

  it("email field validates email format", () => {
    const { schema } = buildFormFieldsSchema([
      makeField({
        fieldKey: "email",
        fieldType: "email",
        label: "Email",
        required: true,
      }),
    ]);

    expect(schema.safeParse({ email: "not-an-email" }).success).toBe(false);
    expect(schema.safeParse({ email: "test@example.com" }).success).toBe(true);
  });

  it("url field validates URL format", () => {
    const { schema } = buildFormFieldsSchema([
      makeField({
        fieldKey: "website",
        fieldType: "url",
        label: "Website",
        required: true,
      }),
    ]);

    expect(schema.safeParse({ website: "not-a-url" }).success).toBe(false);
    expect(schema.safeParse({ website: "https://example.com" }).success).toBe(
      true,
    );
  });

  it("date field validates YYYY-MM-DD", () => {
    const { schema } = buildFormFieldsSchema([
      makeField({
        fieldKey: "dob",
        fieldType: "date",
        label: "Date",
        required: true,
      }),
    ]);

    expect(schema.safeParse({ dob: "Jan 1" }).success).toBe(false);
    expect(schema.safeParse({ dob: "2026-01-15" }).success).toBe(true);
  });

  it("number field with min/max", () => {
    const { schema } = buildFormFieldsSchema([
      makeField({
        fieldKey: "age",
        fieldType: "number",
        label: "Age",
        required: true,
        config: { min: 0, max: 100 },
      }),
    ]);

    expect(schema.safeParse({ age: -1 }).success).toBe(false);
    expect(schema.safeParse({ age: 101 }).success).toBe(false);
    expect(schema.safeParse({ age: 50 }).success).toBe(true);
  });

  it("required number field rejects empty string (not coerced to 0)", () => {
    const { schema } = buildFormFieldsSchema([
      makeField({
        fieldKey: "count",
        fieldType: "number",
        label: "Count",
        required: true,
      }),
    ]);

    // Empty string should NOT coerce to 0 and pass — it should fail
    expect(schema.safeParse({ count: "" }).success).toBe(false);
    expect(schema.safeParse({ count: undefined }).success).toBe(false);
    // Actual numbers should work
    expect(schema.safeParse({ count: 0 }).success).toBe(true);
    expect(schema.safeParse({ count: 42 }).success).toBe(true);
  });

  it("select field validates against options", () => {
    const { schema } = buildFormFieldsSchema([
      makeField({
        fieldKey: "genre",
        fieldType: "select",
        label: "Genre",
        required: true,
        config: {
          options: [
            { label: "A", value: "a" },
            { label: "B", value: "b" },
          ],
        },
      }),
    ]);

    expect(schema.safeParse({ genre: "c" }).success).toBe(false);
    expect(schema.safeParse({ genre: "a" }).success).toBe(true);
  });

  it("multi_select as string array", () => {
    const { schema } = buildFormFieldsSchema([
      makeField({
        fieldKey: "tags",
        fieldType: "multi_select",
        label: "Tags",
        required: false,
        config: {
          options: [
            { label: "A", value: "a" },
            { label: "B", value: "b" },
            { label: "C", value: "c" },
          ],
        },
      }),
    ]);

    // Non-array should fail
    expect(schema.safeParse({ tags: "a" }).success).toBe(false);
    expect(schema.safeParse({ tags: ["a", "b"] }).success).toBe(true);
  });

  it("checkbox as boolean", () => {
    const { schema } = buildFormFieldsSchema([
      makeField({
        fieldKey: "agree",
        fieldType: "checkbox",
        label: "Agree",
        required: true,
      }),
    ]);

    // Backend required check only rejects undefined/null/"", not false
    expect(schema.safeParse({ agree: undefined }).success).toBe(false);
    expect(schema.safeParse({ agree: true }).success).toBe(true);
    expect(schema.safeParse({ agree: false }).success).toBe(true);
  });

  it("skips presentational fields", () => {
    const { schema, defaultValues } = buildFormFieldsSchema([
      makeField({
        fieldKey: "header_1",
        fieldType: "section_header",
        label: "Section",
      }),
      makeField({
        fieldKey: "info_1",
        fieldType: "info_text",
        label: "Info",
      }),
    ]);

    expect(Object.keys(schema.shape)).toHaveLength(0);
    expect(Object.keys(defaultValues)).toHaveLength(0);
  });

  it("skips file_upload", () => {
    const { schema, defaultValues } = buildFormFieldsSchema([
      makeField({
        fieldKey: "upload",
        fieldType: "file_upload",
        label: "Upload",
      }),
    ]);

    expect(Object.keys(schema.shape)).toHaveLength(0);
    expect(Object.keys(defaultValues)).toHaveLength(0);
  });

  it("returns correct default values", () => {
    const { defaultValues } = buildFormFieldsSchema([
      makeField({ fieldKey: "name", fieldType: "text" }),
      makeField({ fieldKey: "agree", fieldType: "checkbox" }),
      makeField({
        fieldKey: "tags",
        fieldType: "multi_select",
        config: { options: [{ label: "A", value: "a" }] },
      }),
      makeField({ fieldKey: "age", fieldType: "number" }),
    ]);

    expect(defaultValues).toEqual({
      name: "",
      agree: false,
      tags: [],
      age: undefined,
    });
  });

  it("rich_text only supports maxLength (no minLength)", () => {
    const { schema } = buildFormFieldsSchema([
      makeField({
        fieldKey: "body",
        fieldType: "rich_text",
        label: "Body",
        required: true,
        config: { maxLength: 500 },
      }),
    ]);

    // Short string should pass (no minLength from config)
    expect(schema.safeParse({ body: "hi" }).success).toBe(true);
    // Over maxLength should fail
    expect(schema.safeParse({ body: "x".repeat(501) }).success).toBe(false);
    // Empty required should fail
    expect(schema.safeParse({ body: "" }).success).toBe(false);
  });

  it("radio field validates against options", () => {
    const { schema } = buildFormFieldsSchema([
      makeField({
        fieldKey: "color",
        fieldType: "radio",
        label: "Color",
        required: true,
        config: {
          options: [
            { label: "Red", value: "red" },
            { label: "Blue", value: "blue" },
          ],
        },
      }),
    ]);

    expect(schema.safeParse({ color: "green" }).success).toBe(false);
    expect(schema.safeParse({ color: "red" }).success).toBe(true);
  });

  it("optional number field converts empty string to undefined", () => {
    const { schema } = buildFormFieldsSchema([
      makeField({
        fieldKey: "count",
        fieldType: "number",
        label: "Count",
        required: false,
      }),
    ]);

    expect(schema.safeParse({ count: "" }).success).toBe(true);
    expect(schema.safeParse({ count: undefined }).success).toBe(true);
    expect(schema.safeParse({ count: 42 }).success).toBe(true);
  });
});
