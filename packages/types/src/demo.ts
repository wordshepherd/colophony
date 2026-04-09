import { z } from "zod";

export const consultRequestSchema = z.object({
  name: z.string().min(1).max(256),
  email: z.string().email().max(320),
  magazine: z.string().min(1).max(256),
  message: z.string().max(5000).optional(),
});

export type ConsultRequestData = z.infer<typeof consultRequestSchema>;

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
