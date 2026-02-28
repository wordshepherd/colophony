import { describe, it, expect } from "vitest";
import {
  isValidStatusTransition,
  isEditorAllowedTransition,
} from "./submission";

describe("submission status transitions", () => {
  describe("REVISE_AND_RESUBMIT transitions", () => {
    it("UNDER_REVIEW → REVISE_AND_RESUBMIT is valid", () => {
      expect(
        isValidStatusTransition("UNDER_REVIEW", "REVISE_AND_RESUBMIT"),
      ).toBe(true);
    });

    it("HOLD → REVISE_AND_RESUBMIT is valid", () => {
      expect(isValidStatusTransition("HOLD", "REVISE_AND_RESUBMIT")).toBe(true);
    });

    it("REVISE_AND_RESUBMIT → SUBMITTED is valid", () => {
      expect(isValidStatusTransition("REVISE_AND_RESUBMIT", "SUBMITTED")).toBe(
        true,
      );
    });

    it("REVISE_AND_RESUBMIT → WITHDRAWN is valid", () => {
      expect(isValidStatusTransition("REVISE_AND_RESUBMIT", "WITHDRAWN")).toBe(
        true,
      );
    });

    it("REVISE_AND_RESUBMIT → ACCEPTED is not valid", () => {
      expect(isValidStatusTransition("REVISE_AND_RESUBMIT", "ACCEPTED")).toBe(
        false,
      );
    });

    it("REVISE_AND_RESUBMIT → REJECTED is not valid", () => {
      expect(isValidStatusTransition("REVISE_AND_RESUBMIT", "REJECTED")).toBe(
        false,
      );
    });

    it("DRAFT → REVISE_AND_RESUBMIT is not valid", () => {
      expect(isValidStatusTransition("DRAFT", "REVISE_AND_RESUBMIT")).toBe(
        false,
      );
    });
  });

  describe("editor transitions for REVISE_AND_RESUBMIT", () => {
    it("UNDER_REVIEW → REVISE_AND_RESUBMIT is editor-allowed", () => {
      expect(
        isEditorAllowedTransition("UNDER_REVIEW", "REVISE_AND_RESUBMIT"),
      ).toBe(true);
    });

    it("HOLD → REVISE_AND_RESUBMIT is editor-allowed", () => {
      expect(isEditorAllowedTransition("HOLD", "REVISE_AND_RESUBMIT")).toBe(
        true,
      );
    });

    it("REVISE_AND_RESUBMIT has no editor-allowed transitions", () => {
      expect(
        isEditorAllowedTransition("REVISE_AND_RESUBMIT", "SUBMITTED"),
      ).toBe(false);
      expect(isEditorAllowedTransition("REVISE_AND_RESUBMIT", "ACCEPTED")).toBe(
        false,
      );
      expect(isEditorAllowedTransition("REVISE_AND_RESUBMIT", "REJECTED")).toBe(
        false,
      );
      expect(
        isEditorAllowedTransition("REVISE_AND_RESUBMIT", "UNDER_REVIEW"),
      ).toBe(false);
      expect(isEditorAllowedTransition("REVISE_AND_RESUBMIT", "HOLD")).toBe(
        false,
      );
      expect(
        isEditorAllowedTransition("REVISE_AND_RESUBMIT", "WITHDRAWN"),
      ).toBe(false);
    });
  });
});
