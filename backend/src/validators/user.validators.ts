import { z } from "zod";

export const createUserSchema = z.object({
  institutionId: z.string().uuid().nullable().optional(),

  email: z.string().trim().email().max(200),

  firstName: z.string().trim().min(2).max(100),

  lastName: z.string().trim().min(1).max(100),

  phone: z.string().trim().max(30).optional().or(z.literal("")),

  password: z.string().min(8).max(128),

  role: z.string().trim().min(2).max(100),
});

export const updateUserSchema = z.object({
  firstName: z.string().trim().min(2).max(100).optional(),

  lastName: z.string().trim().min(1).max(100).optional(),

  phone: z.string().trim().max(30).optional().or(z.literal("")),

  isActive: z.boolean().optional(),

  role: z.string().trim().min(2).max(100).optional(),
});

export const listUsersQuerySchema = z.object({
  page: z.string().optional(),
  pageSize: z.string().optional(),

  search: z.string().trim().optional(),

  institutionId: z.string().uuid().optional(),

  role: z.string().trim().optional(),

  isActive: z.enum(["true", "false"]).optional(),
});

export type CreateUserInput = z.infer<typeof createUserSchema>;

export type UpdateUserInput = z.infer<typeof updateUserSchema>;
