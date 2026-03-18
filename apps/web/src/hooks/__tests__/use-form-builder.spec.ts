import { vi } from "vitest";
import { renderHook, act } from "@testing-library/react";

// --- Mutable mock state ---
let mockFormData: Record<string, unknown> | undefined;
let mockIsLoading: boolean;
let mockError: { message: string } | null;

const mockInvalidateGetById = vi.fn();
const mockInvalidateList = vi.fn();
const mockMutate = vi.fn();

function resetMocks() {
  mockIsLoading = false;
  mockError = null;
  mockFormData = {
    id: "form-1",
    name: "Test Form",
    fields: [
      { id: "f1", fieldType: "text", fieldKey: "text_1", label: "Text" },
      {
        id: "f2",
        fieldType: "textarea",
        fieldKey: "textarea_1",
        label: "Textarea",
      },
    ],
  };
  mockInvalidateGetById.mockClear();
  mockInvalidateList.mockClear();
  mockMutate.mockClear();
}

vi.mock("@/lib/trpc", () => ({
  trpc: {
    useUtils: () => ({
      forms: {
        getById: { invalidate: mockInvalidateGetById },
        list: { invalidate: mockInvalidateList },
      },
    }),
    forms: {
      getById: {
        useQuery: () => ({
          data: mockFormData,
          isPending: mockIsLoading,
          error: mockError,
        }),
      },
      update: {
        useMutation: () => ({ mutate: mockMutate, isPending: false }),
      },
      publish: {
        useMutation: () => ({ mutate: mockMutate, isPending: false }),
      },
      archive: {
        useMutation: () => ({ mutate: mockMutate, isPending: false }),
      },
      duplicate: {
        useMutation: () => ({ mutate: mockMutate, isPending: false }),
      },
      delete: {
        useMutation: () => ({ mutate: mockMutate, isPending: false }),
      },
      addField: {
        useMutation: () => ({ mutate: mockMutate, isPending: false }),
      },
      updateField: {
        useMutation: () => ({ mutate: mockMutate, isPending: false }),
      },
      removeField: {
        useMutation: () => ({ mutate: mockMutate, isPending: false }),
      },
      reorderFields: {
        useMutation: () => ({ mutate: mockMutate, isPending: false }),
      },
      addPage: {
        useMutation: () => ({ mutate: mockMutate, isPending: false }),
      },
      updatePage: {
        useMutation: () => ({ mutate: mockMutate, isPending: false }),
      },
      removePage: {
        useMutation: () => ({ mutate: mockMutate, isPending: false }),
      },
      reorderPages: {
        useMutation: () => ({ mutate: mockMutate, isPending: false }),
      },
    },
  },
}));

