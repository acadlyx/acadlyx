import { z } from "zod";

export const createProgramSchema = z.object({
  departmentId: z.string().uuid(),
  name: z.string().trim().min(2).max(150),
  code: z.string().trim().min(2).max(20).toUpperCase(),
  level: z.string().trim().min(1).max(30),
  durationYears: z.number().int().min(1).max(10),
});

export const updateProgramSchema = createProgramSchema.partial().extend({
  isActive: z.boolean().optional(),
});

export const listProgramsQuerySchema = z.object({
  page: z.string().optional(),
  pageSize: z.string().optional(),
  search: z.string().trim().optional(),
  departmentId: z.string().uuid().optional(),
  isActive: z.enum(["true", "false"]).optional(),
});

export type CreateProgramInput = z.infer<typeof createProgramSchema>;
export type UpdateProgramInput = z.infer<typeof updateProgramSchema>;
