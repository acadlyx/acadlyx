import { z } from "zod";

export const createCourseOfferingSchema = z.object({
  courseId: z.string().uuid(),
  semesterId: z.string().uuid(),
  sectionId: z.string().uuid(),
  facultyId: z.string().uuid().optional(),
});

export const updateCourseOfferingSchema = z
  .object({
    facultyId: z.string().uuid().nullable().optional(),
    isActive: z.boolean().optional(),
  })
  .strict();

export const listCourseOfferingsQuerySchema = z.object({
  page: z.string().optional(),
  pageSize: z.string().optional(),
  courseId: z.string().uuid().optional(),
  semesterId: z.string().uuid().optional(),
  sectionId: z.string().uuid().optional(),
  facultyId: z.string().uuid().optional(),
  isActive: z.enum(["true", "false"]).optional(),
});

export type CreateCourseOfferingInput = z.infer<
  typeof createCourseOfferingSchema
>;
export type UpdateCourseOfferingInput = z.infer<
  typeof updateCourseOfferingSchema
>;
