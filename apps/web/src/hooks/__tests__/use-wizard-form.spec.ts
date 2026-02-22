import { renderHook, act } from "@testing-library/react";
import "../../../test/setup";
import { useWizardForm } from "../use-wizard-form";
import type { FormPage } from "@colophony/types";
import type { FormFieldForRenderer } from "@/components/submissions/form-renderer/build-form-schema";

function makePage(
  overrides: Partial<FormPage> & {
    id: string;
    title: string;
    sortOrder: number;
  },
): FormPage {
  return {
    formDefinitionId: "form-1",
    description: null,
    branchingRules: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

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

describe("useWizardForm", () => {
  it("assembles wizard pages from fields and pages, with General page for unassigned fields", () => {
    const pages = [
      makePage({ id: "p1", title: "Page 1", sortOrder: 0 }),
      makePage({ id: "p2", title: "Page 2", sortOrder: 1 }),
    ];
    const fields = [
      makeField({ fieldKey: "unassigned_1", fieldType: "text" }),
      makeField({ fieldKey: "on_p1", fieldType: "text", pageId: "p1" }),
      makeField({ fieldKey: "on_p2", fieldType: "text", pageId: "p2" }),
    ];

    const { result } = renderHook(() =>
      useWizardForm({ pages, fields, formValues: {} }),
    );

    expect(result.current.wizardPages).toHaveLength(3);
    expect(result.current.wizardPages[0].id).toBeNull();
    expect(result.current.wizardPages[0].title).toBe("General");
    expect(result.current.wizardPages[1].id).toBe("p1");
    expect(result.current.wizardPages[2].id).toBe("p2");
  });

  it("groups fields by pageId correctly", () => {
    const pages = [makePage({ id: "p1", title: "Page 1", sortOrder: 0 })];
    const fields = [
      makeField({ fieldKey: "f1", fieldType: "text", pageId: "p1" }),
      makeField({ fieldKey: "f2", fieldType: "email", pageId: "p1" }),
      makeField({ fieldKey: "f3", fieldType: "text" }),
    ];

    const { result } = renderHook(() =>
      useWizardForm({ pages, fields, formValues: {} }),
    );

    // General page has f3, Page 1 has f1 and f2
    const generalPage = result.current.wizardPages.find((p) => p.id === null);
    const page1 = result.current.wizardPages.find((p) => p.id === "p1");
    expect(generalPage?.fields).toHaveLength(1);
    expect(generalPage?.fields[0].fieldKey).toBe("f3");
    expect(page1?.fields).toHaveLength(2);
  });

  it("navigates to next page by sortOrder when no branching rules", () => {
    const pages = [
      makePage({ id: "p1", title: "Page 1", sortOrder: 0 }),
      makePage({ id: "p2", title: "Page 2", sortOrder: 1 }),
    ];
    const fields = [
      makeField({ fieldKey: "f1", fieldType: "text", pageId: "p1" }),
      makeField({ fieldKey: "f2", fieldType: "text", pageId: "p2" }),
    ];

    const { result } = renderHook(() =>
      useWizardForm({ pages, fields, formValues: {} }),
    );

    expect(result.current.currentStep).toBe(0);
    act(() => result.current.goToNext());
    expect(result.current.currentStep).toBe(1);
  });

  it("evaluates branching rules and jumps to target page", () => {
    const pages = [
      makePage({
        id: "p1",
        title: "Page 1",
        sortOrder: 0,
        branchingRules: [
          {
            targetPageId: "p3",
            condition: {
              operator: "AND",
              rules: [{ field: "genre", comparator: "eq", value: "poetry" }],
            },
          },
        ],
      }),
      makePage({ id: "p2", title: "Page 2", sortOrder: 1 }),
      makePage({ id: "p3", title: "Page 3", sortOrder: 2 }),
    ];
    const fields = [
      makeField({ fieldKey: "genre", fieldType: "select", pageId: "p1" }),
      makeField({ fieldKey: "f2", fieldType: "text", pageId: "p2" }),
      makeField({ fieldKey: "f3", fieldType: "text", pageId: "p3" }),
    ];

    const { result } = renderHook(() =>
      useWizardForm({
        pages,
        fields,
        formValues: { genre: "poetry" },
      }),
    );

    act(() => result.current.goToNext());
    // Should jump to p3 (index 2), skipping p2
    expect(result.current.currentStep).toBe(2);
    expect(result.current.currentPage.id).toBe("p3");
  });

  it("falls back to next page when no branching rule matches", () => {
    const pages = [
      makePage({
        id: "p1",
        title: "Page 1",
        sortOrder: 0,
        branchingRules: [
          {
            targetPageId: "p3",
            condition: {
              operator: "AND",
              rules: [{ field: "genre", comparator: "eq", value: "poetry" }],
            },
          },
        ],
      }),
      makePage({ id: "p2", title: "Page 2", sortOrder: 1 }),
      makePage({ id: "p3", title: "Page 3", sortOrder: 2 }),
    ];
    const fields = [
      makeField({ fieldKey: "genre", fieldType: "select", pageId: "p1" }),
      makeField({ fieldKey: "f2", fieldType: "text", pageId: "p2" }),
      makeField({ fieldKey: "f3", fieldType: "text", pageId: "p3" }),
    ];

    const { result } = renderHook(() =>
      useWizardForm({
        pages,
        fields,
        formValues: { genre: "fiction" },
      }),
    );

    act(() => result.current.goToNext());
    // Should go to p2 (index 1)
    expect(result.current.currentStep).toBe(1);
    expect(result.current.currentPage.id).toBe("p2");
  });

  it("maintains navigation history for back navigation", () => {
    const pages = [
      makePage({ id: "p1", title: "Page 1", sortOrder: 0 }),
      makePage({ id: "p2", title: "Page 2", sortOrder: 1 }),
      makePage({ id: "p3", title: "Page 3", sortOrder: 2 }),
    ];
    const fields = [
      makeField({ fieldKey: "f1", fieldType: "text", pageId: "p1" }),
      makeField({ fieldKey: "f2", fieldType: "text", pageId: "p2" }),
      makeField({ fieldKey: "f3", fieldType: "text", pageId: "p3" }),
    ];

    const { result } = renderHook(() =>
      useWizardForm({ pages, fields, formValues: {} }),
    );

    act(() => result.current.goToNext());
    act(() => result.current.goToNext());
    expect(result.current.navigationHistory).toEqual([0, 1, 2]);
  });

  it("goToPrevious pops from history stack", () => {
    const pages = [
      makePage({ id: "p1", title: "Page 1", sortOrder: 0 }),
      makePage({ id: "p2", title: "Page 2", sortOrder: 1 }),
    ];
    const fields = [
      makeField({ fieldKey: "f1", fieldType: "text", pageId: "p1" }),
      makeField({ fieldKey: "f2", fieldType: "text", pageId: "p2" }),
    ];

    const { result } = renderHook(() =>
      useWizardForm({ pages, fields, formValues: {} }),
    );

    act(() => result.current.goToNext());
    expect(result.current.currentStep).toBe(1);

    act(() => result.current.goToPrevious());
    expect(result.current.currentStep).toBe(0);
    expect(result.current.navigationHistory).toEqual([0]);
  });

  it("goToStep only allows visiting previously visited steps", () => {
    const pages = [
      makePage({ id: "p1", title: "Page 1", sortOrder: 0 }),
      makePage({ id: "p2", title: "Page 2", sortOrder: 1 }),
      makePage({ id: "p3", title: "Page 3", sortOrder: 2 }),
    ];
    const fields = [
      makeField({ fieldKey: "f1", fieldType: "text", pageId: "p1" }),
      makeField({ fieldKey: "f2", fieldType: "text", pageId: "p2" }),
      makeField({ fieldKey: "f3", fieldType: "text", pageId: "p3" }),
    ];

    const { result } = renderHook(() =>
      useWizardForm({ pages, fields, formValues: {} }),
    );

    act(() => result.current.goToNext());
    expect(result.current.currentStep).toBe(1);

    // Can go back to step 0 (visited)
    act(() => result.current.goToStep(0));
    expect(result.current.currentStep).toBe(0);

    // Cannot go to step 2 (not visited)
    act(() => result.current.goToStep(2));
    expect(result.current.currentStep).toBe(0);
  });

  it("marks isLastStep correctly", () => {
    const pages = [
      makePage({ id: "p1", title: "Page 1", sortOrder: 0 }),
      makePage({ id: "p2", title: "Page 2", sortOrder: 1 }),
    ];
    const fields = [
      makeField({ fieldKey: "f1", fieldType: "text", pageId: "p1" }),
      makeField({ fieldKey: "f2", fieldType: "text", pageId: "p2" }),
    ];

    const { result } = renderHook(() =>
      useWizardForm({ pages, fields, formValues: {} }),
    );

    expect(result.current.isLastStep).toBe(false);
    act(() => result.current.goToNext());
    expect(result.current.isLastStep).toBe(true);
  });

  it("skips pages with all hidden fields", () => {
    const pages = [
      makePage({ id: "p1", title: "Page 1", sortOrder: 0 }),
      makePage({ id: "p2", title: "Page 2", sortOrder: 1 }),
      makePage({ id: "p3", title: "Page 3", sortOrder: 2 }),
    ];
    const fields = [
      makeField({ fieldKey: "f1", fieldType: "text", pageId: "p1" }),
      makeField({
        fieldKey: "f2",
        fieldType: "text",
        pageId: "p2",
        conditionalRules: [
          {
            effect: "SHOW",
            condition: {
              operator: "AND",
              rules: [{ field: "f1", comparator: "eq", value: "show-page-2" }],
            },
          },
        ],
      }),
      makeField({ fieldKey: "f3", fieldType: "text", pageId: "p3" }),
    ];

    const { result } = renderHook(() =>
      useWizardForm({
        pages,
        fields,
        formValues: { f1: "something-else" },
      }),
    );

    act(() => result.current.goToNext());
    // Should skip p2 (hidden field) and go directly to p3
    expect(result.current.currentStep).toBe(2);
    expect(result.current.currentPage.id).toBe("p3");
  });

  it("handles form with no pages — returns single General page containing all fields", () => {
    const fields = [
      makeField({ fieldKey: "f1", fieldType: "text" }),
      makeField({ fieldKey: "f2", fieldType: "email" }),
    ];

    const { result } = renderHook(() =>
      useWizardForm({ pages: [], fields, formValues: {} }),
    );

    expect(result.current.wizardPages).toHaveLength(1);
    expect(result.current.wizardPages[0].id).toBeNull();
    expect(result.current.wizardPages[0].title).toBe("General");
    expect(result.current.wizardPages[0].fields).toHaveLength(2);
    expect(result.current.isLastStep).toBe(true);
  });
});
