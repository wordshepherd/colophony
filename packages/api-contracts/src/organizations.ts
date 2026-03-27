import { oc } from "@orpc/contract";
import { z } from "zod";
import {
  organizationSchema,
  createOrganizationSchema,
  updateOrganizationSchema,
  checkSlugSchema,
  organizationMemberSchema,
  inviteMemberSchema,
  updateMemberRolesSchema,
  rolesSchema,
} from "@colophony/types";

/**
 * Schema for member mutation responses (add, update role).
 * Matches the raw `organization_members` DB row shape — no email join,
 * includes organizationId and updatedAt unlike the list query schema.
 */
const memberMutationResponseSchema = z.object({
  id: z.string().uuid(),
  organizationId: z.string().uuid(),
  userId: z.string().uuid(),
  roles: rolesSchema,
  createdAt: z.date(),
  updatedAt: z.date(),
});
import { restPaginationQuery } from "./shared.js";

// ---------------------------------------------------------------------------
// Response schemas
// ---------------------------------------------------------------------------

const orgListItemSchema = z.object({
  organizationId: z.string().uuid(),
  roles: rolesSchema,
  name: z.string(),
  slug: z.string(),
});

const createOrgResponseSchema = z.object({
  organization: organizationSchema,
  membership: z.object({
    id: z.string().uuid(),
    organizationId: z.string().uuid(),
    userId: z.string().uuid(),
    roles: rolesSchema,
    createdAt: z.date(),
    updatedAt: z.date(),
  }),
});

const checkSlugResponseSchema = z.object({
  available: z.boolean(),
});

const paginatedMembersSchema = z.object({
  items: z.array(organizationMemberSchema),
  total: z.number(),
  page: z.number(),
  limit: z.number(),
  totalPages: z.number(),
});

const memberRemovedSchema = z.object({
  success: z.literal(true),
});

// ---------------------------------------------------------------------------
// Path param schemas
// ---------------------------------------------------------------------------

const orgIdParam = z.object({
  orgId: z.string().uuid(),
});

const memberIdParam = z.object({
  orgId: z.string().uuid(),
  memberId: z.string().uuid(),
});

// ---------------------------------------------------------------------------
// Contract
// ---------------------------------------------------------------------------

export const organizationMembersContract = {
  list: oc
    .route({
      method: "GET",
      path: "/organizations/{orgId}/members",
      summary: "List organization members",
      description:
        "Returns a paginated list of members for the specified organization.",
      operationId: "listOrganizationMembers",
      tags: ["Organizations"],
    })
    .input(orgIdParam.merge(restPaginationQuery))
    .output(paginatedMembersSchema),

  add: oc
    .route({
      method: "POST",
      path: "/organizations/{orgId}/members",
      successStatus: 201,
      summary: "Add a member",
      description:
        "Invite a user to the organization by email. The user must already have an account. Requires ADMIN role.",
      operationId: "addOrganizationMember",
      tags: ["Organizations"],
    })
    .input(orgIdParam.merge(inviteMemberSchema))
    .output(memberMutationResponseSchema),

  remove: oc
    .route({
      method: "DELETE",
      path: "/organizations/{orgId}/members/{memberId}",
      summary: "Remove a member",
      description:
        "Remove a member from the organization. Requires ADMIN role.",
      operationId: "removeOrganizationMember",
      tags: ["Organizations"],
    })
    .input(memberIdParam)
    .output(memberRemovedSchema),

  updateRoles: oc
    .route({
      method: "PATCH",
      path: "/organizations/{orgId}/members/{memberId}",
      summary: "Update member roles",
      description:
        "Change a member's roles within the organization. Requires ADMIN role.",
      operationId: "updateOrganizationMemberRoles",
      tags: ["Organizations"],
    })
    .input(
      memberIdParam.merge(updateMemberRolesSchema.omit({ memberId: true })),
    )
    .output(memberMutationResponseSchema),
};

export const organizationsContract = {
  list: oc
    .route({
      method: "GET",
      path: "/organizations",
      summary: "List organizations",
      description:
        "Returns all organizations the authenticated user is a member of.",
      operationId: "listOrganizations",
      tags: ["Organizations"],
    })
    .output(z.array(orgListItemSchema)),

  create: oc
    .route({
      method: "POST",
      path: "/organizations",
      successStatus: 201,
      summary: "Create an organization",
      description:
        "Create a new organization. The authenticated user becomes the first ADMIN member.",
      operationId: "createOrganization",
      tags: ["Organizations"],
    })
    .input(createOrganizationSchema)
    .output(createOrgResponseSchema),

  checkSlug: oc
    .route({
      method: "GET",
      path: "/organizations/check-slug",
      summary: "Check slug availability",
      description:
        "Check whether a slug is available for use when creating an organization.",
      operationId: "checkSlugAvailability",
      tags: ["Organizations"],
    })
    .input(checkSlugSchema)
    .output(checkSlugResponseSchema),

  get: oc
    .route({
      method: "GET",
      path: "/organizations/{orgId}",
      summary: "Get an organization",
      description: "Retrieve a single organization by its ID.",
      operationId: "getOrganization",
      tags: ["Organizations"],
    })
    .input(orgIdParam)
    .output(organizationSchema),

  update: oc
    .route({
      method: "PATCH",
      path: "/organizations/{orgId}",
      summary: "Update an organization",
      description:
        "Update an organization's name or settings. Requires ADMIN role.",
      operationId: "updateOrganization",
      tags: ["Organizations"],
    })
    .input(orgIdParam.merge(updateOrganizationSchema))
    .output(organizationSchema),

  members: organizationMembersContract,
};
