import { z } from "zod";

const capacitySchema = z.number().int().min(1).max(100000);

export const createCourseOfferingSchema = z.object({
  courseId: z.string().uuid(),
  semesterId: z.string().uuid(),
  sectionId: z.string().uuid(),
  facultyId: z.string().uuid().optional(),
  departmentId: z.string().uuid().optional(),
  capacity: capacitySchema.optional(),
  registrationOpen: z.boolean().optional(),
  isElective: z.boolean().optional(),
});

export const updateCourseOfferingSchema = z
  .object({
    facultyId: z.string().uuid().nullable().optional(),
    capacity: capacitySchema.nullable().optional(),
    registrationOpen: z.boolean().optional(),
    isElective: z.boolean().optional(),
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
  departmentId: z.string().uuid().optional(),
  isActive: z.enum(["true", "false"]).optional(),
});

export type CreateCourseOfferingInput = z.infer<
  typeof createCourseOfferingSchema
>;
export type UpdateCourseOfferingInput = z.infer<
  typeof updateCourseOfferingSchema
>;
