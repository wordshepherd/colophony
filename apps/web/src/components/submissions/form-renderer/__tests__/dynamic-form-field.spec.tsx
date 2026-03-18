import { render, screen } from "@testing-library/react";
import { useForm, FormProvider } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { DynamicFormField } from "../dynamic-form-field";
import type { FormFieldForRenderer } from "../build-form-schema";

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

// Wrapper that provides FormProvider context with a formData schema
function FormWrapper({
  children,
  schema,
  defaultValues,
}: {
  children: React.ReactNode;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  schema?: z.ZodObject<any>;
  defaultValues?: Record<string, unknown>;
}) {
  const formSchema = z.object({
    formData: schema ?? z.object({}),
  });
  const form = useForm({
    resolver: zodResolver(formSchema),
    defaultValues: {
      formData: defaultValues ?? {},
    },
  });

  return <FormProvider {...form}>{children}</FormProvider>;
}

describe("DynamicFormField", () => {
  it("renders text input with label and required asterisk", () => {
    const field = makeField({
      fieldKey: "name",
      fieldType: "text",
      label: "Full Name",
      required: true,
      placeholder: "Enter name",
    });

    render(
      <FormWrapper
        schema={z.object({ name: z.string() })}
        defaultValues={{ name: "" }}
      >
        <DynamicFormField field={field} disabled={false} />
      </FormWrapper>,
    );

    expect(screen.getByText("Full Name")).toBeInTheDocument();
    expect(screen.getByText("*")).toBeInTheDocument();
    expect(screen.getByPlaceholderText("Enter name")).toBeInTheDocument();
  });

  it("renders textarea for textarea type", () => {
    const field = makeField({
      fieldKey: "bio",
      fieldType: "textarea",
      label: "Biography",
    });

    render(
      <FormWrapper
        schema={z.object({ bio: z.string() })}
        defaultValues={{ bio: "" }}
      >
        <DynamicFormField field={field} disabled={false} />
      </FormWrapper>,
    );

    expect(screen.getByText("Biography")).toBeInTheDocument();
    const textarea = document.querySelector("textarea");
    expect(textarea).toBeInTheDocument();
  });

  it("renders select with options", () => {
    const field = makeField({
      fieldKey: "genre",
      fieldType: "select",
      label: "Genre",
      config: {
        options: [
          { label: "Fiction", value: "fiction" },
          { label: "Poetry", value: "poetry" },
          { label: "Nonfiction", value: "nonfiction" },
        ],
      },
    });

    render(
      <FormWrapper
        schema={z.object({ genre: z.string().optional() })}
        defaultValues={{ genre: "" }}
      >
        <DynamicFormField field={field} disabled={false} />
      </FormWrapper>,
    );

    expect(screen.getByText("Genre")).toBeInTheDocument();
    // Select trigger should be present
    expect(screen.getByRole("combobox")).toBeInTheDocument();
  });

  it("renders radio group with options", () => {
    const field = makeField({
      fieldKey: "color",
      fieldType: "radio",
      label: "Favorite Color",
      config: {
        options: [
          { label: "Red", value: "red" },
          { label: "Blue", value: "blue" },
          { label: "Green", value: "green" },
        ],
      },
    });

    render(
      <FormWrapper
        schema={z.object({ color: z.string().optional() })}
        defaultValues={{ color: "" }}
      >
        <DynamicFormField field={field} disabled={false} />
      </FormWrapper>,
    );

    expect(screen.getByText("Favorite Color")).toBeInTheDocument();
    expect(screen.getByRole("radiogroup")).toBeInTheDocument();
    expect(screen.getByText("Red")).toBeInTheDocument();
    expect(screen.getByText("Blue")).toBeInTheDocument();
    expect(screen.getByText("Green")).toBeInTheDocument();
  });

  it("renders checkbox", () => {
    const field = makeField({
      fieldKey: "agree",
      fieldType: "checkbox",
      label: "I agree to the terms",
    });

    render(
      <FormWrapper
        schema={z.object({ agree: z.boolean() })}
        defaultValues={{ agree: false }}
      >
        <DynamicFormField field={field} disabled={false} />
      </FormWrapper>,
    );

    expect(screen.getByText("I agree to the terms")).toBeInTheDocument();
    expect(screen.getByRole("checkbox")).toBeInTheDocument();
  });

  it("renders checkbox group for multi_select", () => {
    const field = makeField({
      fieldKey: "tags",
      fieldType: "multi_select",
      label: "Tags",
      config: {
        options: [
          { label: "Tag A", value: "a" },
          { label: "Tag B", value: "b" },
        ],
      },
    });

    render(
      <FormWrapper
        schema={z.object({ tags: z.array(z.string()) })}
        defaultValues={{ tags: [] }}
      >
        <DynamicFormField field={field} disabled={false} />
      </FormWrapper>,
    );

    expect(screen.getByText("Tags")).toBeInTheDocument();
    const checkboxes = screen.getAllByRole("checkbox");
    expect(checkboxes).toHaveLength(2);
    expect(screen.getByText("Tag A")).toBeInTheDocument();
    expect(screen.getByText("Tag B")).toBeInTheDocument();
  });

  it("renders section_header as heading", () => {
    const field = makeField({
      fieldKey: "section_1",
      fieldType: "section_header",
      label: "About You",
      description: "Tell us about yourself",
    });

    render(
      <FormWrapper>
        <DynamicFormField field={field} disabled={false} />
      </FormWrapper>,
    );

    const heading = screen.getByText("About You");
    expect(heading.tagName).toBe("H3");
    expect(screen.getByText("Tell us about yourself")).toBeInTheDocument();
  });

  it("renders info_text as info block", () => {
    const field = makeField({
      fieldKey: "info_1",
      fieldType: "info_text",
      label: "Important notice",
      description: "Please read carefully before proceeding",
    });

    render(
      <FormWrapper>
        <DynamicFormField field={field} disabled={false} />
      </FormWrapper>,
    );

    expect(
      screen.getByText("Please read carefully before proceeding"),
    ).toBeInTheDocument();
  });

  it("renders file_upload placeholder", () => {
    const field = makeField({
      fieldKey: "manuscript",
      fieldType: "file_upload",
      label: "Manuscript",
    });

    render(
      <FormWrapper>
        <DynamicFormField field={field} disabled={false} />
      </FormWrapper>,
    );

    expect(
      screen.getByText("File uploads are handled in the Files section below."),
    ).toBeInTheDocument();
  });

  it("renders disabled inputs when disabled", () => {
    const field = makeField({
      fieldKey: "name",
      fieldType: "text",
      label: "Name",
      placeholder: "Enter name",
    });

    render(
      <FormWrapper
        schema={z.object({ name: z.string() })}
        defaultValues={{ name: "" }}
      >
        <DynamicFormField field={field} disabled={true} />
      </FormWrapper>,
    );

    const input = screen.getByPlaceholderText("Enter name");
    expect(input).toBeDisabled();
  });
});
