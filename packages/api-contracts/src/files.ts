import { oc } from "@orpc/contract";
import { z } from "zod";
import { fileSchema } from "@colophony/types";

// ---------------------------------------------------------------------------
// Path param schemas
// ---------------------------------------------------------------------------

const manuscriptVersionIdParam = z.object({
  manuscriptVersionId: z.string().uuid(),
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
      path: "/manuscript-versions/{manuscriptVersionId}/files",
      summary: "List files for a manuscript version",
      description: "Returns all files attached to a manuscript version.",
      operationId: "listManuscriptVersionFiles",
      tags: ["Files"],
    })
    .input(manuscriptVersionIdParam)
    .output(z.array(fileSchema)),

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
        "Delete a file from a manuscript version. Only the manuscript owner can delete files.",
      operationId: "deleteFile",
      tags: ["Files"],
    })
    .input(fileIdParam)
    .output(deleteResponseSchema),
};
