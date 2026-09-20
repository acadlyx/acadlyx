import { z } from "zod";
import { optionalText, optionalUuid, pageQuery } from "./common";

export const MOVEMENT_TYPES = [
  "PROMOTION",
  "SECTION_TRANSFER",
  "PROGRAM_TRANSFER",
] as const;

export const movementListQuery = z.object({
  ...pageQuery,
  status: z.enum(["PENDING", "APPROVED", "REJECTED"]).optional(),
  requestType: z.enum(MOVEMENT_TYPES).optional(),
  studentId: z.string().uuid().optional(),
});

export const createMovementSchema = z
  .object({
    studentId: z.string().uuid(),
    requestType: z.enum(MOVEMENT_TYPES),
    targetProgramId: optionalUuid,
    targetAcademicYearId: optionalUuid,
    targetSemesterId: optionalUuid,
    targetSectionId: optionalUuid,
    reason: optionalText(1000),
  })
  .superRefine((value, ctx) => {
    if (value.requestType === "PROMOTION" && !value.targetAcademicYearId) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "A promotion requires a target academic year",
        path: ["targetAcademicYearId"],
      });
    }
    if (value.requestType === "SECTION_TRANSFER" && !value.targetSectionId) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "A section transfer requires a target section",
        path: ["targetSectionId"],
      });
    }
    if (value.requestType === "PROGRAM_TRANSFER" && !value.targetProgramId) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "A program transfer requires a target program",
        path: ["targetProgramId"],
      });
    }
  });

export const decideMovementSchema = z
  .object({
    decision: z.enum(["APPROVED", "REJECTED"]),
    note: optionalText(500),
  })
  .refine((value) => value.decision === "APPROVED" || !!value.note, {
    message: "A note is required when rejecting a request",
    path: ["note"],
  });

export const bulkPromotionSchema = z.object({
  studentIds: z.array(z.string().uuid()).min(1).max(200),
  targetAcademicYearId: z.string().uuid(),
  targetSemesterId: optionalUuid,
  targetSectionId: optionalUuid,
  reason: optionalText(500),
});

export type CreateMovementInput = z.infer<typeof createMovementSchema>;
export type BulkPromotionInput = z.infer<typeof bulkPromotionSchema>;
