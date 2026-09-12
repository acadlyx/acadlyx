import { z } from "zod";

export const createAssignmentSchema = z.object({
  courseOfferingId: z.string().uuid(),
  title: z.string().trim().min(2).max(200),
  description: z.string().trim().max(5000).optional(),
  dueDate: z.coerce.date(),
  maxMarks: z.number().int().min(1).max(1000),
  status: z.enum(["DRAFT", "PUBLISHED"]).optional().default("DRAFT"),
});

export const updateAssignmentSchema = z
  .object({
    title: z.string().trim().min(2).max(200).optional(),
    description: z.string().trim().max(5000).optional(),
    dueDate: z.coerce.date().optional(),
    maxMarks: z.number().int().min(1).max(1000).optional(),
    status: z.enum(["DRAFT", "PUBLISHED"]).optional(),
  })
  .strict();

export const listAssignmentsQuerySchema = z.object({
  page: z.string().optional(),
  pageSize: z.string().optional(),
  search: z.string().trim().optional(),
  courseOfferingId: z.string().uuid().optional(),
  status: z.enum(["DRAFT", "PUBLISHED"]).optional(),
});

export const submitAssignmentSchema = z.object({
  content: z.string().trim().min(1, "Submission content is required").max(20000),
});

export const reviewSubmissionSchema = z.object({
  marksAwarded: z.number().int().min(0),
  feedback: z.string().trim().max(5000).optional(),
});

export type CreateAssignmentInput = z.infer<typeof createAssignmentSchema>;
export type UpdateAssignmentInput = z.infer<typeof updateAssignmentSchema>;
export type SubmitAssignmentInput = z.infer<typeof submitAssignmentSchema>;
export type ReviewSubmissionInput = z.infer<typeof reviewSubmissionSchema>;
