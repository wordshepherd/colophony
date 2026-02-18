import { oc } from "@orpc/contract";
import { z } from "zod";
import { roleSchema } from "@colophony/types";

// ---------------------------------------------------------------------------
// Response schemas
// ---------------------------------------------------------------------------

const userProfileSchema = z.object({
  id: z.string().uuid(),
  email: z.string(),
  emailVerified: z.boolean(),
  createdAt: z.date(),
  organizations: z.array(
    z.object({
      organizationId: z.string().uuid(),
      name: z.string(),
      slug: z.string(),
      role: roleSchema,
    }),
  ),
});

// ---------------------------------------------------------------------------
// Contract
// ---------------------------------------------------------------------------

export const usersContract = {
  me: oc.route({ method: "GET", path: "/users/me" }).output(userProfileSchema),
};
