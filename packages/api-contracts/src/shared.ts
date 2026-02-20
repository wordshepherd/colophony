import { z } from "zod";

/**
 * Standard API error response schema.
 * All REST error responses follow this shape.
 */
export const apiErrorSchema = z.object({
  error: z.string().describe("Machine-readable error code"),
  message: z.string().describe("Human-readable error description"),
});

/**
 * Pagination query params for REST endpoints.
 * Uses `z.coerce.number()` because REST query params arrive as strings.
 */
export const restPaginationQuery = z.object({
  page: z.coerce
    .number()
    .int()
    .min(1)
    .default(1)
    .describe("Page number (1-based)"),
  limit: z.coerce
    .number()
    .int()
    .min(1)
    .max(100)
    .default(20)
    .describe("Items per page (1-100, default 20)"),
});

export type RestPaginationQuery = z.infer<typeof restPaginationQuery>;
