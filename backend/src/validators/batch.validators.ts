import { z } from "zod";

export const listBatchesQuerySchema = z.object({
  page: z.string().regex(/^\d+$/).optional(),
  pageSize: z.string().regex(/^\d+$/).optional(),
  search: z.string().trim().max(150).optional(),
  programId: z.string().uuid().optional(),
  departmentId: z.string().uuid().optional(),
  campusId: z.string().uuid().optional(),
  isActive: z.enum(["true", "false"]).optional(),
}).strict();

export const createBatchSchema = z.object({
  name: z.string().trim().min(1).max(150),
  code: z.string().trim().min(2).max(30).toUpperCase(),
  programId: z.string().uuid(),
  admissionYear: z.coerce.number().int().min(1900).max(2200),
  completionYear: z.coerce.number().int().min(1901).max(2300),
}).strict().refine((value) => value.completionYear > value.admissionYear, {
  message: "completionYear must be greater than admissionYear",
  path: ["completionYear"],
});

export const updateBatchSchema = z.object({
  name: z.string().trim().min(1).max(150).optional(),
  code: z.string().trim().min(2).max(30).toUpperCase().optional(),
  programId: z.string().uuid().optional(),
  admissionYear: z.coerce.number().int().min(1900).max(2200).optional(),
  completionYear: z.coerce.number().int().min(1901).max(2300).optional(),
  isActive: z.boolean().optional(),
}).strict().refine((value) => Object.keys(value).length > 0, {
  message: "At least one field must be provided",
});

export type CreateBatchInput = z.infer<typeof createBatchSchema>;
export type UpdateBatchInput = z.infer<typeof updateBatchSchema>;
