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

export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1),
  newPassword: z.string().min(10).max(128),
});

export const updateMyProfileSchema = z.object({
  firstName: z.string().trim().min(2).max(100).optional(),
  lastName: z.string().trim().min(1).max(100).optional(),
  phone: z.string().trim().max(30).nullable().optional(),
}).refine((value) => Object.keys(value).length > 0, "At least one profile field is required");

export type LoginInput = z.infer<typeof loginSchema>;
export type RefreshInput = z.infer<typeof refreshSchema>;
export type LogoutInput = z.infer<typeof logoutSchema>;
export type ChangePasswordInput = z.infer<typeof changePasswordSchema>;
export type UpdateMyProfileInput = z.infer<typeof updateMyProfileSchema>;
