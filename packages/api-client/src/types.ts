import type {
  InferContractRouterInputs,
  InferContractRouterOutputs,
} from "@orpc/contract";
import type { JsonifyDates } from "./client.js";
import type { colophonyContract } from "./contract.js";

/** Inferred input types for every procedure in the contract. */
export type ColophonyInputs = InferContractRouterInputs<
  typeof colophonyContract
>;

/** Raw output types from the contract (Date fields). */
type RawOutputs = InferContractRouterOutputs<typeof colophonyContract>;

/**
 * Inferred output types with JSON-accurate date fields (string, not Date).
 * Recursively applied so nested objects reflect the wire format.
 */
export type ColophonyOutputs = {
  [K in keyof RawOutputs]: {
    [P in keyof RawOutputs[K]]: JsonifyDates<RawOutputs[K][P]>;
  };
};

export type { RestPaginationQuery } from "@colophony/api-contracts";
