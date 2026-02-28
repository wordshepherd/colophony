import { describe, it, expect } from "vitest";
import { hopperToCsrStatus, csrToHopperStatus } from "./status-mapping";
import type { CSRStatus } from "./csr";

describe("status-mapping", () => {
  describe("hopperToCsrStatus", () => {
    it("maps all 8 Hopper statuses to CSR equivalents", () => {
      expect(hopperToCsrStatus("DRAFT")).toBe("draft");
      expect(hopperToCsrStatus("SUBMITTED")).toBe("sent");
      expect(hopperToCsrStatus("UNDER_REVIEW")).toBe("in_review");
      expect(hopperToCsrStatus("HOLD")).toBe("hold");
      expect(hopperToCsrStatus("ACCEPTED")).toBe("accepted");
      expect(hopperToCsrStatus("REJECTED")).toBe("rejected");
      expect(hopperToCsrStatus("WITHDRAWN")).toBe("withdrawn");
      expect(hopperToCsrStatus("REVISE_AND_RESUBMIT")).toBe("revise");
    });

    it("maps unknown Hopper status to 'unknown'", () => {
      expect(hopperToCsrStatus("ARCHIVED")).toBe("unknown");
      expect(hopperToCsrStatus("")).toBe("unknown");
      expect(hopperToCsrStatus("nonsense")).toBe("unknown");
    });
  });

  describe("csrToHopperStatus", () => {
    it("reverse-maps mappable CSR statuses to Hopper", () => {
      expect(csrToHopperStatus("draft")).toBe("DRAFT");
      expect(csrToHopperStatus("sent")).toBe("SUBMITTED");
      expect(csrToHopperStatus("in_review")).toBe("UNDER_REVIEW");
      expect(csrToHopperStatus("hold")).toBe("HOLD");
      expect(csrToHopperStatus("accepted")).toBe("ACCEPTED");
      expect(csrToHopperStatus("rejected")).toBe("REJECTED");
      expect(csrToHopperStatus("withdrawn")).toBe("WITHDRAWN");
      expect(csrToHopperStatus("revise")).toBe("REVISE_AND_RESUBMIT");
    });

    it("returns null for unmappable CSR statuses (no_response, unknown)", () => {
      const unmappable: CSRStatus[] = ["no_response", "unknown"];
      for (const status of unmappable) {
        expect(csrToHopperStatus(status)).toBeNull();
      }
    });
  });
});
