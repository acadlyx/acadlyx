import { z } from "zod";

export const loginSchema = z.object({
  email: z.string().trim().email("Must be a valid email address"),
  password: z.string().min(1, "Password is required"),
});

export const refreshSchema = z.object({
  refreshToken: z.string().min(1, "refreshToken is required"),
});

export const logoutSchema = z.object({
  refreshToken: z.string().min(1, "refreshToken is required"),
});

export type LoginInput = z.infer<typeof loginSchema>;
export type RefreshInput = z.infer<typeof refreshSchema>;
export type LogoutInput = z.infer<typeof logoutSchema>;
