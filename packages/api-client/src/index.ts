// Factory functions and client types
export { createColophonyClient, createSafeColophonyClient } from "./client.js";
export type {
  ColophonyAuth,
  ColophonyBearerAuth,
  ColophonyApiKeyAuth,
  ColophonyClientOptions,
  ColophonyClient,
  JsonifyDates,
} from "./client.js";

// Contract router (for advanced use / custom link configuration)
export { colophonyContract } from "./contract.js";

// Type helpers
export type {
  ColophonyInputs,
  ColophonyOutputs,
  RestPaginationQuery,
} from "./types.js";

// Re-exports from @orpc/client for error handling
export { safe, isDefinedError, ORPCError } from "@orpc/client";
