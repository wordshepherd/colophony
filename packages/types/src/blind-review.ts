import type { BlindReviewMode } from "./submission";

export const ANONYMOUS_LABEL = "[Anonymous]";

export interface BlindContext {
  blindMode: BlindReviewMode;
  callerRoles: readonly string[];
}

/**
 * Returns true when submitter identity should be hidden.
 * In both single_blind and double_blind, editors and readers cannot see the submitter.
 * Only admins can see submitter identity when blinding is active.
 */
export function shouldBlindSubmitter(ctx: BlindContext): boolean {
  return ctx.blindMode !== "none" && !ctx.callerRoles.includes("ADMIN");
}

/**
 * Returns true when peer identities (voters, commenters, reviewers) should be hidden.
 * Only in double_blind mode, and only for non-admins.
 */
export function shouldBlindPeerIdentity(ctx: BlindContext): boolean {
  return ctx.blindMode === "double_blind" && !ctx.callerRoles.includes("ADMIN");
}
