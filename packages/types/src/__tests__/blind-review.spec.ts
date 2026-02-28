import { describe, it, expect } from "vitest";
import { shouldBlindSubmitter, shouldBlindPeerIdentity } from "../blind-review";

describe("shouldBlindSubmitter", () => {
  it("returns false for mode=none", () => {
    expect(
      shouldBlindSubmitter({ blindMode: "none", callerRole: "EDITOR" }),
    ).toBe(false);
  });

  it("returns true for single_blind + EDITOR", () => {
    expect(
      shouldBlindSubmitter({
        blindMode: "single_blind",
        callerRole: "EDITOR",
      }),
    ).toBe(true);
  });

  it("returns true for single_blind + READER", () => {
    expect(
      shouldBlindSubmitter({
        blindMode: "single_blind",
        callerRole: "READER",
      }),
    ).toBe(true);
  });

  it("returns false for single_blind + ADMIN", () => {
    expect(
      shouldBlindSubmitter({ blindMode: "single_blind", callerRole: "ADMIN" }),
    ).toBe(false);
  });

  it("returns true for double_blind + EDITOR", () => {
    expect(
      shouldBlindSubmitter({
        blindMode: "double_blind",
        callerRole: "EDITOR",
      }),
    ).toBe(true);
  });
});

describe("shouldBlindPeerIdentity", () => {
  it("returns false for single_blind + EDITOR", () => {
    expect(
      shouldBlindPeerIdentity({
        blindMode: "single_blind",
        callerRole: "EDITOR",
      }),
    ).toBe(false);
  });

  it("returns true for double_blind + EDITOR", () => {
    expect(
      shouldBlindPeerIdentity({
        blindMode: "double_blind",
        callerRole: "EDITOR",
      }),
    ).toBe(true);
  });

  it("returns true for double_blind + READER", () => {
    expect(
      shouldBlindPeerIdentity({
        blindMode: "double_blind",
        callerRole: "READER",
      }),
    ).toBe(true);
  });

  it("returns false for double_blind + ADMIN", () => {
    expect(
      shouldBlindPeerIdentity({
        blindMode: "double_blind",
        callerRole: "ADMIN",
      }),
    ).toBe(false);
  });
});
