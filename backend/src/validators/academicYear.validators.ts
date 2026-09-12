import { z } from "zod";

export const createAcademicYearSchema = z
  .object({
    name: z.string().trim().min(4).max(20),
    startDate: z.coerce.date(),
    endDate: z.coerce.date(),
    isCurrent: z.boolean().optional(),
  })
  .refine((data) => data.endDate > data.startDate, {
    message: "endDate must be after startDate",
    path: ["endDate"],
  });

export const updateAcademicYearSchema = z
  .object({
    name: z.string().trim().min(4).max(20).optional(),
    startDate: z.coerce.date().optional(),
    endDate: z.coerce.date().optional(),
    isCurrent: z.boolean().optional(),
  })
  .superRefine((data, ctx) => {
    if (data.startDate && data.endDate && data.endDate <= data.startDate) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "endDate must be after startDate",
        path: ["endDate"],
      });
    }
  });

export const listAcademicYearsQuerySchema = z.object({
  page: z.string().optional(),
  pageSize: z.string().optional(),
  search: z.string().trim().optional(),
});

export type CreateAcademicYearInput = z.infer<typeof createAcademicYearSchema>;
export type UpdateAcademicYearInput = z.infer<typeof updateAcademicYearSchema>;
