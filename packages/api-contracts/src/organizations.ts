import { oc } from "@orpc/contract";
import { z } from "zod";
import {
  organizationSchema,
  createOrganizationSchema,
  updateOrganizationSchema,
  checkSlugSchema,
  organizationMemberSchema,
  inviteMemberSchema,
  updateMemberRoleSchema,
  roleSchema,
} from "@colophony/types";
import { restPaginationQuery } from "./shared.js";

// ---------------------------------------------------------------------------
// Response schemas
// ---------------------------------------------------------------------------

const orgListItemSchema = z.object({
  organizationId: z.string().uuid(),
  role: roleSchema,
  name: z.string(),
  slug: z.string(),
});

const createOrgResponseSchema = z.object({
  organization: organizationSchema,
  membership: z.object({
    id: z.string().uuid(),
    organizationId: z.string().uuid(),
    userId: z.string().uuid(),
    role: roleSchema,
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
    .route({ method: "GET", path: "/organizations/{orgId}/members" })
    .input(orgIdParam.merge(restPaginationQuery))
    .output(paginatedMembersSchema),

  add: oc
    .route({
      method: "POST",
      path: "/organizations/{orgId}/members",
      successStatus: 201,
    })
    .input(orgIdParam.merge(inviteMemberSchema))
    .output(organizationMemberSchema),

  remove: oc
    .route({
      method: "DELETE",
      path: "/organizations/{orgId}/members/{memberId}",
    })
    .input(memberIdParam)
    .output(memberRemovedSchema),

  updateRole: oc
    .route({
      method: "PATCH",
      path: "/organizations/{orgId}/members/{memberId}",
    })
    .input(memberIdParam.merge(updateMemberRoleSchema.omit({ memberId: true })))
    .output(organizationMemberSchema),
};

export const organizationsContract = {
  list: oc
    .route({ method: "GET", path: "/organizations" })
    .output(z.array(orgListItemSchema)),

  create: oc
    .route({ method: "POST", path: "/organizations", successStatus: 201 })
    .input(createOrganizationSchema)
    .output(createOrgResponseSchema),

  checkSlug: oc
    .route({ method: "GET", path: "/organizations/check-slug" })
    .input(checkSlugSchema)
    .output(checkSlugResponseSchema),

  get: oc
    .route({ method: "GET", path: "/organizations/{orgId}" })
    .input(orgIdParam)
    .output(organizationSchema),

  update: oc
    .route({ method: "PATCH", path: "/organizations/{orgId}" })
    .input(orgIdParam.merge(updateOrganizationSchema))
    .output(organizationSchema),

  members: organizationMembersContract,
};
