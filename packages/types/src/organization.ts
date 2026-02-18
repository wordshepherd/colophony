import { z } from "zod";

export const organizationSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  slug: z.string(),
  settings: z.record(z.string(), z.unknown()),
  createdAt: z.date(),
  updatedAt: z.date(),
});

export type Organization = z.infer<typeof organizationSchema>;

export const slugSchema = z
  .string()
  .min(3)
  .max(63)
  .regex(/^[a-z0-9-]+$/, "Slug must be lowercase alphanumeric with hyphens");

export const checkSlugSchema = z.object({ slug: slugSchema });
export type CheckSlugInput = z.infer<typeof checkSlugSchema>;

export const createOrganizationSchema = z.object({
  name: z.string().trim().min(1).max(255),
  slug: slugSchema,
});

export type CreateOrganizationInput = z.infer<typeof createOrganizationSchema>;

export const updateOrganizationSchema = z.object({
  name: z.string().trim().min(1).max(255).optional(),
  settings: z
    .record(
      z.string().max(100),
      z.union([z.string().max(10_000), z.number(), z.boolean(), z.null()]),
    )
    .refine((obj) => Object.keys(obj).length <= 50, {
      message: "Settings limited to 50 keys",
    })
    .optional(),
});

export type UpdateOrganizationInput = z.infer<typeof updateOrganizationSchema>;

export const roleSchema = z.enum(["ADMIN", "EDITOR", "READER"]);
export type Role = z.infer<typeof roleSchema>;

export const organizationMemberSchema = z.object({
  id: z.string().uuid(),
  userId: z.string().uuid(),
  email: z.string().email(),
  role: roleSchema,
  createdAt: z.date(),
});

export type OrganizationMember = z.infer<typeof organizationMemberSchema>;

export const inviteMemberSchema = z.object({
  email: z.string().email(),
  role: roleSchema,
});

export type InviteMemberInput = z.infer<typeof inviteMemberSchema>;

export const updateMemberRoleSchema = z.object({
  memberId: z.string().uuid(),
  role: roleSchema,
});

export type UpdateMemberRoleInput = z.infer<typeof updateMemberRoleSchema>;
