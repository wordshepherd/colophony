import { z } from "zod";
import { writerStatusSchema } from "./writer-status";

export const organizationSchema = z.object({
  id: z.string().uuid().describe("Unique identifier for the organization"),
  name: z.string().describe("Display name of the organization"),
  slug: z.string().describe("URL-friendly identifier for the organization"),
  settings: z
    .record(z.string(), z.unknown())
    .describe("Organization-specific settings as key-value pairs"),
  createdAt: z.date().describe("When the organization was created"),
  updatedAt: z.date().describe("When the organization was last updated"),
});

export type Organization = z.infer<typeof organizationSchema>;

export const slugSchema = z
  .string()
  .min(3)
  .max(63)
  .regex(/^[a-z0-9-]+$/, "Slug must be lowercase alphanumeric with hyphens")
  .describe(
    "URL-friendly identifier (3-63 chars, lowercase alphanumeric with hyphens)",
  );

export const checkSlugSchema = z.object({
  slug: slugSchema.describe("Slug to check availability for"),
});
export type CheckSlugInput = z.infer<typeof checkSlugSchema>;

export const createOrganizationSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1)
    .max(255)
    .describe("Display name of the organization"),
  slug: slugSchema,
});

export type CreateOrganizationInput = z.infer<typeof createOrganizationSchema>;

export const updateOrganizationSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1)
    .max(255)
    .optional()
    .describe("New display name"),
  settings: z
    .record(
      z.string().max(100),
      z.union([
        z.string().max(10_000),
        z.number(),
        z.boolean(),
        z.null(),
        z.record(z.string().max(100), z.string().max(100)),
      ]),
    )
    .refine((obj) => Object.keys(obj).length <= 50, {
      message: "Settings limited to 50 keys",
    })
    .optional()
    .describe("Organization settings (max 50 keys)"),
});

export type UpdateOrganizationInput = z.infer<typeof updateOrganizationSchema>;

export const roleSchema = z
  .enum(["ADMIN", "EDITOR", "READER", "PRODUCTION", "BUSINESS_OPS"])
  .describe("Member role within an organization");
export type Role = z.infer<typeof roleSchema>;

export const rolesSchema = z
  .array(roleSchema)
  .min(1)
  .describe("Roles assigned to an organization member");

/** Default display names for roles. Orgs can override via settings. */
export const ROLE_DISPLAY_DEFAULTS: Record<Role, string> = {
  ADMIN: "Administrator",
  EDITOR: "Editor",
  READER: "First Reader",
  PRODUCTION: "Production Editor",
  BUSINESS_OPS: "Business Operations",
};

/** Schema for org-configurable role display names. */
export const roleDisplayNamesSchema = z
  .record(roleSchema, z.string().min(1).max(100))
  .optional()
  .describe("Custom display names for roles");

export const organizationMemberSchema = z.object({
  id: z.string().uuid().describe("Membership record ID"),
  userId: z.string().uuid().describe("ID of the member user"),
  email: z.string().email().describe("Email address of the member"),
  roles: rolesSchema,
  createdAt: z.date().describe("When the member was added"),
});

export type OrganizationMember = z.infer<typeof organizationMemberSchema>;

/** Shape returned by `listUserOrganizations()` (uses `organizationId`, not `id`). */
export const userOrganizationSchema = z.object({
  organizationId: z.string().uuid().describe("ID of the organization"),
  name: z.string().describe("Display name of the organization"),
  slug: z.string().describe("URL-friendly identifier"),
  roles: rolesSchema,
});

export type UserOrganization = z.infer<typeof userOrganizationSchema>;

/** Slug availability check response. */
export const slugAvailabilitySchema = z.object({
  available: z.boolean().describe("Whether the slug is available for use"),
});

export type SlugAvailability = z.infer<typeof slugAvailabilitySchema>;

/** Response from `organizations.create` — org + creator membership. */
export const createOrganizationResponseSchema = z.object({
  organization: organizationSchema.describe("The newly created organization"),
  membership: z
    .object({
      id: z.string().uuid().describe("Membership record ID"),
      organizationId: z.string().uuid().describe("ID of the organization"),
      userId: z.string().uuid().describe("ID of the creator user"),
      roles: rolesSchema,
      createdAt: z.date().describe("When the membership was created"),
      updatedAt: z.date().describe("When the membership was last updated"),
    })
    .describe("The creator's membership in the new organization"),
});

