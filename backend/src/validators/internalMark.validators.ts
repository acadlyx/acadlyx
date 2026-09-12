import { z } from "zod";

export const enterMarksSchema = z.object({
  courseOfferingId: z.string().uuid(),
  component: z.string().trim().min(1).max(100),
  maxMarks: z.number().positive().max(1000),
  records: z
    .array(
      z.object({
        studentId: z.string().uuid(),
        marksObtained: z.number().min(0),
      })
    )
    .min(1, "At least one mark entry is required"),
});

export const listMarksQuerySchema = z.object({
  page: z.string().optional(),
  pageSize: z.string().optional(),
  courseOfferingId: z.string().uuid().optional(),
  studentId: z.string().uuid().optional(),
  component: z.string().trim().optional(),
});

export type EnterMarksInput = z.infer<typeof enterMarksSchema>;
