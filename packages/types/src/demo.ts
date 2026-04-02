import { z } from "zod";

export const demoLoginRequestSchema = z.object({
  role: z.enum(["writer", "editor"]),
});

export type DemoLoginRequest = z.infer<typeof demoLoginRequestSchema>;

export const demoLoginResponseSchema = z.object({
  userId: z.string().uuid(),
  displayName: z.string(),
  email: z.string().email(),
  orgId: z.string().uuid(),
  orgSlug: z.string(),
  role: z.enum(["writer", "editor"]),
});

export type DemoLoginResponse = z.infer<typeof demoLoginResponseSchema>;
