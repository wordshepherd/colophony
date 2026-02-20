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
    .route({
      method: "GET",
      path: "/submissions/{submissionId}/files",
      summary: "List submission files",
      description: "Returns all files attached to a submission.",
      operationId: "listSubmissionFiles",
      tags: ["Files"],
    })
    .input(submissionIdParam)
    .output(z.array(submissionFileSchema)),

  download: oc
    .route({
      method: "GET",
      path: "/files/{fileId}/download",
      summary: "Get download URL",
      description:
        "Generate a pre-signed download URL for a file. Only available for files with CLEAN scan status.",
      operationId: "getFileDownloadUrl",
      tags: ["Files"],
    })
    .input(fileIdParam)
    .output(downloadUrlResponseSchema),

  delete: oc
    .route({
      method: "DELETE",
      path: "/files/{fileId}",
      summary: "Delete a file",
      description:
        "Delete a file from a DRAFT submission. Only the submission owner can delete files.",
      operationId: "deleteFile",
      tags: ["Files"],
    })
    .input(fileIdParam)
    .output(deleteResponseSchema),
};
