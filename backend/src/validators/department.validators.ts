import { z } from "zod";

export const createDepartmentSchema = z.object({
  name: z.string().trim().min(2).max(150),
  code: z.string().trim().min(2).max(20).toUpperCase(),
  campusId: z.string().uuid().optional(),
});

export const updateDepartmentSchema = createDepartmentSchema.partial().extend({
  isActive: z.boolean().optional(),
});

export const listDepartmentsQuerySchema = z.object({
  page: z.string().optional(),
  pageSize: z.string().optional(),
  search: z.string().trim().optional(),
  isActive: z.enum(["true", "false"]).optional(),
});

export type CreateDepartmentInput = z.infer<typeof createDepartmentSchema>;
export type UpdateDepartmentInput = z.infer<typeof updateDepartmentSchema>;
