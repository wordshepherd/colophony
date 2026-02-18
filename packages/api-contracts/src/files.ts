import { oc } from "@orpc/contract";
import { z } from "zod";
import { submissionFileSchema } from "@colophony/types";

// ---------------------------------------------------------------------------
// Path param schemas
// ---------------------------------------------------------------------------

const submissionIdParam = z.object({
  submissionId: z.string().uuid(),
});

const fileIdParam = z.object({
  fileId: z.string().uuid(),
});

// ---------------------------------------------------------------------------
// Response schemas
// ---------------------------------------------------------------------------

const downloadUrlResponseSchema = z.object({
  url: z.string(),
  filename: z.string(),
  mimeType: z.string(),
});

const deleteResponseSchema = z.object({
  success: z.literal(true),
});

// ---------------------------------------------------------------------------
// Contract
// ---------------------------------------------------------------------------

export const filesContract = {
  list: oc
    .route({ method: "GET", path: "/submissions/{submissionId}/files" })
    .input(submissionIdParam)
    .output(z.array(submissionFileSchema)),

  download: oc
    .route({ method: "GET", path: "/files/{fileId}/download" })
    .input(fileIdParam)
    .output(downloadUrlResponseSchema),

  delete: oc
    .route({ method: "DELETE", path: "/files/{fileId}" })
    .input(fileIdParam)
    .output(deleteResponseSchema),
};
