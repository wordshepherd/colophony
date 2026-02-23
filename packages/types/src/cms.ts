import { z } from "zod";

// ---------------------------------------------------------------------------
// CMS adapter types
// ---------------------------------------------------------------------------

export const cmsAdapterTypeValues = ["WORDPRESS", "GHOST"] as const;
export type CmsAdapterType = (typeof cmsAdapterTypeValues)[number];

// ---------------------------------------------------------------------------
// CMS connection
// ---------------------------------------------------------------------------

export interface CmsConnection {
  id: string;
  organizationId: string;
  publicationId: string | null;
  adapterType: CmsAdapterType;
  name: string;
  config: Record<string, unknown>;
  isActive: boolean;
  lastSyncAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

// ---------------------------------------------------------------------------
// Input schemas
// ---------------------------------------------------------------------------

export const createCmsConnectionSchema = z.object({
  publicationId: z.string().uuid().optional().describe("Publication ID"),
  adapterType: z
    .enum(cmsAdapterTypeValues)
    .describe("CMS adapter type (WORDPRESS or GHOST)"),
  name: z
    .string()
    .trim()
    .min(1)
    .max(255)
    .describe("Display name for this connection"),
  config: z
    .record(z.string(), z.unknown())
    .describe("Adapter-specific configuration (API URL, credentials, etc.)"),
});

export type CreateCmsConnectionInput = z.infer<
  typeof createCmsConnectionSchema
>;

export const updateCmsConnectionSchema = z.object({
  name: z.string().trim().min(1).max(255).optional(),
  config: z.record(z.string(), z.unknown()).optional(),
  isActive: z.boolean().optional(),
});

export type UpdateCmsConnectionInput = z.infer<
  typeof updateCmsConnectionSchema
>;

export const listCmsConnectionsSchema = z.object({
  publicationId: z.string().uuid().optional(),
  page: z.number().int().min(1).default(1),
  limit: z.number().int().min(1).max(100).default(20),
});

export type ListCmsConnectionsInput = z.infer<typeof listCmsConnectionsSchema>;

// ---------------------------------------------------------------------------
// Response schemas
// ---------------------------------------------------------------------------

export const cmsConnectionSchema = z.object({
  id: z.string().uuid(),
  organizationId: z.string().uuid(),
  publicationId: z.string().uuid().nullable(),
  adapterType: z.enum(cmsAdapterTypeValues),
  name: z.string(),
  config: z.record(z.string(), z.unknown()),
  isActive: z.boolean(),
  lastSyncAt: z.date().nullable(),
  createdAt: z.date(),
  updatedAt: z.date(),
});
