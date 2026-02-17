import { z } from "zod";

export const paginationSchema = z.object({
  page: z.number().int().min(1).default(1),
  limit: z.number().int().min(1).max(100).default(20),
});

export type PaginationInput = z.infer<typeof paginationSchema>;

export const paginatedResponseSchema = <T extends z.ZodType>(itemSchema: T) =>
  z.object({
    items: z.array(itemSchema),
    total: z.number(),
    page: z.number(),
    limit: z.number(),
    totalPages: z.number(),
  });

export type PaginatedResponse<T> = {
  items: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
};

export const uuidSchema = z.string().uuid();

// ---------------------------------------------------------------------------
// Reusable ID param schemas for API surfaces (tRPC, REST, GraphQL)
// ---------------------------------------------------------------------------

export const idParamSchema = z.object({ id: z.string().uuid() });
export type IdParam = z.infer<typeof idParamSchema>;

export const fileIdParamSchema = z.object({ fileId: z.string().uuid() });
export type FileIdParam = z.infer<typeof fileIdParamSchema>;

export const submissionIdParamSchema = z.object({
  submissionId: z.string().uuid(),
});
export type SubmissionIdParam = z.infer<typeof submissionIdParamSchema>;

export const dateRangeSchema = z.object({
  from: z.date().optional(),
  to: z.date().optional(),
});

export type DateRange = z.infer<typeof dateRangeSchema>;
