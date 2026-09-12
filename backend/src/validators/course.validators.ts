import { z } from "zod";

export const createCourseSchema = z.object({
  departmentId: z.string().uuid(),
  code: z.string().trim().min(2).max(20).toUpperCase(),
  name: z.string().trim().min(2).max(150),
  credits: z.number().int().min(1).max(10),
  description: z.string().trim().max(2000).optional(),
});

export const updateCourseSchema = createCourseSchema.partial().extend({
  isActive: z.boolean().optional(),
});

export const listCoursesQuerySchema = z.object({
  page: z.string().optional(),
  pageSize: z.string().optional(),
  search: z.string().trim().optional(),
  departmentId: z.string().uuid().optional(),
  isActive: z.enum(["true", "false"]).optional(),
});

export type CreateCourseInput = z.infer<typeof createCourseSchema>;
export type UpdateCourseInput = z.infer<typeof updateCourseSchema>;
