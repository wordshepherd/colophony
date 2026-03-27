import { z } from "zod";

export const userSchema = z.object({
  id: z.string().uuid().describe("Unique identifier for the user"),
  email: z.string().email().describe("Primary email address"),
  emailVerified: z
    .boolean()
    .describe("Whether the email has been verified via Zitadel"),
  createdAt: z.date().describe("When the user account was created"),
  updatedAt: z.date().describe("When the user account was last updated"),
});

export type User = z.infer<typeof userSchema>;

export const updateUserSchema = z.object({
  email: z.string().email().optional().describe("New email address"),
});

export type UpdateUserInput = z.infer<typeof updateUserSchema>;

export const userProfileSchema = z.object({
  id: z.string().uuid().describe("Unique identifier for the user"),
  email: z.string().email().describe("Primary email address"),
  emailVerified: z.boolean().describe("Whether the email has been verified"),
  createdAt: z.date().describe("When the user account was created"),
  organizations: z
    .array(
      z.object({
        id: z.string().uuid().describe("Organization ID"),
        name: z.string().describe("Organization name"),
        slug: z.string().describe("Organization slug"),
        roles: z
          .array(
            z.enum(["ADMIN", "EDITOR", "READER", "PRODUCTION", "BUSINESS_OPS"]),
          )
          .min(1)
          .describe("User's roles in this organization"),
      }),
    )
    .describe("Organizations the user belongs to"),
});

export type UserProfile = z.infer<typeof userProfileSchema>;
