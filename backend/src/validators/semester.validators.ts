import { z } from "zod";

export const createSemesterSchema = z.object({
  programId: z.string().uuid(),
  academicYearId: z.string().uuid(),
  number: z.number().int().min(1).max(20),
  name: z.string().trim().min(1).max(50),
  startDate: z.coerce.date().optional(),
  endDate: z.coerce.date().optional(),
});

export const updateSemesterSchema = z
  .object({
    number: z.number().int().min(1).max(20).optional(),
    name: z.string().trim().min(1).max(50).optional(),
    startDate: z.coerce.date().optional(),
    endDate: z.coerce.date().optional(),
    isActive: z.boolean().optional(),
  })
  .strict();

export const listSemestersQuerySchema = z.object({
  page: z.string().optional(),
  pageSize: z.string().optional(),
  search: z.string().trim().optional(),
  programId: z.string().uuid().optional(),
  academicYearId: z.string().uuid().optional(),
  isActive: z.enum(["true", "false"]).optional(),
});

export type CreateSemesterInput = z.infer<typeof createSemesterSchema>;
export type UpdateSemesterInput = z.infer<typeof updateSemesterSchema>;
