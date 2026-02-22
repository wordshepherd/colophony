import { useState, useMemo, useCallback } from "react";
import {
  evaluateCondition,
  evaluateFieldVisibilityWithBranching,
  type PageBranchingRule,
} from "@colophony/types";

/** Loose page input type that accepts both Date and string for timestamp fields (tRPC v11 serialization). */
interface PageInput {
  id: string;
  title: string;
  description: string | null;
  sortOrder: number;
  branchingRules: PageBranchingRule[] | null;
}
import type { FormFieldForRenderer } from "@/components/submissions/form-renderer/build-form-schema";

export interface WizardPage {
  id: string | null;
  title: string;
  description: string | null;
  fields: FormFieldForRenderer[];
  branchingRules: PageBranchingRule[] | null;
}

export interface UseWizardFormOptions {
  pages: PageInput[];
  fields: FormFieldForRenderer[];
  formValues: Record<string, unknown>;
}

export interface UseWizardFormReturn {
  wizardPages: WizardPage[];
  currentStep: number;
  completedSteps: Set<number>;
  isLastStep: boolean;
  isFirstStep: boolean;
  goToNext: () => void;
  goToPrevious: () => void;
  goToStep: (index: number) => void;
  currentPageFields: FormFieldForRenderer[];
  currentPage: WizardPage;
  navigationHistory: number[];
  markCurrentCompleted: () => void;
}

export function useWizardForm({
  pages,
  fields,
  formValues,
}: UseWizardFormOptions): UseWizardFormReturn {
  const [currentStep, setCurrentStep] = useState(0);
  const [completedSteps, setCompletedSteps] = useState<Set<number>>(new Set());
  const [navigationHistory, setNavigationHistory] = useState<number[]>([0]);

  // Assemble wizard pages: sort pages by sortOrder, prepend General if needed
  const wizardPages = useMemo(() => {
    const sorted = [...pages].sort((a, b) => a.sortOrder - b.sortOrder);

    // Group fields by pageId
    const fieldsByPage = new Map<string | null, FormFieldForRenderer[]>();
    for (const field of fields) {
      const key = field.pageId ?? null;
      const group = fieldsByPage.get(key) ?? [];
      group.push(field);
      fieldsByPage.set(key, group);
    }

    const result: WizardPage[] = [];

    // Add implicit General page if any fields are unassigned
    const unassignedFields = fieldsByPage.get(null) ?? [];
    if (unassignedFields.length > 0) {
      result.push({
        id: null,
        title: "General",
        description: null,
        fields: unassignedFields.sort(
          (a, b) =>
            (a as { sortOrder?: number }).sortOrder ??
            0 - ((b as { sortOrder?: number }).sortOrder ?? 0),
        ),
        branchingRules: null,
      });
    }

    // Add each defined page with its fields
    for (const page of sorted) {
      result.push({
        id: page.id,
        title: page.title,
        description: page.description,
        fields: (fieldsByPage.get(page.id) ?? []).sort(
          (a, b) =>
            (a as { sortOrder?: number }).sortOrder ??
            0 - ((b as { sortOrder?: number }).sortOrder ?? 0),
        ),
        branchingRules: page.branchingRules,
      });
    }

    // If no pages at all, create a single General page with all fields
    if (result.length === 0) {
      result.push({
        id: null,
        title: "General",
        description: null,
        fields: [...fields],
        branchingRules: null,
      });
    }

    return result;
  }, [pages, fields]);

  // Helper: check if a page has any visible fields
  const hasVisibleFields = useCallback(
    (page: WizardPage): boolean => {
      const allFieldsMeta = fields.map((f) => ({
        fieldKey: f.fieldKey,
        branchId: f.branchId ?? null,
        config: f.config ?? null,
      }));

      return page.fields.some((field) => {
        const { visible } = evaluateFieldVisibilityWithBranching(
          {
            branchId: field.branchId ?? null,
            conditionalRules: field.conditionalRules,
          },
          allFieldsMeta,
          formValues,
        );
        return visible;
      });
    },
    [fields, formValues],
  );

  const goToNext = useCallback(() => {
    const currentPage = wizardPages[currentStep];
    if (!currentPage) return;

    let nextIndex: number | null = null;

    // Check branching rules
    if (currentPage.branchingRules && currentPage.branchingRules.length > 0) {
      for (const rule of currentPage.branchingRules) {
        if (evaluateCondition(rule.condition, formValues)) {
          const targetIdx = wizardPages.findIndex(
            (p) => p.id === rule.targetPageId,
          );
          if (targetIdx !== -1) {
            nextIndex = targetIdx;
            break;
          }
        }
      }
    }

    // Default: next by array index
    if (nextIndex === null) {
      nextIndex = currentStep + 1;
    }

    // Skip pages with no visible fields
    while (nextIndex < wizardPages.length) {
      if (hasVisibleFields(wizardPages[nextIndex])) break;
      nextIndex++;
    }

    if (nextIndex < wizardPages.length) {
      setCurrentStep(nextIndex);
      setNavigationHistory((prev) => [...prev, nextIndex]);
    }
  }, [currentStep, wizardPages, formValues, hasVisibleFields]);

  const goToPrevious = useCallback(() => {
    if (navigationHistory.length <= 1) return;
    const newHistory = navigationHistory.slice(0, -1);
    setNavigationHistory(newHistory);
    setCurrentStep(newHistory[newHistory.length - 1]);
  }, [navigationHistory]);

  const goToStep = useCallback(
    (index: number) => {
      // Only allow visiting previously visited steps
      if (!navigationHistory.includes(index)) return;
      // Trim history to the target step
      const historyIdx = navigationHistory.lastIndexOf(index);
      setNavigationHistory(navigationHistory.slice(0, historyIdx + 1));
      setCurrentStep(index);
    },
    [navigationHistory],
  );

  const markCurrentCompleted = useCallback(() => {
    setCompletedSteps((prev) => {
      const next = new Set(prev);
      next.add(currentStep);
      return next;
    });
  }, [currentStep]);

  const currentPage = wizardPages[currentStep] ?? wizardPages[0];
  const currentPageFields = currentPage?.fields ?? [];

  return {
    wizardPages,
    currentStep,
    completedSteps,
    isLastStep: currentStep === wizardPages.length - 1,
    isFirstStep: currentStep === 0,
    goToNext,
    goToPrevious,
    goToStep,
    currentPageFields,
    currentPage,
    navigationHistory,
    markCurrentCompleted,
  };
}
