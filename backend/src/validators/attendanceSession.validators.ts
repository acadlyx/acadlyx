import { z } from "zod";

export const createSessionSchema = z.object({
  courseOfferingId: z.string().uuid(),
  sessionDate: z.coerce.date(),
});

const recordStatusEnum = z.enum(["PRESENT", "ABSENT", "LATE"]);

export const updateRecordsSchema = z.object({
  records: z
    .array(
      z.object({
        studentId: z.string().uuid(),
        status: recordStatusEnum,
      })
    )
    .min(1, "At least one attendance record is required"),
  submit: z.boolean().optional().default(false),
});

export const listSessionsQuerySchema = z.object({
  page: z.string().optional(),
  pageSize: z.string().optional(),
  courseOfferingId: z.string().uuid().optional(),
  facultyId: z.string().uuid().optional(),
  dateFrom: z.coerce.date().optional(),
  dateTo: z.coerce.date().optional(),
  isSubmitted: z.enum(["true", "false"]).optional(),
});

export type CreateSessionInput = z.infer<typeof createSessionSchema>;
export type UpdateRecordsInput = z.infer<typeof updateRecordsSchema>;
export type RecordStatus = z.infer<typeof recordStatusEnum>;
