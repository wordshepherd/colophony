import { z } from "zod";

export const paginationSchema = z.object({
  page: z.number().int().min(1).default(1).describe("Page number (1-based)"),
  limit: z
    .number()
    .int()
    .min(1)
    .max(100)
    .default(20)
    .describe("Items per page (1-100, default 20)"),
});

export type PaginationInput = z.infer<typeof paginationSchema>;

export const paginatedResponseSchema = <T extends z.ZodType>(itemSchema: T) =>
  z.object({
    items: z.array(itemSchema).describe("Items on the current page"),
    total: z.number().describe("Total number of items across all pages"),
    page: z.number().describe("Current page number"),
    limit: z.number().describe("Items per page"),
    totalPages: z.number().describe("Total number of pages"),
  });

export type PaginatedResponse<T> = {
  items: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
};

export const successResponseSchema = z.object({
  success: z.literal(true).describe("Always true on success"),
});

export type SuccessResponse = z.infer<typeof successResponseSchema>;

export const uuidSchema = z.string().uuid();

// ---------------------------------------------------------------------------
// Reusable ID param schemas for API surfaces (tRPC, REST, GraphQL)
// ---------------------------------------------------------------------------

export const idParamSchema = z.object({
  id: z.string().uuid().describe("Resource UUID"),
});
export type IdParam = z.infer<typeof idParamSchema>;

export const fileIdParamSchema = z.object({
  fileId: z.string().uuid().describe("File UUID"),
});
export type FileIdParam = z.infer<typeof fileIdParamSchema>;

export const submissionIdParamSchema = z.object({
  submissionId: z.string().uuid().describe("Submission UUID"),
});
export type SubmissionIdParam = z.infer<typeof submissionIdParamSchema>;

export const memberIdParamSchema = z.object({
  memberId: z.string().uuid().describe("Membership record UUID"),
});
export type MemberIdParam = z.infer<typeof memberIdParamSchema>;

export const dateRangeSchema = z.object({
  from: z.date().optional().describe("Start of date range (ISO-8601)"),
  to: z.date().optional().describe("End of date range (ISO-8601)"),
});

export type DateRange = z.infer<typeof dateRangeSchema>;