vi.mock("sonner", () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

// Must import after mocks are set up
import { useFormBuilder } from "../use-form-builder";

describe("useFormBuilder", () => {
  beforeEach(() => {
    resetMocks();
  });

  it("returns form data and loading state", () => {
    const { result } = renderHook(() => useFormBuilder("form-1"));

    expect(result.current.form).toBeDefined();
    expect(result.current.form?.name).toBe("Test Form");
    expect(result.current.isLoading).toBe(false);
  });

  it("initializes selection state to null", () => {
    const { result } = renderHook(() => useFormBuilder("form-1"));

    expect(result.current.selectedFieldId).toBeNull();
    expect(result.current.isPreviewMode).toBe(false);
  });

  it("allows setting selectedFieldId", () => {
    const { result } = renderHook(() => useFormBuilder("form-1"));

    act(() => {
      result.current.setSelectedFieldId("f1");
    });

    expect(result.current.selectedFieldId).toBe("f1");
  });

  it("togglePreview toggles mode and clears selection", () => {
    const { result } = renderHook(() => useFormBuilder("form-1"));

    act(() => {
      result.current.setSelectedFieldId("f1");
    });
    expect(result.current.selectedFieldId).toBe("f1");

    act(() => {
      result.current.togglePreview();
    });

    expect(result.current.isPreviewMode).toBe(true);
    expect(result.current.selectedFieldId).toBeNull();
  });

  it("addField derives key from max existing suffix to avoid collisions", () => {
    const { result } = renderHook(() => useFormBuilder("form-1"));

    act(() => {
      result.current.addField("text");
    });

    // text_1 already exists, so next suffix is max(1) + 1 = 2
    expect(mockMutate).toHaveBeenCalledWith(
      expect.objectContaining({
        id: "form-1",
        fieldKey: "text_2",
        fieldType: "text",
        label: "Text 2",
        sortOrder: 2,
      }),
    );
  });

  it("addField uses suffix 1 when no existing fields of that type", () => {
    const { result } = renderHook(() => useFormBuilder("form-1"));

    act(() => {
      result.current.addField("number");
    });

    expect(mockMutate).toHaveBeenCalledWith(
      expect.objectContaining({
        fieldKey: "number_1",
        fieldType: "number",
        label: "Number",
      }),
    );
  });

  it("addField avoids key collision after deletion (max suffix logic)", () => {
    // Simulate: text_1 deleted, only text_3 remains
    mockFormData = {
      id: "form-1",
      name: "Test Form",
      fields: [
        { id: "f3", fieldType: "text", fieldKey: "text_3", label: "Text 3" },
      ],
    };
    const { result } = renderHook(() => useFormBuilder("form-1"));

    act(() => {
      result.current.addField("text");
    });

    // Should use max(3) + 1 = 4, not count(1) + 1 = 2
    expect(mockMutate).toHaveBeenCalledWith(
      expect.objectContaining({
        fieldKey: "text_4",
        fieldType: "text",
        label: "Text 4",
      }),
    );
  });

  it("returns loading state correctly", () => {
    mockIsLoading = true;
    mockFormData = undefined;
    const { result } = renderHook(() => useFormBuilder("form-1"));

    expect(result.current.isLoading).toBe(true);
    expect(result.current.form).toBeUndefined();
  });

  it("returns error state correctly", () => {
    mockError = { message: "Not found" };
    const { result } = renderHook(() => useFormBuilder("form-1"));

    expect(result.current.error).toEqual({ message: "Not found" });
  });

  it("provides mutation objects", () => {
    const { result } = renderHook(() => useFormBuilder("form-1"));

    expect(result.current.updateForm).toBeDefined();
    expect(result.current.publishForm).toBeDefined();
    expect(result.current.archiveForm).toBeDefined();
    expect(result.current.duplicateForm).toBeDefined();
    expect(result.current.deleteForm).toBeDefined();
    expect(result.current.updateField).toBeDefined();
    expect(result.current.removeField).toBeDefined();
    expect(result.current.reorderFields).toBeDefined();
  });

  it("provides page mutation objects", () => {
    const { result } = renderHook(() => useFormBuilder("form-1"));

    expect(result.current.addPage).toBeDefined();
    expect(result.current.updatePage).toBeDefined();
    expect(result.current.removePage).toBeDefined();
    expect(result.current.reorderPages).toBeDefined();
  });

  it("initializes activePageId to null", () => {
    const { result } = renderHook(() => useFormBuilder("form-1"));
    expect(result.current.activePageId).toBeNull();
  });

  it("allows setting activePageId", () => {
    const { result } = renderHook(() => useFormBuilder("form-1"));

    act(() => {
      result.current.setActivePageId("page-1");
    });

    expect(result.current.activePageId).toBe("page-1");
  });

  it("addField includes pageId when activePageId is set", () => {
    const { result } = renderHook(() => useFormBuilder("form-1"));

    act(() => {
      result.current.setActivePageId("page-1");
    });

    act(() => {
      result.current.addField("text");
    });

    expect(mockMutate).toHaveBeenCalledWith(
      expect.objectContaining({
        pageId: "page-1",
      }),
    );
  });
});