export type CreateOrganizationResponse = z.infer<
  typeof createOrganizationResponseSchema
>;

/**
 * Raw member row from `.returning()` — differs from `organizationMemberSchema`
 * which has `email` from JOIN and lacks `organizationId`/`updatedAt`.
 */
export const organizationMemberMutationResponseSchema = z.object({
  id: z.string().uuid().describe("Membership record ID"),
  organizationId: z.string().uuid().describe("ID of the organization"),
  userId: z.string().uuid().describe("ID of the member user"),
  roles: rolesSchema,
  createdAt: z.date().describe("When the membership was created"),
  updatedAt: z.date().describe("When the membership was last updated"),
});

export type OrganizationMemberMutationResponse = z.infer<
  typeof organizationMemberMutationResponseSchema
>;

export const inviteMemberSchema = z.object({
  email: z.string().email().describe("Email address of the user to invite"),
  roles: rolesSchema.describe("Roles to assign to the new member"),
});

export type InviteMemberInput = z.infer<typeof inviteMemberSchema>;

export const updateMemberRolesSchema = z.object({
  memberId: z.string().uuid().describe("ID of the membership record to update"),
  roles: rolesSchema.describe("New roles for the member"),
});

export type UpdateMemberRolesInput = z.infer<typeof updateMemberRolesSchema>;

// ---------------------------------------------------------------------------
// Invitations
// ---------------------------------------------------------------------------

export const INVITATION_TOKEN_PREFIX = "col_inv_";

export const invitationStatusSchema = z
  .enum(["PENDING", "ACCEPTED", "REVOKED", "EXPIRED"])
  .describe("Lifecycle status of an organization invitation");
export type InvitationStatus = z.infer<typeof invitationStatusSchema>;

export const organizationInvitationSchema = z.object({
  id: z.string().uuid().describe("Invitation record ID"),
  organizationId: z.string().uuid().describe("ID of the organization"),
  email: z.string().email().describe("Invitee email address"),
  roles: rolesSchema,
  status: invitationStatusSchema,
  tokenPrefix: z.string().describe("Token prefix for identification"),
  invitedBy: z.string().uuid().describe("ID of the user who sent the invite"),
  expiresAt: z.date().describe("When the invitation expires"),
  createdAt: z.date().describe("When the invitation was created"),
});
export type OrganizationInvitation = z.infer<
  typeof organizationInvitationSchema
>;

export const createInvitationSchema = z.object({
  email: z.string().email().describe("Email address to invite"),
  roles: rolesSchema.describe("Roles to assign on acceptance"),
  expiresInDays: z
    .number()
    .int()
    .min(1)
    .max(30)
    .default(7)
    .optional()
    .describe("Days until invitation expires (1-30, default 7)"),
});
export type CreateInvitationInput = z.infer<typeof createInvitationSchema>;

export const acceptInvitationSchema = z.object({
  token: z.string().min(1).describe("Plain-text invitation token"),
});
export type AcceptInvitationInput = z.infer<typeof acceptInvitationSchema>;

export const acceptInvitationResultSchema = z.object({
  invitationId: z.string().uuid(),
  organizationId: z.string().uuid(),
  memberId: z.string().uuid(),
  roles: rolesSchema,
});
export type AcceptInvitationResult = z.infer<
  typeof acceptInvitationResultSchema
>;

export const inviteOrAddResultSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("member_added"),
    member: organizationMemberMutationResponseSchema,
  }),
  z.object({
    type: z.literal("invitation_sent"),
    invitation: organizationInvitationSchema,
  }),
]);
export type InviteOrAddResult = z.infer<typeof inviteOrAddResultSchema>;

// ---------------------------------------------------------------------------
// Org Settings
// ---------------------------------------------------------------------------

export const orgSettingsSchema = z.object({
  responseReminderEnabled: z.boolean().default(false),
  responseReminderDays: z.number().int().min(1).max(365).default(30),
  writerStatusLabels: z
    .record(writerStatusSchema, z.string().min(1).max(100))
    .optional()
    .describe("Custom writer-facing status display names"),
  roleDisplayNames: roleDisplayNamesSchema,
});
export type OrgSettings = z.infer<typeof orgSettingsSchema>;
